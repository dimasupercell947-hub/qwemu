@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title QWEMU MUSIC 1.2.0 - Diagnostics

pushd "%~dp0"
if errorlevel 1 goto :pushd_error
set "QWEMU_PUSHED=1"
if not defined CARGO_HOME set "CARGO_HOME=%USERPROFILE%\.cargo"
if not defined RUSTUP_HOME set "RUSTUP_HOME=%USERPROFILE%\.rustup"
set "QWEMU_TOOLCHAIN=stable-x86_64-pc-windows-msvc"
rem Pin every rustup proxy invocation to the same toolchain used by RUN and BUILD.
set "RUSTUP_TOOLCHAIN=%QWEMU_TOOLCHAIN%"
set "PATH=%CARGO_HOME%\bin;%PATH%"
set "LOG=%CD%\diag_cargo_check.log"
set "FILES_RC=0"
set "NODE_RC=0"
set "NPM_RC=0"
set "FRONT_RC=0"
set "RUSTUP_RC=0"
set "CARGO_RC=0"
set "FMT_RC=0"
set "TEST_RC=0"
set "MSVC_RC=0"

>"%LOG%" echo QWEMU MUSIC 1.2.0 diagnostics - %DATE% %TIME%
>>"%LOG%" echo Project: %CD%
>>"%LOG%" echo.
call :section "Project files"
call :check_file "package.json"
if errorlevel 1 set "FILES_RC=1"
call :check_file "src-tauri\Cargo.toml"
if errorlevel 1 set "FILES_RC=1"
call :check_file "src-tauri\tauri.conf.json"
if errorlevel 1 set "FILES_RC=1"
call :check_file "web\index.html"
if errorlevel 1 set "FILES_RC=1"
call :check_file "web\assets"
if errorlevel 1 set "FILES_RC=1"

call :section "Node.js and npm"
where node.exe >nul 2>&1
if errorlevel 1 goto :node_missing
where node.exe >>"%LOG%" 2>&1
node.exe --version >>"%LOG%" 2>&1
if errorlevel 1 set "NODE_RC=1"
goto :node_done
:node_missing
set "NODE_RC=9009"
>>"%LOG%" echo [MISSING] node.exe not found in PATH.
:node_done
where npm.cmd >nul 2>&1
if errorlevel 1 goto :npm_missing
where npm.cmd >>"%LOG%" 2>&1
call npm.cmd --version >>"%LOG%" 2>&1
if errorlevel 1 set "NPM_RC=1"
goto :npm_done
:npm_missing
set "NPM_RC=9009"
>>"%LOG%" echo [MISSING] npm.cmd not found in PATH.
:npm_done

call :section "Rust toolchain"
where rustup.exe >nul 2>&1
if errorlevel 1 goto :rustup_missing
where rustup.exe >>"%LOG%" 2>&1
call rustup.exe toolchain list >>"%LOG%" 2>&1
if errorlevel 1 set "RUSTUP_RC=1"
>>"%LOG%" echo Required toolchain: %QWEMU_TOOLCHAIN%
>>"%LOG%" echo RUSTUP_TOOLCHAIN=%RUSTUP_TOOLCHAIN%
call rustup.exe run %QWEMU_TOOLCHAIN% rustc -Vv >>"%LOG%" 2>&1
if errorlevel 1 set "RUSTUP_RC=1"
call rustup.exe run %QWEMU_TOOLCHAIN% cargo -V >>"%LOG%" 2>&1
if errorlevel 1 set "CARGO_RC=1"
call rustup.exe run %QWEMU_TOOLCHAIN% rustfmt --version >>"%LOG%" 2>&1
if errorlevel 1 set "RUSTUP_RC=1"
goto :rustup_done
:rustup_missing
set "RUSTUP_RC=9009"
set "CARGO_RC=9009"
>>"%LOG%" echo [MISSING] rustup.exe not found in PATH.
:rustup_done

call :section "Visual Studio, MSVC and Windows SDK"
call "%~dp0LOAD_MSVC_ENV.bat" >>"%LOG%" 2>&1
set "MSVC_RC=%ERRORLEVEL%"
where cl.exe >>"%LOG%" 2>&1
if not errorlevel 1 cl.exe /Bv >>"%LOG%" 2>&1
where link.exe >>"%LOG%" 2>&1
>>"%LOG%" echo WindowsSdkDir=%WindowsSdkDir%
>>"%LOG%" echo WindowsSDKVersion=%WindowsSDKVersion%
>>"%LOG%" echo VSCMD_ARG_TGT_ARCH=%VSCMD_ARG_TGT_ARCH%
>>"%LOG%" echo INCLUDE=%INCLUDE%
>>"%LOG%" echo LIB=%LIB%

call :section "Frontend regression checks"
if not "%NODE_RC%"=="0" goto :frontend_unavailable
if not "%NPM_RC%"=="0" goto :frontend_unavailable
call npm.cmd run check >>"%LOG%" 2>&1
set "FRONT_RC=%ERRORLEVEL%"
goto :frontend_done
:frontend_unavailable
set "FRONT_RC=9009"
>>"%LOG%" echo [SKIPPED] Node.js or npm is unavailable.
:frontend_done

call :section "Rust formatting, compilation and tests"
if not "%CARGO_RC%"=="0" goto :cargo_unavailable
call rustup.exe run %QWEMU_TOOLCHAIN% cargo fmt --check --manifest-path "src-tauri\Cargo.toml" >>"%LOG%" 2>&1
set "FMT_RC=%ERRORLEVEL%"
if not "%MSVC_RC%"=="0" goto :rust_compile_unavailable
call rustup.exe run %QWEMU_TOOLCHAIN% cargo check --manifest-path "src-tauri\Cargo.toml" >>"%LOG%" 2>&1
set "CARGO_RC=%ERRORLEVEL%"
call rustup.exe run %QWEMU_TOOLCHAIN% cargo test --manifest-path "src-tauri\Cargo.toml" >>"%LOG%" 2>&1
set "TEST_RC=%ERRORLEVEL%"
goto :cargo_done
:cargo_unavailable
set "FMT_RC=9009"
set "CARGO_RC=9009"
set "TEST_RC=9009"
>>"%LOG%" echo [SKIPPED] The pinned Rust MSVC toolchain is unavailable.
goto :cargo_done
:rust_compile_unavailable
set "CARGO_RC=9009"
set "TEST_RC=9009"
>>"%LOG%" echo [SKIPPED] Cargo check/test require a valid MSVC x64 and Windows SDK environment. Fix the MSVC section and rerun diagnostics.
:cargo_done

call :section "Summary"
echo Log file: %LOG%
echo Project files exit code: %FILES_RC%
echo Node.js exit code: %NODE_RC%
echo npm exit code: %NPM_RC%
echo Frontend checks exit code: %FRONT_RC%
echo Rustup/rustc exit code: %RUSTUP_RC%
echo MSVC setup exit code: %MSVC_RC%
echo Cargo fmt exit code: %FMT_RC%
echo Cargo check exit code: %CARGO_RC%
echo Cargo test exit code: %TEST_RC%
>>"%LOG%" echo Project files exit code: %FILES_RC%
>>"%LOG%" echo Node.js exit code: %NODE_RC%
>>"%LOG%" echo npm exit code: %NPM_RC%
>>"%LOG%" echo Frontend checks exit code: %FRONT_RC%
>>"%LOG%" echo Rustup/rustc exit code: %RUSTUP_RC%
>>"%LOG%" echo MSVC setup exit code: %MSVC_RC%
>>"%LOG%" echo Cargo fmt exit code: %FMT_RC%
>>"%LOG%" echo Cargo check exit code: %CARGO_RC%
>>"%LOG%" echo Cargo test exit code: %TEST_RC%

if not "%FILES_RC%"=="0" goto :failed
if not "%NODE_RC%"=="0" goto :failed
if not "%NPM_RC%"=="0" goto :failed
if not "%FRONT_RC%"=="0" goto :failed
if not "%RUSTUP_RC%"=="0" goto :failed
if not "%MSVC_RC%"=="0" goto :failed
if not "%FMT_RC%"=="0" goto :failed
if not "%CARGO_RC%"=="0" goto :failed
if not "%TEST_RC%"=="0" goto :failed

echo.
echo [SUCCESS] All diagnostic checks passed.
echo Full output: %LOG%
pause
popd
exit /b 0

:check_file
if exist "%~1" (
  echo [OK] %~1
  >>"%LOG%" echo [OK] %~1
  exit /b 0
)
echo [MISSING] %~1
>>"%LOG%" echo [MISSING] %~1
exit /b 1

:section
echo.
echo ===== %~1 =====
>>"%LOG%" echo.
>>"%LOG%" echo ===== %~1 =====
exit /b 0

:pushd_error
echo [ERROR] Could not enter the QWEMU project directory.
exit /b 1
:failed
echo.
echo [FAILED] One or more diagnostic checks failed. Send diag_cargo_check.log for analysis.
echo Log file: %LOG%
pause
if defined QWEMU_PUSHED popd
exit /b 1
