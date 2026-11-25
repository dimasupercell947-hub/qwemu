@echo off
setlocal
cd /d "%~dp0"
title QWEMU MUSIC Desktop - Run
where cargo >nul 2>&1
if errorlevel 1 (echo [ERROR] Rust Cargo is missing. Install Rust stable from https://rustup.rs/ & exit /b 1)
where rustc >nul 2>&1
if errorlevel 1 (echo [ERROR] Rust compiler is not available in PATH. & exit /b 1)
cargo tauri --version >nul 2>&1
if errorlevel 1 (
  echo [INFO] Installing Tauri CLI 2...
  cargo install tauri-cli --version "^2" --locked
  if errorlevel 1 (echo [ERROR] Tauri CLI installation failed. & exit /b 1)
)
echo [INFO] Starting QWEMU MUSIC Desktop...
cargo tauri dev --config src-tauri/tauri.conf.json
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" echo [ERROR] Desktop run failed with code %EXIT_CODE%.
exit /b %EXIT_CODE%
