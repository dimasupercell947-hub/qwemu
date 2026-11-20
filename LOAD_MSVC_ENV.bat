@echo off
rem Intentionally no SETLOCAL: VsDevCmd environment changes must reach the caller.
chcp 65001 >nul

rem Reuse the current environment only when all required x64 tools are actually present.
if /i "%VSCMD_ARG_TGT_ARCH%"=="x64" goto :verify_existing
goto :locate_vs

:locate_vs
set "QWEMU_VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%QWEMU_VSWHERE%" goto :verify_external_environment
set "QWEMU_VSROOT="
for /f "usebackq tokens=*" %%I in (`"%QWEMU_VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "QWEMU_VSROOT=%%I"
if not defined QWEMU_VSROOT goto :missing_cpp

set "QWEMU_VSDEVCMD=%QWEMU_VSROOT%\Common7\Tools\VsDevCmd.bat"
if not exist "%QWEMU_VSDEVCMD%" goto :missing_vsdevcmd

echo [INFO] Initializing Visual Studio x64 compiler environment...
call "%QWEMU_VSDEVCMD%" -no_logo -arch=x64 -host_arch=x64
if errorlevel 1 goto :vsdevcmd_failed

goto :verify_loaded

:verify_existing
where cl.exe >nul 2>&1
if errorlevel 1 goto :locate_vs
where link.exe >nul 2>&1
if errorlevel 1 goto :locate_vs
if not defined WindowsSdkDir goto :locate_vs
if not defined WindowsSDKVersion goto :locate_vs
if not defined INCLUDE goto :locate_vs
if not defined LIB goto :locate_vs
call :verify_sdk_files
if errorlevel 1 goto :locate_vs
goto :success

:verify_external_environment
where cl.exe >nul 2>&1
if errorlevel 1 goto :missing_vs
where link.exe >nul 2>&1
if errorlevel 1 goto :missing_link
if not defined WindowsSdkDir goto :missing_sdk
if not defined WindowsSDKVersion goto :missing_sdk
if not defined INCLUDE goto :missing_sdk
if not defined LIB goto :missing_sdk
call :verify_sdk_files
if errorlevel 1 goto :missing_sdk
if defined VSCMD_ARG_TGT_ARCH if /i not "%VSCMD_ARG_TGT_ARCH%"=="x64" goto :wrong_arch
echo [OK] Existing MSVC compiler and Windows SDK environment detected.
goto :success

:verify_loaded
where cl.exe >nul 2>&1
if errorlevel 1 goto :compiler_missing
where link.exe >nul 2>&1
if errorlevel 1 goto :missing_link
if not defined WindowsSdkDir goto :missing_sdk
if not defined WindowsSDKVersion goto :missing_sdk
if not defined INCLUDE goto :missing_sdk
if not defined LIB goto :missing_sdk
if /i not "%VSCMD_ARG_TGT_ARCH%"=="x64" goto :wrong_arch
call :verify_sdk_files
if errorlevel 1 goto :missing_sdk
echo [OK] MSVC x64 compiler, linker and Windows SDK are ready.
echo [INFO] Windows SDK: %WindowsSdkDir%
goto :success

:verify_sdk_files
set "QWEMU_SDK_ROOT=%WindowsSdkDir%"
set "QWEMU_SDK_VERSION=%WindowsSDKVersion%"
if not defined QWEMU_SDK_ROOT exit /b 1
if not defined QWEMU_SDK_VERSION exit /b 1
if not "%QWEMU_SDK_ROOT:~-1%"=="\" set "QWEMU_SDK_ROOT=%QWEMU_SDK_ROOT%\"
if not "%QWEMU_SDK_VERSION:~-1%"=="\" set "QWEMU_SDK_VERSION=%QWEMU_SDK_VERSION%\"
if not exist "%QWEMU_SDK_ROOT%Include\%QWEMU_SDK_VERSION%um\Windows.h" exit /b 1
if not exist "%QWEMU_SDK_ROOT%Lib\%QWEMU_SDK_VERSION%um\x64\kernel32.lib" exit /b 1
if not exist "%QWEMU_SDK_ROOT%Lib\%QWEMU_SDK_VERSION%ucrt\x64\ucrt.lib" exit /b 1
set "QWEMU_SDK_ROOT="
set "QWEMU_SDK_VERSION="
exit /b 0

:missing_vs
echo [ERROR] Visual Studio Build Tools were not found.
echo Install Visual Studio 2022 Build Tools with Desktop development with C++.
goto :failure
:missing_cpp
echo [ERROR] Visual Studio is installed, but the MSVC C++ x64 component is missing.
echo Add the Desktop development with C++ workload in Visual Studio Installer.
goto :failure
:missing_vsdevcmd
echo [ERROR] VsDevCmd.bat was not found in the Visual Studio installation.
goto :failure
:vsdevcmd_failed
echo [ERROR] VsDevCmd could not initialize the x64 compiler environment.
goto :failure
:compiler_missing
echo [ERROR] cl.exe is unavailable after initializing Visual Studio.
goto :failure
:missing_link
echo [ERROR] link.exe is unavailable. Install the MSVC x64 build tools.
goto :failure
:missing_sdk
echo [ERROR] Windows SDK headers/libraries or INCLUDE/LIB paths are unavailable. Install a Windows 10/11 SDK.
goto :failure
:wrong_arch
echo [ERROR] The active MSVC target architecture is not x64.
echo Close this console and run QWEMU from a normal terminal, or initialize an x64 Developer Prompt.
goto :failure
:success
set "QWEMU_VSWHERE="
set "QWEMU_VSROOT="
set "QWEMU_VSDEVCMD="
set "QWEMU_SDK_ROOT="
set "QWEMU_SDK_VERSION="
exit /b 0
:failure
set "QWEMU_VSWHERE="
set "QWEMU_VSROOT="
set "QWEMU_VSDEVCMD="
set "QWEMU_SDK_ROOT="
set "QWEMU_SDK_VERSION="
exit /b 1
