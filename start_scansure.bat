@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM ============================================================================
REM ScanSure AI — One-Click Local Windows Launcher (start_scansure.bat)
REM Target Device: jio-fiber (Intel Core i5-13420H | 16 GB RAM | RTX 3050 6GB)
REM ============================================================================
title ScanSure AI - Offline Ultrasound Video Enhancement ^& Anomaly Detection

echo ============================================================================
echo   ScanSure AI — Offline Ultrasound Video Enhancement ^& Anomaly Detection
echo   Local Workstation Launcher for Windows (Port 3000)
echo ============================================================================
echo.

REM 1. Verify Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in your system PATH.
    echo Please install Node.js LTS ^(v18 or v20+^) from: https://nodejs.org/
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js detected: %NODE_VER%

REM 2. Verify Python 3 is installed
set PYTHON_BIN=python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    where py >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        set PYTHON_BIN=py
    ) else (
        echo [ERROR] Python 3 is not installed or not in your system PATH.
        echo Please install Python 3.10+ from: https://www.python.org/downloads/
        echo Make sure to check "Add Python to PATH" during installation.
        pause
        exit /b 1
    )
)
for /f "delims=" %%p in ('%PYTHON_BIN% --version 2^>^&1') do set PY_VER=%%p
echo [OK] Python detected: %PY_VER%

REM 3. Verify FFmpeg is installed
where ffmpeg >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARNING] FFmpeg was not found in your system PATH.
    echo To install FFmpeg on Windows, open PowerShell and run:
    echo     winget install Gyan.FFmpeg
    echo Proceeding with startup...
) else (
    echo [OK] FFmpeg detected in system PATH.
)

REM 4. Install Python dependencies if requirements.txt exists
if exist "requirements.txt" (
    echo.
    echo [1/4] Checking local Python packages...
    %PYTHON_BIN% -m pip install -r requirements.txt --quiet --disable-pip-version-check 2>nul
)

REM 5. Install Node.js dependencies if tsx or vite binaries are missing in node_modules\.bin
if not exist "node_modules\.bin\tsx.cmd" (
    echo.
    echo [2/4] Installing Node.js packages ^(npm install --legacy-peer-deps^)...
    call npm install --legacy-peer-deps
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] npm install failed. Please check your internet connection and Node.js installation.
        pause
        exit /b 1
    )
) else (
    echo [2/4] Node.js dependencies verified ^(tsx ^& vite ready^).
)

REM Ensure Rolldown WebAssembly fallback is present for Windows OneDrive / non-MSVC environments
if not exist "node_modules\@rolldown\binding-wasm32-wasi" (
    echo       Installing Rolldown WebAssembly fallback for Windows compatibility...
    call npm install @rolldown/binding-wasm32-wasi --no-save --force --legacy-peer-deps >nul 2>nul
)

REM 6. Set environment variables and verify offline readiness
set PYTHONPATH=%CD%
echo [3/4] Running local offline readiness verification...
%PYTHON_BIN% offline_verify.py

REM 7. Launch browser automatically after 3 seconds and start the workstation server
echo.
echo [4/4] Starting ScanSure AI Server on http://localhost:3000 ...
echo       Your default browser will open automatically in 3 seconds.
echo       Press Ctrl+C in this window at any time to stop the server.
echo ============================================================================
echo.

start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"
call npm run dev

pause
