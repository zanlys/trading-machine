@echo off
echo.
echo  ========================================
echo       Crypto Scanner - Backend
echo  ========================================
echo.
echo  Starting FastAPI on http://localhost:8000
echo  Press Ctrl+C to stop.
echo.
cd /d "%~dp0backend"
python main.py
pause
