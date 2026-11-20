# QWEMU MUSIC 1.2.0 — аудиосистема

## Desktop playback
All supported music sources in the Tauri app use the native Rust/Rodio worker:
- files in the native library;
- old IndexedDB Blob files after SHA-256 chunk migration;
- direct HTTP(S) audio files downloaded into a bounded disk cache.

Web Audio is retained only for small UI sound effects. It is not a substitute music engine in the Tauri runtime.

## DSP
The 10-band EQ remains in the Rust/Rodio sample pipeline. The worker retains one output device stream and replaces only the active sink when changing tracks.

## Background and timer
Closing the main window hides it in the system tray. Rodio remains alive on the worker thread. The sleep timer is owned by the Rust worker and pauses the active sink even while the main window is hidden.

## Source limitations
- Supported direct sources must be HTTP(S) audio files with supported extensions.
- HLS/DASH playlists, DRM, cookies/authenticated downloads, redirect chains and websites that only expose a page are not downloaded or bypassed.
- A source must resolve to public IP addresses; private/local addresses are rejected.
- Direct source cache is limited to 512 MiB per file and 1 GiB total; old cache entries are pruned.
- UI sound effects remain Web Audio; this does not affect music playback.
