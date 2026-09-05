@echo off
echo.
echo  ========================================
echo       Crypto Scanner - Frontend
echo  ========================================
echo.
echo  Starting Next.js on http://localhost:3000
echo  Press Ctrl+C to stop.
echo.
cd /d "%~dp0frontend"
npm run dev
pause
