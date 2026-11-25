@echo off
setlocal
cd /d "%~dp0"
title QWEMU MUSIC Desktop - Build

call check.bat
if errorlevel 1 (
  echo [ERROR] Project checks failed. Build cancelled.
  exit /b 1
)

if not exist "node_modules\.bin\tauri.cmd" (
  echo [INFO] Installing pinned Tauri CLI 2.12.6...
  call npm install --no-package-lock
  if errorlevel 1 (
    echo [ERROR] Tauri CLI installation failed.
    exit /b 1
  )
)

echo [INFO] Building Windows installers (NSIS and MSI)...
call npm run tauri -- build --config src-tauri/tauri.conf.json
if errorlevel 1 (
  echo [ERROR] Tauri build failed.
  exit /b 1
)

if not exist "src-tauri\target\release\bundle\nsis\*.exe" (
  echo [ERROR] NSIS installer was not created.
  exit /b 1
)
if not exist "src-tauri\target\release\bundle\msi\*.msi" (
  echo [ERROR] MSI installer was not created.
  exit /b 1
)

echo.
echo [SUCCESS] Both Windows installers were created:
dir /b "src-tauri\target\release\bundle\nsis\*.exe"
dir /b "src-tauri\target\release\bundle\msi\*.msi"
echo [INFO] Full output: src-tauri\target\release\bundle\
exit /b 0
