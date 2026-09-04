@echo off
echo =======================================================
echo   NAYAN - Enterprise Traffic Intelligence
echo =======================================================
echo.
echo Starting Backend (FastAPI on http://localhost:8000)...
start "NAYAN Backend" cmd /k "cd /d %~dp0backend && .venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo Starting Frontend (Vite on http://localhost:5173)...
start "NAYAN Frontend" cmd /k "cd /d %~dp0frontend && npm run dev -- --host"

echo.
echo Both servers are launching in separate consoles!
echo Frontend will be accessible at: http://localhost:5173
echo Backend API docs available at: http://localhost:8000/docs
echo.
pause
