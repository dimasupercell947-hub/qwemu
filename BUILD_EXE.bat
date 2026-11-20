@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title QWEMU MUSIC 1.2.0 - Windows Release Build

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
echo       QWEMU MUSIC 1.2.0 - RELEASE BUILD
echo ==============================================

echo [INFO] Checking Rust toolchain...
call "%~dp0SETUP_RUST_TOOLCHAIN.bat"
if errorlevel 1 goto :rust_error
set "PATH=%CARGO_HOME%\bin;%PATH%"
set "RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-msvc"

echo.
echo [INFO] Loading MSVC x64 and Windows SDK environment...
call "%~dp0LOAD_MSVC_ENV.bat"
if errorlevel 1 goto :msvc_error

call :ensure_dependencies
if errorlevel 1 goto :dependency_error

echo.
echo [1/5] Frontend and project regression checks...
call npm.cmd run check
if errorlevel 1 goto :check_error

echo.
echo [2/5] Rust formatting check...
call npm.cmd run check:rust:fmt
if errorlevel 1 goto :rust_fmt_error

echo.
echo [3/5] Rust compilation check...
call npm.cmd run check:rust
if errorlevel 1 goto :rust_check_error

echo.
echo [4/5] Rust unit tests...
call npm.cmd run test:rust
if errorlevel 1 goto :rust_test_error

echo.
echo [5/5] Creating Windows installers...
set "BUNDLE_DIR=src-tauri\target\release\bundle"
set "QWEMU_BUNDLE_DIR=%CD%\%BUNDLE_DIR%"
set "QWEMU_BUILD_STAMP=%TEMP%\qwemu-build-start-%RANDOM%-%RANDOM%.txt"
where powershell.exe >nul 2>&1
if errorlevel 1 goto :powershell_error
powershell.exe -NoLogo -NoProfile -Command "$ErrorActionPreference='Stop'; [DateTime]::UtcNow.Ticks.ToString([Globalization.CultureInfo]::InvariantCulture) | Set-Content -LiteralPath $env:QWEMU_BUILD_STAMP -Encoding ascii -NoNewline"
if errorlevel 1 goto :build_stamp_error

call npm.cmd run build
set "BUILD_RC=%ERRORLEVEL%"
if not "%BUILD_RC%"=="0" goto :build_error
if not exist "%BUNDLE_DIR%" goto :bundle_missing

rem Validate that both installers were written by THIS build, not left by an older run.
powershell.exe -NoLogo -NoProfile -Command "$ErrorActionPreference='Stop'; $stampTicks=[Int64]::Parse((Get-Content -Raw -LiteralPath $env:QWEMU_BUILD_STAMP).Trim(), [Globalization.CultureInfo]::InvariantCulture); $files=@(Get-ChildItem -LiteralPath $env:QWEMU_BUNDLE_DIR -File -Recurse); $msi=@($files | Where-Object { $_.Extension -ieq '.msi' -and $_.LastWriteTimeUtc.Ticks -ge $stampTicks }); $nsis=@($files | Where-Object { $_.Extension -ieq '.exe' -and $_.LastWriteTimeUtc.Ticks -ge $stampTicks }); if($msi.Count -eq 0){ Write-Error 'This build did not produce a fresh MSI installer.'; exit 11 }; if($nsis.Count -eq 0){ Write-Error 'This build did not produce a fresh NSIS EXE installer.'; exit 12 }; $msi | ForEach-Object { Write-Output ('MSI: '+$_.FullName) }; $nsis | ForEach-Object { Write-Output ('NSIS: '+$_.FullName) }"
set "ARTIFACT_RC=%ERRORLEVEL%"
if exist "%QWEMU_BUILD_STAMP%" del /q "%QWEMU_BUILD_STAMP%" >nul 2>&1
if not "%ARTIFACT_RC%"=="0" goto :artifact_stale

rem Tauri stores installers in target-specific subdirectories (msi\ and nsis\).
set "MSI_FOUND="
set "NSIS_FOUND="
for /r "%BUNDLE_DIR%" %%F in (*.msi) do if exist "%%~fF" set "MSI_FOUND=1"
for /r "%BUNDLE_DIR%" %%F in (*.exe) do if exist "%%~fF" set "NSIS_FOUND=1"
if not defined MSI_FOUND goto :msi_missing
if not defined NSIS_FOUND goto :nsis_missing

echo.
echo [SUCCESS] Both configured installer types were created:
echo.
echo MSI installers:
for /r "%BUNDLE_DIR%" %%F in (*.msi) do if exist "%%~fF" echo   %%~fF
echo.
echo NSIS installers:
for /r "%BUNDLE_DIR%" %%F in (*.exe) do if exist "%%~fF" echo   %%~fF
explorer.exe "%CD%\%BUNDLE_DIR%"
if defined QWEMU_BUILD_STAMP if exist "%QWEMU_BUILD_STAMP%" del /q "%QWEMU_BUILD_STAMP%" >nul 2>&1
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
echo [ERROR] Rust stable toolchain setup failed.
goto :fail
:msvc_error
echo [ERROR] MSVC x64 Build Tools or Windows SDK are unavailable.
goto :fail
:dependency_error
echo [ERROR] JavaScript dependencies could not be installed or verified.
goto :fail
:check_error
echo [ERROR] Frontend/project checks failed.
goto :fail
:rust_fmt_error
echo [ERROR] Rust formatting check failed. Review cargo fmt output.
goto :fail
:rust_check_error
echo [ERROR] Rust compilation check failed. Review cargo check output.
goto :fail
:rust_test_error
echo [ERROR] Rust unit tests failed.
goto :fail
:build_error
echo [ERROR] Tauri build failed with exit code %BUILD_RC%.
goto :fail
:powershell_error
echo [ERROR] Windows PowerShell is required to verify fresh installer artifacts.
goto :fail
:build_stamp_error
echo [ERROR] Could not create a timestamp marker before the build.
goto :fail
:artifact_stale
echo [ERROR] Fresh MSI and NSIS artifacts from this build could not be verified.
echo [HINT] Existing installers from older builds are deliberately not accepted as proof of success.
goto :fail
:bundle_missing
echo [ERROR] Tauri returned success but the bundle directory is missing.
goto :fail
:msi_missing
echo [ERROR] MSI installer was not found recursively under %BUNDLE_DIR%.
goto :fail
:nsis_missing
echo [ERROR] NSIS EXE installer was not found recursively under %BUNDLE_DIR%.
goto :fail
:fail
echo.
echo [FAILED] Windows release build did not complete successfully.
if defined QWEMU_BUILD_STAMP if exist "%QWEMU_BUILD_STAMP%" del /q "%QWEMU_BUILD_STAMP%" >nul 2>&1
if defined QWEMU_PUSHED popd
pause
exit /b 1
