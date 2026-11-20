# QWEMU MUSIC 1.2.0 — Build report (BETA)

## Build identity
- Product: QWEMU MUSIC PC
- Version: 1.2.0 INFINITY ULTIMATE
- Framework: Tauri 2
- Native backend: Rust + Rodio
- Production frontend: `web/` (single source of truth)
- Windows installers configured: NSIS EXE and MSI

## Windows build workflow
`BUILD_EXE.bat` runs project checks, Rust formatting, Cargo check/tests and Tauri packaging. It verifies newly generated MSI and NSIS EXE artifacts recursively under `src-tauri/target/release/bundle`. The exact Windows build must be run on Windows 10/11 with Rust MSVC, Visual Studio C++ Build Tools, Windows SDK, Node.js and WebView2.

## Rust toolchain behavior
`SETUP_RUST_TOOLCHAIN.bat` prefers the exact locally installed `stable-x86_64-pc-windows-msvc` toolchain and required components. It does not force a channel update when the local installation is complete. Downloads remain necessary for a missing first-time toolchain/component. See `WINDOWS_BUILD_TROUBLESHOOTING.md`.

## Verification boundary
The JavaScript regression suite and static BAT checks are run through `npm run check`. These checks do not replace Windows CMD execution, Cargo compilation, real Rodio playback, or actual MSI/EXE installation. Do not mark those platform tests as passed until they have been executed on Windows.
