@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Menginstall dependency...
  call npm install
)
if not exist .env (
  echo File .env belum ada. Salin .env.example menjadi .env lalu isi DISCORD_TOKEN.
  pause
  exit /b 1
)
echo Menjalankan bot... tutup jendela ini atau tekan Ctrl+C untuk mematikan.
node src\index.js
pause
