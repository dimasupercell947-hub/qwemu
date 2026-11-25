@echo off
setlocal
cd /d "%~dp0"
title QWEMU MUSIC Desktop - Run

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js 22 or newer is required.
  exit /b 1
)
node -e "if (Number(process.versions.node.split('.')[0]) < 22) process.exit(1)" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js 22 or newer is required. Update Node.js and reopen the terminal.
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm is not available in PATH.
  exit /b 1
)
where cargo >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Rust Cargo is not installed.
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

echo [INFO] Starting QWEMU MUSIC Desktop...
call npm run tauri -- dev --config src-tauri/tauri.conf.json
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" echo [ERROR] Desktop run failed with code %EXIT_CODE%.
exit /b %EXIT_CODE%
