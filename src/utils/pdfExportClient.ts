import { jsPDF } from 'jspdf';
import type { AnnotatedKeyframe, JobResultPayload } from '../types/scansure';
import { selectTopConfidenceKeyframes } from './ultrasoundAnalytics';

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateDoctorPdfWithImages(
  jobResult: JobResultPayload,
  doctorNotes: {
    facilityName: string;
    operatorNotes: string;
    triagePriority: string;
    radiologistImpression: string;
    activeThreshold: number;
    topFramesCount?: number;
  }
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // 1. Header Banner
  doc.setFillColor(11, 14, 23);
  doc.rect(0, 0, pageW, 74, 'F');

  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('SCANSURE AI — CLINICAL ULTRASOUND ANALYSIS REPORT', 36, 28);

  doc.setTextColor(6, 182, 212);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    'Offline AI-Assisted Enhancement & Anomaly Triage Packet for Remote Radiologist Review',
    36,
    45
  );

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8.5);
  const dateStr = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  doc.text(
    `Study ID: ${jobResult.job_id}   |   Generated: ${dateStr}   |   Workstation: jio-fiber (i5-13420H / RTX 3050 6GB)`,
    36,
    61
  );

  // 2. Medical Disclaimer Box
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(217, 119, 6);
  doc.rect(36, 86, pageW - 72, 34, 'FD');
  doc.setTextColor(146, 64, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('NON-DIAGNOSTIC CLINICAL SAFETY NOTICE:', 44, 99);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'ScanSure AI is an experimental AI-assisted imaging tool. It does not provide a medical diagnosis. All findings require review by a qualified radiologist.',
    44,
    111,
    { maxWidth: pageW - 88 }
  );

  // 3. Rural Clinic & Acquisition Metadata Grid
  let y = 138;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('1. ACQUISITION METADATA & ENHANCEMENT QUALITY METRICS', 36, y);
  doc.setDrawColor(203, 213, 225);
  doc.line(36, y + 4, pageW - 36, y + 4);

  y += 18;
  doc.setFontSize(9);
  const inVid = jobResult.input_video;
  const enh = jobResult.enhancement_evaluation;
  const cfg = jobResult.processing_configuration;

  const col1X = 36;
  const col2X = 305;

  doc.setFont('helvetica', 'bold');
  doc.text('Source Video:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${inVid.filename} (${inVid.resolution}, ${inVid.fps} FPS, ${inVid.frame_count} frames)`,
    col1X + 70,
    y
  );

  doc.setFont('helvetica', 'bold');
  doc.text('Triage Priority:', col2X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(doctorNotes.triagePriority.toUpperCase(), col2X + 76, y);

  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('Denoising Method:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${cfg.enhancement_method} (Strength ${Math.round(cfg.enhancement_strength * 100)}%)`,
    col1X + 86,
    y
  );

  doc.setFont('helvetica', 'bold');
  doc.text('Speckle Reduction:', col2X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `ENL ${enh.input_enl_speckle_index} -> ${enh.enhanced_enl_speckle_index} (+${enh.speckle_suppression_gain_pct}%)`,
    col2X + 88,
    y
  );

  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('PSNR / SSIM / EPI:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${enh.mean_psnr_db} dB  |  SSIM ${enh.mean_ssim}  |  EPI ${enh.edge_preservation_index}`,
    col1X + 88,
    y
  );

  doc.setFont('helvetica', 'bold');
  doc.text('Clinic Site:', col2X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(doctorNotes.facilityName.slice(0, 38), col2X + 60, y);

  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('Field Notes:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(doctorNotes.operatorNotes.slice(0, 95), col1X + 60, y);

  // 4. AI Anomaly Summary Box
  y += 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('2. AI ANOMALY DETECTION & CONFIDENCE SUMMARY', 36, y);
  doc.line(36, y + 4, pageW - 36, y + 4);

  y += 14;
  doc.setFillColor(241, 245, 249);
  doc.rect(36, y, pageW - 72, 36, 'F');

  const sum = jobResult.detection_summary;
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Frames With Findings: ${sum.frames_with_findings} / ${sum.total_frames_processed}`,
    46,
    y + 15
  );
  doc.text(
    `Peak Raw Score: ${(sum.peak_raw_confidence * 100).toFixed(1)}% (Raw ${sum.peak_raw_confidence.toFixed(3)} vs Thr ${doctorNotes.activeThreshold.toFixed(2)})`,
    210,
    y + 15
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Model: ${jobResult.model_metadata.model_name}   |   Status: ${sum.clinical_recommendation}`,
    46,
    y + 29
  );

  // 5. Embedded Annotated Ultrasound Keyframe Images (User-Selected Top Confidence Count)
  const requestedCount = doctorNotes.topFramesCount || 4;
  const topKeyframes: AnnotatedKeyframe[] = selectTopConfidenceKeyframes(
    jobResult.exports.annotated_png_frames || [],
    jobResult.frame_by_frame_timeline || [],
    requestedCount
  );

  y += 54;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(
    `3. TOP ${topKeyframes.length} HIGH-CONFIDENCE ANNOTATED ULTRASOUND KEYFRAMES`,
    36,
    y
  );
  doc.line(36, y + 4, pageW - 36, y + 4);

  y += 14;
  const imgW = 248;
  const imgH = 128;

  for (let i = 0; i < Math.min(2, topKeyframes.length); i++) {
    const kf = topKeyframes[i];
    const xPos = 36 + i * (imgW + 24);
    const targetUrl = kf.comparison_url || kf.url;
    const dataUrl = await fetchImageAsDataUrl(targetUrl);
    if (dataUrl) {
      doc.addImage(dataUrl, 'PNG', xPos, y, imgW, imgH);
    } else {
      doc.setFillColor(15, 23, 42);
      doc.rect(xPos, y, imgW, imgH, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const confPct = ((kf.max_confidence ?? 0) * 100).toFixed(1);
    doc.text(
      `Frame #${kf.frame_number} (${kf.timestamp_sec}s) — Confidence: ${confPct}%`,
      xPos,
      y + imgH + 12
    );
  }

  y += imgH + 28;

  // 6. Representative Frame Coordinates Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('4. QUANTITATIVE REGION COORDINATES & CALIPER MEASUREMENTS', 36, y);
  doc.line(36, y + 4, pageW - 36, y + 4);

  y += 16;
  doc.setFontSize(8.5);
  doc.text('Frame #', 36, y);
  doc.text('Time (s)', 88, y);
  doc.text('Classification', 140, y);
  doc.text('BBox [x, y, w, h]', 310, y);
  doc.text('Est. Size (mm)', 405, y);
  doc.text('Confidence', 490, y);
  doc.line(36, y + 3, pageW - 36, y + 3);

  doc.setFont('helvetica', 'normal');
  const allDets = [...jobResult.detections]
    .filter((d) => d.raw_confidence >= doctorNotes.activeThreshold)
    .sort((a, b) => b.raw_confidence - a.raw_confidence)
    .slice(0, Math.min(8, requestedCount));

  if (allDets.length > 0) {
    for (const d of allDets) {
      if (y > pageH - 110) break;
      y += 14;
      const [bx, by, bw, bh] = d.bbox_xywh;
      const mmW = (bw * 0.28).toFixed(1);
      const mmH = (bh * 0.28).toFixed(1);
      doc.text(`#${d.frame_number}`, 36, y);
      doc.text(`${d.timestamp_sec.toFixed(2)}s`, 88, y);
      doc.text(d.category.slice(0, 34), 140, y);
      doc.text(`[${bx}, ${by}, ${bw}, ${bh}]`, 310, y);
      doc.text(`${mmW} x ${mmH} mm`, 405, y);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `${(d.raw_confidence * 100).toFixed(1)}% (${d.raw_confidence.toFixed(2)})`,
        490,
        y
      );
      doc.setFont('helvetica', 'normal');
    }
  } else {
    y += 16;
    doc.text(
      `No regions detected above the validated threshold (${doctorNotes.activeThreshold.toFixed(2)}) across this ultrasound clip.`,
      36,
      y
    );
  }

  // 7. Radiologist Impression & Sign-Off Block
  y += 22;
  if (y + 74 > pageH - 20) {
    doc.addPage();
    y = 40;
  }
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(36, y, pageW - 72, 74, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('5. REVIEWING RADIOLOGIST IMPRESSION & DISPOSITION SIGN-OFF', 46, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Impression Note: ${doctorNotes.radiologistImpression}`, 46, y + 32, {
    maxWidth: pageW - 92,
  });
  doc.text(
    'Reviewing Doctor Signature: _______________________________     License #: _______________     Date: _____________',
    46,
    y + 60
  );

  doc.save(`ScanSure_AI_Radiologist_Report_${jobResult.job_id}.pdf`);
}
