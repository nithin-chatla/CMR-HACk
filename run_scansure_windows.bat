@echo off
REM ============================================================================
REM ScanSure AI — Production Offline Launcher for Windows 11 x64 (jio-fiber)
REM Target Hardware: 13th Gen Intel Core i5-13420H | 16 GB RAM | RTX 3050 6GB
REM ============================================================================
title ScanSure AI - Offline Ultrasound Workstation (jio-fiber)
echo [ScanSure AI] Verifying local Python 3 and FFmpeg environment...
python --version
ffmpeg -version | findstr "ffmpeg version"

echo [ScanSure AI] Running Air-Gapped Offline Verification Check...
set PYTHONPATH=.
python offline_verify.py

echo [ScanSure AI] Starting Local Medical Imaging Workstation on http://localhost:3000 ...
npm run dev
pause
