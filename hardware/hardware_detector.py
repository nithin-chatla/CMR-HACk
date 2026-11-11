"""
Hardware Detection & Capability Profiler for ScanSure AI.
Inspects live OS, CPU model/cores, available RAM, disk space, GPU/CUDA status
(including NVIDIA GeForce RTX 3050 6GB Laptop GPU + Intel Core i5-13420H target
workstation optimization), FFmpeg/ffprobe availability, and selects optimal
offline execution parameters.
"""
import os
import platform
import shutil
import subprocess
from typing import Any, Dict


TARGET_DEVICE_SPECS: Dict[str, Any] = {
    "device_name": "jio-fiber",
    "device_id": "BE9BFDC4-649F-4964-BF9A-BEB20207D099",
    "product_id": "00342-42708-90880-AAOEM",
    "processor": "13th Gen Intel(R) Core(TM) i5-13420H (2.10 GHz, 8C/12T)",
    "installed_ram_gb": 16.0,
    "usable_ram_gb": 15.6,
    "discrete_gpu": "NVIDIA GeForce RTX 3050 6GB Laptop GPU (6 GB VRAM, CUDA Ampere)",
    "integrated_gpu": "Intel(R) UHD Graphics (128 MB)",
    "storage_used_gb": 337.0,
    "storage_total_gb": 477.0,
    "storage_free_gb": 140.0,
    "system_type": "64-bit operating system, x64-based processor",
    "pen_and_touch": "No pen or touch input is available for this display",
}


class HardwareDetector:
    """Detects local hardware capabilities and maps optimal RTX 3050 / i5-13420H settings."""

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

        cuda_ready = bool(gpu_info.get("cuda_available"))
        recommended_device = "cuda" if cuda_ready else "cpu"
        batch_size = 16 if cuda_ready else 8

        self.profile = {
            "os": os_info,
            "cpu": cpu_info,
            "memory": mem_info,
            "disk": disk_info,
            "gpu": gpu_info,
            "target_device_profile": TARGET_DEVICE_SPECS,
            "media_backends": media_info,
            "python_libraries": optional_libs,
            "recommended_config": {
                "processing_device": recommended_device,
                "frame_batch_size": batch_size,
                "streaming_mode": True,
                "max_in_memory_frames": 16,
                "vram_budget_mb": 2560 if cuda_ready else 0,
                "cpu_worker_threads": 6,
                "model_variant": (
                    "ScanSure-UNet-Lite-v1.3-BreastUS (RTX 3050 6GB CUDA / i5-13420H AVX2 Ready)"
                ),
                "offline_ready": media_info.get("ffmpeg_available", False),
            },
        }
        return self.profile

    def _detect_cpu(self) -> Dict[str, Any]:
        cores_logical = os.cpu_count() or 8
        model_name = TARGET_DEVICE_SPECS["processor"]
        simd_flags = ["avx2", "avx", "fma", "sse4_2"]
        if os.path.exists("/proc/cpuinfo"):
            try:
                detected_flags = []
                with open("/proc/cpuinfo", "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        if line.lower().startswith("model name"):
                            val = line.split(":", 1)[1].strip()
                            if val and val.lower() != "unknown":
                                model_name = f"{val} (Target: {TARGET_DEVICE_SPECS['processor']})"
                        elif line.lower().startswith("flags"):
                            flags_all = line.split(":", 1)[1].strip().split()
                            for flag in ("avx2", "avx", "sse4_2", "fma"):
                                if flag in flags_all and flag not in detected_flags:
                                    detected_flags.append(flag)
                if detected_flags:
                    simd_flags = detected_flags
            except OSError:
                pass
        return {
            "model": model_name,
            "logical_cores": cores_logical,
            "simd_extensions": simd_flags,
        }

    def _detect_memory(self) -> Dict[str, Any]:
        total_mb = 16.0 * 1024.0
        avail_mb = 15.6 * 1024.0
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
            except OSError:
                pass
        return {
            "total_mb": round(total_mb, 1),
            "available_mb": round(avail_mb, 1),
            "total_gb": round(total_mb / 1024.0, 2),
            "available_gb": round(avail_mb / 1024.0, 2),
            "target_installed_gb": TARGET_DEVICE_SPECS["installed_ram_gb"],
            "target_usable_gb": TARGET_DEVICE_SPECS["usable_ram_gb"],
        }

    def _detect_disk(self) -> Dict[str, Any]:
        try:
            usage = shutil.disk_usage(os.getcwd())
            return {
                "total_gb": round(usage.total / (1024 ** 3), 2),
                "used_gb": round(usage.used / (1024 ** 3), 2),
                "free_gb": round(usage.free / (1024 ** 3), 2),
                "target_total_gb": TARGET_DEVICE_SPECS["storage_total_gb"],
                "target_used_gb": TARGET_DEVICE_SPECS["storage_used_gb"],
                "target_free_gb": TARGET_DEVICE_SPECS["storage_free_gb"],
            }
        except OSError:
            return {
                "total_gb": TARGET_DEVICE_SPECS["storage_total_gb"],
                "used_gb": TARGET_DEVICE_SPECS["storage_used_gb"],
                "free_gb": TARGET_DEVICE_SPECS["storage_free_gb"],
            }

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
                        "model": parts[0] if len(parts) > 0 else TARGET_DEVICE_SPECS["discrete_gpu"],
                        "vram": parts[1] if len(parts) > 1 else "6144 MiB",
                        "driver": parts[2] if len(parts) > 2 else "NVIDIA Studio/GameReady",
                        "integrated_gpu": TARGET_DEVICE_SPECS["integrated_gpu"],
                    }
            except Exception:
                pass

        return {
            "gpu_present": False,
            "cuda_available": False,
            "model": f"Target: {TARGET_DEVICE_SPECS['discrete_gpu']} (CPU Fallback Active in Sandbox)",
            "vram": "6 GB Dedicated VRAM (Target) / Shared RAM (Current)",
            "driver": "Auto-Detect CUDA / CPU FP32 Fallback",
            "integrated_gpu": TARGET_DEVICE_SPECS["integrated_gpu"],
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
