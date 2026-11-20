@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title QWEMU MUSIC 1.2.0 - Launcher

pushd "%~dp0"
if errorlevel 1 goto :pushd_error
set "QWEMU_PUSHED=1"

if not defined CARGO_HOME set "CARGO_HOME=%USERPROFILE%\.cargo"
if not defined RUSTUP_HOME set "RUSTUP_HOME=%USERPROFILE%\.rustup"
set "PATH=%CARGO_HOME%\bin;%PATH%"

if not exist package.json goto :project_error
if not exist src-tauri\Cargo.toml goto :project_error
if not exist src-tauri\tauri.conf.json goto :project_error
if not exist web\index.html goto :project_error
where node.exe >nul 2>&1
if errorlevel 1 goto :node_error
where npm.cmd >nul 2>&1
if errorlevel 1 goto :npm_error

echo.
echo ==============================================
echo       QWEMU MUSIC 1.2.0 - STARTUP
echo ==============================================

echo [INFO] Checking Rust toolchain...
call "%~dp0SETUP_RUST_TOOLCHAIN.bat"
if errorlevel 1 goto :rust_error
set "PATH=%CARGO_HOME%\bin;%PATH%"
set "RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-msvc"

echo.
echo [INFO] Checking Microsoft C++ build environment...
call "%~dp0LOAD_MSVC_ENV.bat"
if errorlevel 1 goto :msvc_error

call :ensure_dependencies
if errorlevel 1 goto :dependency_error

echo.
echo [INFO] Running QWEMU project and regression checks...
call npm.cmd run check
if errorlevel 1 goto :check_error

echo.
echo [INFO] Starting QWEMU desktop application...
call npm.cmd run dev
set "APP_RC=%ERRORLEVEL%"
if not "%APP_RC%"=="0" goto :app_error

echo [OK] QWEMU process exited normally.
popd
exit /b 0

:ensure_dependencies
if not exist node_modules\.bin\tauri.cmd goto :install_dependencies
call npm.cmd ls @tauri-apps/cli --depth=0 >nul 2>&1
if not errorlevel 1 exit /b 0

:install_dependencies
echo.
echo [INFO] Installing JavaScript dependencies...
if exist package-lock.json goto :npm_ci
call npm.cmd install --no-audit --no-fund
if errorlevel 1 exit /b 1
goto :verify_dependencies

:npm_ci
call npm.cmd ci --no-audit --no-fund
if errorlevel 1 exit /b 1

:verify_dependencies
if not exist node_modules\.bin\tauri.cmd exit /b 1
call npm.cmd ls @tauri-apps/cli --depth=0 >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:pushd_error
echo [ERROR] Could not enter the QWEMU project directory.
goto :fail
:project_error
echo [ERROR] Required project files are missing. Extract the complete ZIP first.
goto :fail
:node_error
echo [ERROR] Node.js is missing. Install Node.js LTS and retry.
goto :fail
:npm_error
echo [ERROR] npm.cmd is missing. Repair the Node.js installation.
goto :fail
:rust_error
echo [ERROR] Rust toolchain setup failed. Review the setup message above.
goto :fail
:msvc_error
echo [ERROR] MSVC x64 build tools or Windows SDK are unavailable.
goto :fail
:dependency_error
echo [ERROR] JavaScript dependencies could not be installed or verified.
goto :fail
:check_error
echo [ERROR] Project checks failed. QWEMU was not started.
goto :fail
:app_error
echo [ERROR] Tauri dev process exited with code %APP_RC%.
goto :fail
:fail
echo.
echo [FAILED] QWEMU startup was not completed.
if defined QWEMU_PUSHED popd
pause
exit /b 1
