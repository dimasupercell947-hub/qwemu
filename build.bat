@echo off
setlocal
cd /d "%~dp0"
title QWEMU MUSIC Desktop - Build
call check.bat
if errorlevel 1 (echo [ERROR] Project checks failed. Build cancelled. & exit /b 1)
where cargo >nul 2>&1
if errorlevel 1 (echo [ERROR] Rust Cargo is missing. Install Rust stable from https://rustup.rs/ & exit /b 1)
cargo tauri --version >nul 2>&1
if errorlevel 1 (
  echo [INFO] Installing Tauri CLI 2...
  cargo install tauri-cli --version "^2" --locked
  if errorlevel 1 (echo [ERROR] Tauri CLI installation failed. & exit /b 1)
)
echo [INFO] Building Windows installers (NSIS and MSI)...
cargo tauri build --config src-tauri/tauri.conf.json
if errorlevel 1 (echo [ERROR] Tauri build failed. & exit /b 1)
echo [SUCCESS] Build completed.
if exist "src-tauri\target\release\bundle\nsis" dir /b "src-tauri\target\release\bundle\nsis\*.exe"
if exist "src-tauri\target\release\bundle\msi" dir /b "src-tauri\target\release\bundle\msi\*.msi"
echo [INFO] Full output: src-tauri\target\release\bundle\
exit /b 0
