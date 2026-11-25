@echo off
setlocal
cd /d "%~dp0"
title QWEMU MUSIC Desktop - Checks
where node >nul 2>&1
if errorlevel 1 (echo [ERROR] Node.js 22 or newer is required. & exit /b 1)
where npm >nul 2>&1
if errorlevel 1 (echo [ERROR] npm is not available in PATH. & exit /b 1)
where cargo >nul 2>&1
if errorlevel 1 (echo [ERROR] Rust Cargo is not installed. & exit /b 1)
echo [INFO] Checking frontend JavaScript and smoke tests...
call npm run check
if errorlevel 1 (echo [ERROR] Frontend checks failed. & exit /b 1)
echo [INFO] Checking Rust formatting...
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
if errorlevel 1 (echo [ERROR] Rust formatting check failed. & exit /b 1)
echo [INFO] Checking Rust and Tauri dependencies...
cargo check --manifest-path src-tauri/Cargo.toml
if errorlevel 1 (echo [ERROR] Cargo check failed. & exit /b 1)
echo [SUCCESS] All local checks passed.
exit /b 0
