#!/usr/bin/env bash
set -e
echo "[ScanSure AI] Inspecting local hardware and verifying air-gapped readiness..."
export PYTHONPATH=.
python3 offline_verify.py
echo "[ScanSure AI] Launching workstation on http://localhost:3000 ..."
npm run dev
