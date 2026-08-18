#!/usr/bin/env bash
cd "$(dirname "$0")"
python3 -m pip install -r requirements.txt -q
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --reload
