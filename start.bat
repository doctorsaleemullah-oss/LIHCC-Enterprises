@echo off
echo Starting Advanced Heart Center Clinic System...
cd /d "%~dp0"
py -m pip install -r requirements.txt -q
py -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
