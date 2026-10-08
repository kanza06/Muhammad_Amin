@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo KAHFI PHOTOBOOTH - INSTALL & RUN
echo ==========================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Install Node.js 20 LTS atau lebih baru.
  pause
  exit /b 1
)
echo Installing dependencies...
npm install
if errorlevel 1 (
  echo.
  echo npm install gagal. Pastikan internet aktif lalu jalankan lagi.
  pause
  exit /b 1
)
echo.
echo Starting KAHFI PHOTOBOOTH...
npm run dev
pause
