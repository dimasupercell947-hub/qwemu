@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title QWEMU MUSIC - Rust Toolchain Setup

pushd "%~dp0"
if errorlevel 1 goto :pushd_error

if not defined CARGO_HOME set "CARGO_HOME=%USERPROFILE%\.cargo"
if not defined RUSTUP_HOME set "RUSTUP_HOME=%USERPROFILE%\.rustup"
set "PATH=%CARGO_HOME%\bin;%PATH%"
set "RUSTUP_EXE=%CARGO_HOME%\bin\rustup.exe"
set "RUSTUP_INSTALLER=%TEMP%\qwemu-rustup-init.exe"
set "QWEMU_TOOLCHAIN=stable-x86_64-pc-windows-msvc"
set "TOOLCHAIN_LIST=%TEMP%\qwemu-toolchains-%RANDOM%-%RANDOM%.txt"
set "COMPONENT_LIST=%TEMP%\qwemu-components-%RANDOM%-%RANDOM%.txt"
set "TARGET_LIST=%TEMP%\qwemu-targets-%RANDOM%-%RANDOM%.txt"

if exist "%RUSTUP_EXE%" goto :rustup_ready

echo.
echo [INFO] Rustup is not installed. Downloading the official installer (up to 3 attempts)...
where powershell.exe >nul 2>&1
if errorlevel 1 goto :no_powershell
if exist "%RUSTUP_INSTALLER%" del /q "%RUSTUP_INSTALLER%" >nul 2>&1
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $uri='https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe'; $installer=Join-Path $env:TEMP 'qwemu-rustup-init.exe'; for($attempt=1;$attempt -le 3;$attempt++){ try { Invoke-WebRequest -UseBasicParsing -Uri $uri -OutFile $installer; if(Test-Path -LiteralPath $installer){ exit 0 }; throw 'Installer file was not created' } catch { Write-Host ('Download attempt '+$attempt+' failed: '+$_.Exception.Message); if($attempt -lt 3){ Start-Sleep -Seconds 4 } } }; exit 1"
if errorlevel 1 goto :download_failed
if not exist "%RUSTUP_INSTALLER%" goto :download_failed

echo [INFO] Installing rustup without forcing a channel download...
"%RUSTUP_INSTALLER%" -y --default-host x86_64-pc-windows-msvc --default-toolchain none --profile minimal --no-modify-path
set "INSTALL_RC=%ERRORLEVEL%"
del /q "%RUSTUP_INSTALLER%" >nul 2>&1
if not "%INSTALL_RC%"=="0" goto :install_failed

:rustup_ready
if not exist "%RUSTUP_EXE%" goto :rustup_missing
set "PATH=%CARGO_HOME%\bin;%PATH%"

echo.
echo [INFO] Checking the locally installed Rust toolchain...
"%RUSTUP_EXE%" toolchain list > "%TOOLCHAIN_LIST%" 2>&1
if errorlevel 1 goto :toolchain_list_failed
set "TOOLCHAIN_FOUND="
for /f "usebackq tokens=1" %%T in ("%TOOLCHAIN_LIST%") do (
  if /i "%%T"=="%QWEMU_TOOLCHAIN%" set "TOOLCHAIN_FOUND=1"
)
if not defined TOOLCHAIN_FOUND goto :install_stable

if "%QWEMU_UPDATE_RUST_STABLE%"=="1" goto :install_stable
echo [INFO] Local stable toolchain found. Skipping network update to support offline/restricted networks.
goto :stable_ready

:install_stable
echo [INFO] Installing/updating Rust stable (up to 3 attempts)...
call :retry_rustup toolchain install %QWEMU_TOOLCHAIN% --profile minimal
if errorlevel 1 goto :toolchain_failed

:stable_ready
"%RUSTUP_EXE%" component list --installed --toolchain %QWEMU_TOOLCHAIN% > "%COMPONENT_LIST%" 2>&1
if errorlevel 1 goto :component_list_failed
findstr /i /b "rustfmt-" "%COMPONENT_LIST%" >nul
if errorlevel 1 goto :install_rustfmt
echo [INFO] rustfmt is already installed.
goto :rustfmt_ready

:install_rustfmt
echo [INFO] rustfmt is missing. Installing it (up to 3 attempts)...
call :retry_rustup component add rustfmt --toolchain %QWEMU_TOOLCHAIN%
if errorlevel 1 goto :component_failed

:rustfmt_ready
"%RUSTUP_EXE%" target list --installed --toolchain %QWEMU_TOOLCHAIN% > "%TARGET_LIST%" 2>&1
if errorlevel 1 goto :target_list_failed
findstr /i /x "x86_64-pc-windows-msvc" "%TARGET_LIST%" >nul
if errorlevel 1 goto :install_target
echo [INFO] Windows MSVC target is already installed.
goto :target_ready

:install_target
echo [INFO] Windows MSVC target is missing. Installing it (up to 3 attempts)...
call :retry_rustup target add x86_64-pc-windows-msvc --toolchain %QWEMU_TOOLCHAIN%
if errorlevel 1 goto :target_failed

:target_ready
if not exist "%CARGO_HOME%\bin\cargo.exe" goto :cargo_missing
if not exist "%CARGO_HOME%\bin\rustc.exe" goto :rustc_missing
"%RUSTUP_EXE%" run %QWEMU_TOOLCHAIN% cargo --version
if errorlevel 1 goto :verify_failed
"%RUSTUP_EXE%" run %QWEMU_TOOLCHAIN% rustc --version
if errorlevel 1 goto :verify_failed
"%RUSTUP_EXE%" run %QWEMU_TOOLCHAIN% rustfmt --version
if errorlevel 1 goto :verify_failed

echo.
echo [SUCCESS] Rust MSVC toolchain, Cargo, rustc, rustfmt and Windows MSVC target are ready.
echo [INFO] Existing %QWEMU_TOOLCHAIN% installations are reused without contacting static.rust-lang.org.
echo [INFO] Set QWEMU_UPDATE_RUST_STABLE=1 before running this helper to request an update.
echo [INFO] This helper does not change the user's persistent rustup override.
goto :cleanup_success

:retry_rustup
set "RUSTUP_ARGS=%*"
set "RUSTUP_ATTEMPT=0"
:retry_rustup_again
set /a RUSTUP_ATTEMPT+=1 >nul
echo [INFO] rustup attempt %RUSTUP_ATTEMPT% of 3: %RUSTUP_ARGS%
"%RUSTUP_EXE%" %RUSTUP_ARGS%
if not errorlevel 1 exit /b 0
if %RUSTUP_ATTEMPT% GEQ 3 exit /b 1
echo [WARN] rustup request failed. Waiting 4 seconds before retry...
timeout /t 4 /nobreak >nul
goto :retry_rustup_again

:pushd_error
echo [ERROR] Could not enter the QWEMU project directory.
exit /b 1
:no_powershell
echo [ERROR] PowerShell is required to download the official Rust installer.
goto :fail
:download_failed
echo [ERROR] Rustup download failed after 3 attempts.
echo [HINT] The connection to static.rust-lang.org may be blocked or interrupted by a proxy, firewall, antivirus or network policy.
goto :fail
:install_failed
echo [ERROR] rustup installation failed with exit code %INSTALL_RC%.
goto :fail
:rustup_missing
echo [ERROR] rustup.exe is still missing after installation.
goto :fail
:toolchain_list_failed
echo [ERROR] Could not read the locally installed Rust toolchains.
goto :fail
:toolchain_failed
echo [ERROR] Rust MSVC toolchain could not be installed after 3 attempts.
echo [HINT] Check access to https://static.rust-lang.org, proxy/VPN/firewall settings, then rerun this helper.
:fail
if exist "%RUSTUP_INSTALLER%" del /q "%RUSTUP_INSTALLER%" >nul 2>&1
if exist "%TOOLCHAIN_LIST%" del /q "%TOOLCHAIN_LIST%" >nul 2>&1
if exist "%COMPONENT_LIST%" del /q "%COMPONENT_LIST%" >nul 2>&1
if exist "%TARGET_LIST%" del /q "%TARGET_LIST%" >nul 2>&1
popd
exit /b 1
:component_list_failed
echo [ERROR] Could not inspect installed Rust components.
goto :fail
:component_failed
echo [ERROR] rustfmt could not be installed after 3 attempts.
echo [HINT] The selected MSVC toolchain can be reused offline only when rustfmt is already installed.
goto :fail
:target_list_failed
echo [ERROR] Could not inspect installed Rust targets.
goto :fail
:target_failed
echo [ERROR] x86_64-pc-windows-msvc target could not be installed after 3 attempts.
echo [HINT] A missing Windows MSVC target requires network access for this toolchain.
goto :fail
:cargo_missing
echo [ERROR] cargo.exe was not found in %CARGO_HOME%\bin.
goto :fail
:rustc_missing
echo [ERROR] rustc.exe was not found in %CARGO_HOME%\bin.
goto :fail
:verify_failed
echo [ERROR] Rust stable toolchain verification failed.
goto :fail
:cleanup_success
if exist "%TOOLCHAIN_LIST%" del /q "%TOOLCHAIN_LIST%" >nul 2>&1
if exist "%COMPONENT_LIST%" del /q "%COMPONENT_LIST%" >nul 2>&1
if exist "%TARGET_LIST%" del /q "%TARGET_LIST%" >nul 2>&1
popd
exit /b 0
