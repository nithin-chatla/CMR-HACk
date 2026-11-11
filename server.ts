import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { createServer as createViteServer } from 'vite';

const execFileAsync = promisify(execFile);

const ROOT_DIR = process.cwd();
const SAMPLES_DIR = path.join(ROOT_DIR, 'data', 'samples');
const UPLOADS_DIR = path.join(ROOT_DIR, 'data', 'uploads');
const OUTPUTS_DIR = path.join(ROOT_DIR, 'outputs');

fs.mkdirSync(SAMPLES_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 }, // 250 MB max ultrasound video upload
});

interface ActiveJobInfo {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
  result?: unknown;
}

const activeJobs = new Map<string, ActiveJobInfo>();

async function runPythonJsonCommand(args: string[], timeoutMs = 120000): Promise<any> {
  const { stdout } = await execFileAsync('python3', ['app.py', ...args], {
    cwd: ROOT_DIR,
    env: { ...process.env, PYTHONPATH: ROOT_DIR },
    maxBuffer: 32 * 1024 * 1024,
    timeout: timeoutMs,
  });
  return JSON.parse(stdout);
}

async function ensureBootstrapped(): Promise<void> {
  try {
    const manifestPath = path.join(SAMPLES_DIR, 'samples_manifest.json');
    if (!fs.existsSync(manifestPath)) {
      await runPythonJsonCommand(['--generate-samples', SAMPLES_DIR]);
    }
    const presetCases = [
      { jobId: 'demo_case01', file: 'breast_ultrasound_cyst_case01.mp4' },
      { jobId: 'demo_case02', file: 'breast_ultrasound_multifocal_case02.mp4' },
      { jobId: 'demo_case03', file: 'breast_ultrasound_normal_control03.mp4' },
    ];
    for (const preset of presetCases) {
      const demoJobDir = path.join(OUTPUTS_DIR, preset.jobId);
      const demoReportPath = path.join(demoJobDir, 'ui_result.json');
      const videoPath = path.join(SAMPLES_DIR, preset.file);
      if (fs.existsSync(demoReportPath)) {
        const cached = JSON.parse(fs.readFileSync(demoReportPath, 'utf-8'));
        activeJobs.set(preset.jobId, {
          jobId: preset.jobId,
          status: 'completed',
          result: cached,
        });
      } else if (fs.existsSync(videoPath)) {
        const result = await runPythonJsonCommand([
          '--process',
          videoPath,
          '--output-dir',
          demoJobDir,
          '--job-id',
          preset.jobId,
          '--method',
          'speckle_bilateral_clahe',
          '--strength',
          '0.75',
          '--threshold',
          '0.55',
        ]);
        result.input_video.video_url = `/api/samples/video/${encodeURIComponent(preset.file)}`;
        fs.writeFileSync(demoReportPath, JSON.stringify(result, null, 2));
        activeJobs.set(preset.jobId, {
          jobId: preset.jobId,
          status: 'completed',
          result,
        });
      }
    }
  } catch (err) {
    console.error('Bootstrap initialization warning:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Trigger non-blocking bootstrap
  ensureBootstrapped();

  // 1. Hardware inspection endpoint
  app.get('/api/hardware', async (_req, res) => {
    try {
      const hw = await runPythonJsonCommand(['--inspect-hardware'], 15000);
      res.json(hw);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Hardware detection failed' });
    }
  });

  // 2. Sample ultrasound videos list
  app.get('/api/samples', async (_req, res) => {
    try {
      const samples = await runPythonJsonCommand(['--generate-samples', SAMPLES_DIR], 60000);
      const enriched = samples.map((s: any) => {
        let sizeMb = 0.25;
        try {
          const st = fs.statSync(s.filepath);
          sizeMb = Number((st.size / (1024 * 1024)).toFixed(3));
        } catch {
          // ignore
        }
        return {
          ...s,
          file_size_mb: sizeMb,
          duration_sec: Number((s.num_frames / s.fps).toFixed(2)),
          video_url: `/api/samples/video/${encodeURIComponent(s.filename)}`,
        };
      });
      res.json({ samples: enriched });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load sample videos' });
    }
  });

  // Stream sample or uploaded video
  app.get('/api/samples/video/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(SAMPLES_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Sample video not found' });
      return;
    }
    res.sendFile(filePath);
  });

  app.get('/api/uploads/video/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Uploaded video not found' });
      return;
    }
    res.sendFile(filePath);
  });

  // 3. Probe sample or uploaded video metadata
  app.post('/api/probe', async (req, res) => {
    try {
      const { filepath } = req.body;
      if (!filepath || typeof filepath !== 'string') {
        res.status(400).json({ error: 'filepath is required' });
        return;
      }
      const meta = await runPythonJsonCommand(['--probe', filepath], 20000);
      const isUpload = filepath.startsWith(UPLOADS_DIR);
      const baseRoute = isUpload ? '/api/uploads/video/' : '/api/samples/video/';
      meta.video_url = `${baseRoute}${encodeURIComponent(path.basename(filepath))}`;
      res.json(meta);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Video validation failed' });
    }
  });

  // 4. Upload custom ultrasound video (.mp4, .avi, .mov, .mkv)
  app.post('/api/upload', upload.single('video'), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No video file uploaded' });
        return;
      }
      const uploadedPath = req.file.path;
      const meta = await runPythonJsonCommand(['--probe', uploadedPath], 30000);
      meta.video_url = `/api/uploads/video/${encodeURIComponent(path.basename(uploadedPath))}`;
      res.json(meta);
    } catch (err: any) {
      res.status(400).json({
        error: err.message || 'Uploaded file failed ultrasound video container validation',
      });
    }
  });

  // 5. Start processing job
  app.post('/api/process', async (req, res) => {
    try {
      const {
        filepath,
        enhancement_method = 'speckle_bilateral_clahe',
        enhancement_strength = 0.75,
        clahe_clip_limit = 2.2,
        gamma = 1.05,
        temporal_alpha = 0.28,
        ai_detection_enabled = true,
        detection_threshold = 0.55,
        temporal_smoothing = true,
        output_resolution = 'original',
        device = 'auto',
        top_k_frames = 12,
      } = req.body;

      if (!filepath || !fs.existsSync(filepath)) {
        res.status(400).json({ error: 'Valid input video filepath is required' });
        return;
      }

      const jobId = `job_${Date.now()}`;
      const jobOutDir = path.join(OUTPUTS_DIR, jobId);
      fs.mkdirSync(jobOutDir, { recursive: true });

      activeJobs.set(jobId, { jobId, status: 'processing' });

      const args = [
        'app.py',
        '--process',
        filepath,
        '--output-dir',
        jobOutDir,
        '--job-id',
        jobId,
        '--method',
        String(enhancement_method),
        '--strength',
        String(enhancement_strength),
        '--clahe-clip',
        String(clahe_clip_limit),
        '--gamma',
        String(gamma),
        '--temporal-alpha',
        String(temporal_alpha),
        '--ai-enabled',
        String(Boolean(ai_detection_enabled)),
        '--threshold',
        String(detection_threshold),
        '--temporal-smoothing',
        String(Boolean(temporal_smoothing)),
        '--resolution',
        String(output_resolution),
        '--device',
        String(device),
        '--top-k-frames',
        String(Math.max(1, Math.min(12, Number(top_k_frames) || 12))),
      ];

      const child = spawn('python3', args, {
        cwd: ROOT_DIR,
        env: { ...process.env, PYTHONPATH: ROOT_DIR },
      });

      let stdoutChunks = '';
      let stderrChunks = '';

      child.stdout.on('data', (chunk) => {
        stdoutChunks += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderrChunks += chunk.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && stdoutChunks.trim()) {
          try {
            const parsed = JSON.parse(stdoutChunks);
            const isUpload = filepath.startsWith(UPLOADS_DIR);
            const baseRoute = isUpload ? '/api/uploads/video/' : '/api/samples/video/';
            if (parsed.input_video) {
              parsed.input_video.video_url = `${baseRoute}${encodeURIComponent(
                path.basename(filepath)
              )}`;
            }
            fs.writeFileSync(
              path.join(jobOutDir, 'ui_result.json'),
              JSON.stringify(parsed, null, 2)
            );
            activeJobs.set(jobId, {
              jobId,
              status: 'completed',
              result: parsed,
            });
          } catch (parseErr: any) {
            activeJobs.set(jobId, {
              jobId,
              status: 'failed',
              error: `Failed to parse pipeline output: ${parseErr.message}`,
            });
          }
        } else {
          activeJobs.set(jobId, {
            jobId,
            status: 'failed',
            error: stderrChunks.trim() || `Pipeline exited with code ${code}`,
          });
        }
      });

      res.json({ job_id: jobId, status: 'processing' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to launch processing pipeline' });
    }
  });

  // 6. Poll job progress & result
  app.get('/api/jobs/:jobId', (req, res) => {
    const { jobId } = req.params;
    const safeId = path.basename(jobId);
    const jobOutDir = path.join(OUTPUTS_DIR, safeId);
    const uiResultPath = path.join(jobOutDir, 'ui_result.json');
    const progressPath = path.join(jobOutDir, 'progress.json');

    const memJob = activeJobs.get(safeId);
    if (memJob && memJob.status === 'completed' && memJob.result) {
      res.json({
        job_id: safeId,
        status: 'completed',
        progress: {
          stage: 'Completed',
          progress_pct: 100,
        },
        result: memJob.result,
      });
      return;
    }

    if (memJob && memJob.status === 'failed') {
      res.status(500).json({
        job_id: safeId,
        status: 'failed',
        error: memJob.error || 'Processing failed',
      });
      return;
    }

    if (fs.existsSync(uiResultPath)) {
      try {
        const resultData = JSON.parse(fs.readFileSync(uiResultPath, 'utf-8'));
        res.json({
          job_id: safeId,
          status: 'completed',
          progress: { stage: 'Completed', progress_pct: 100 },
          result: resultData,
        });
        return;
      } catch {
        // continue to progress check
      }
    }

    if (fs.existsSync(progressPath)) {
      try {
        const progData = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
        res.json({
          job_id: safeId,
          status: progData.status || 'processing',
          progress: progData,
        });
        return;
      } catch {
        // fall through
      }
    }

    res.json({
      job_id: safeId,
      status: 'processing',
      progress: {
        stage: '01. Initializing Offline Pipeline...',
        progress_pct: 2,
        frames_processed: 0,
        total_frames: 45,
        eta_sec: 12,
      },
    });
  });

  // 7. Independent Evaluation Benchmark endpoint
  app.get('/api/benchmark', async (_req, res) => {
    try {
      const cacheFile = path.join(OUTPUTS_DIR, 'benchmark_cache.json');
      if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        res.json(cached);
        return;
      }
      const bench = await runPythonJsonCommand(['--benchmark', SAMPLES_DIR], 120000);
      fs.writeFileSync(cacheFile, JSON.stringify(bench, null, 2));
      res.json(bench);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Benchmark evaluation failed' });
    }
  });

  // 7b. Air-gapped offline verification endpoint
  app.get('/api/offline-verify', async (_req, res) => {
    try {
      const { stdout } = await execFileAsync('python3', ['offline_verify.py'], {
        cwd: ROOT_DIR,
        env: { ...process.env, PYTHONPATH: ROOT_DIR },
        timeout: 90000,
      });
      res.json(JSON.parse(stdout));
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Offline verification check failed' });
    }
  });

  // 8. Serve generated outputs (MP4s, JSON, CSV, annotated PNG frames)
  app.get('/api/outputs/:jobId/:filename', (req, res) => {
    const safeJob = path.basename(req.params.jobId);
    const safeFile = path.basename(req.params.filename);
    const targetPath = path.join(OUTPUTS_DIR, safeJob, safeFile);

    if (!fs.existsSync(targetPath)) {
      res.status(404).json({ error: 'Output artifact not found' });
      return;
    }

    if (req.query.download === '1') {
      res.download(targetPath, safeFile);
      return;
    }
    res.sendFile(targetPath);
  });

  app.get('/api/outputs/:jobId/frames/:filename', (req, res) => {
    const safeJob = path.basename(req.params.jobId);
    const safeFile = path.basename(req.params.filename);
    const targetPath = path.join(OUTPUTS_DIR, safeJob, 'frames', safeFile);

    if (!fs.existsSync(targetPath)) {
      res.status(404).json({ error: 'Annotated frame PNG not found' });
      return;
    }

    if (req.query.download === '1') {
      res.download(targetPath, safeFile);
      return;
    }
    res.sendFile(targetPath);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ScanSure AI Server listening on http://localhost:${PORT}`);
  });
}

startServer();
