"""
Hardware Detection & Capability Profiler for ScanSure AI.
Inspects OS, CPU model/cores, available RAM, disk space, GPU/CUDA status,
FFmpeg/ffprobe availability, and selects optimal offline execution parameters.
"""
import os
import platform
import shutil
import subprocess
import sys
from typing import Any, Dict


class HardwareDetector:
    """Detects local hardware capabilities without external dependencies."""

    def __init__(self) -> None:
        self.profile: Dict[str, Any] = {}

    def detect(self) -> Dict[str, Any]:
        os_info = {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "architecture": platform.machine(),
            "python_version": platform.python_version(),
        }

        cpu_info = self._detect_cpu()
        mem_info = self._detect_memory()
        disk_info = self._detect_disk()
        gpu_info = self._detect_gpu()
        media_info = self._detect_media_backends()
        optional_libs = self._detect_optional_python_libs()

        recommended_device = "cuda" if gpu_info.get("cuda_available") else "cpu"
        total_ram_gb = mem_info.get("available_gb", 4.0)
        batch_size = 8 if recommended_device == "cuda" else (4 if total_ram_gb >= 4.0 else 2)

        self.profile = {
            "os": os_info,
            "cpu": cpu_info,
            "memory": mem_info,
            "disk": disk_info,
            "gpu": gpu_info,
            "media_backends": media_info,
            "python_libraries": optional_libs,
            "recommended_config": {
                "processing_device": recommended_device,
                "frame_batch_size": batch_size,
                "streaming_mode": True,
                "max_in_memory_frames": 16,
                "model_variant": "ScanSure-UNet-Lite-v1.2-BreastUS (CPU/FP32 Optimized)",
                "offline_ready": media_info.get("ffmpeg_available", False),
            },
        }
        return self.profile

    def _detect_cpu(self) -> Dict[str, Any]:
        cores_logical = os.cpu_count() or 1
        model_name = platform.processor() or "x86_64 Generic Processor"
        simd_flags = []
        if os.path.exists("/proc/cpuinfo"):
            try:
                with open("/proc/cpuinfo", "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        if line.lower().startswith("model name"):
                            val = line.split(":", 1)[1].strip()
                            if val and val.lower() != "unknown":
                                model_name = val
                        elif line.lower().startswith("vendor_id") and "Generic" in model_name:
                            vendor = line.split(":", 1)[1].strip()
                            model_name = f"{vendor} {platform.machine()} CPU"
                        elif line.lower().startswith("flags"):
                            flags_all = line.split(":", 1)[1].strip().split()
                            for flag in ("avx2", "avx", "sse4_2", "fma"):
                                if flag in flags_all and flag not in simd_flags:
                                    simd_flags.append(flag)
            except OSError:
                pass
        return {
            "model": model_name,
            "logical_cores": cores_logical,
            "simd_extensions": simd_flags,
        }

    def _detect_memory(self) -> Dict[str, Any]:
        total_mb = 4096.0
        avail_mb = 2048.0
        if os.path.exists("/proc/meminfo"):
            try:
                mem_map: Dict[str, int] = {}
                with open("/proc/meminfo", "r", encoding="utf-8") as f:
                    for line in f:
                        parts = line.split(":")
                        if len(parts) == 2:
                            k = parts[0].strip()
                            v = parts[1].strip().split()[0]
                            if v.isdigit():
                                mem_map[k] = int(v)
                if "MemTotal" in mem_map:
                    total_mb = mem_map["MemTotal"] / 1024.0
                if "MemAvailable" in mem_map:
                    avail_mb = mem_map["MemAvailable"] / 1024.0
                elif "MemFree" in mem_map:
                    avail_mb = mem_map["MemFree"] / 1024.0
            except OSError:
                pass
        return {
            "total_mb": round(total_mb, 1),
            "available_mb": round(avail_mb, 1),
            "total_gb": round(total_mb / 1024.0, 2),
            "available_gb": round(avail_mb / 1024.0, 2),
        }

    def _detect_disk(self) -> Dict[str, Any]:
        try:
            usage = shutil.disk_usage(os.getcwd())
            return {
                "total_gb": round(usage.total / (1024 ** 3), 2),
                "used_gb": round(usage.used / (1024 ** 3), 2),
                "free_gb": round(usage.free / (1024 ** 3), 2),
            }
        except OSError:
            return {"total_gb": 0.0, "used_gb": 0.0, "free_gb": 0.0}

    def _detect_gpu(self) -> Dict[str, Any]:
        nvidia_smi = shutil.which("nvidia-smi")
        if nvidia_smi:
            try:
                proc = subprocess.run(
                    [nvidia_smi, "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader"],
                    capture_output=True,
                    text=True,
                    timeout=3,
                )
                if proc.returncode == 0 and proc.stdout.strip():
                    first_line = proc.stdout.strip().splitlines()[0]
                    parts = [p.strip() for p in first_line.split(",")]
                    return {
                        "gpu_present": True,
                        "cuda_available": True,
                        "model": parts[0] if len(parts) > 0 else "NVIDIA GPU",
                        "vram": parts[1] if len(parts) > 1 else "Unknown",
                        "driver": parts[2] if len(parts) > 2 else "Unknown",
                    }
            except Exception:
                pass
        return {
            "gpu_present": False,
            "cuda_available": False,
            "model": "None (CPU Execution Mode Active)",
            "vram": "0 MB (System Shared RAM)",
            "driver": "N/A",
        }

    def _detect_media_backends(self) -> Dict[str, Any]:
        ffmpeg_path = shutil.which("ffmpeg")
        ffprobe_path = shutil.which("ffprobe")
        ffmpeg_version = "Unavailable"
        if ffmpeg_path:
            try:
                proc = subprocess.run(
                    [ffmpeg_path, "-version"],
                    capture_output=True,
                    text=True,
                    timeout=3,
                )
                if proc.returncode == 0 and proc.stdout:
                    ffmpeg_version = proc.stdout.splitlines()[0].strip()
            except Exception:
                pass
        return {
            "ffmpeg_available": bool(ffmpeg_path),
            "ffmpeg_path": ffmpeg_path or "",
            "ffprobe_available": bool(ffprobe_path),
            "ffprobe_path": ffprobe_path or "",
            "ffmpeg_version": ffmpeg_version,
        }

    def _detect_optional_python_libs(self) -> Dict[str, bool]:
        libs = {}
        for mod in ("numpy", "cv2", "torch", "skimage", "onnxruntime"):
            try:
                __import__(mod)
                libs[mod] = True
            except ImportError:
                libs[mod] = False
        return libs


def inspect_system_hardware() -> Dict[str, Any]:
    detector = HardwareDetector()
    return detector.detect()


if __name__ == "__main__":
    import json
    print(json.dumps(inspect_system_hardware(), indent=2))
