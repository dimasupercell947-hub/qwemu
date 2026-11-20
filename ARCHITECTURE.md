# Архитектура QWEMU MUSIC 1.2.0

- Desktop shell: Tauri 2.
- Frontend: единственный production root `web/`, HTML/CSS/JavaScript.
- Native backend, filesystem operations, data migration and system integration: Rust.
- Local account/sync API: Rust HTTP API + SQLite.
- Music decoder, output and DSP: Rodio on a dedicated worker thread.
- Imported audio: application data `music/`, native manifest and retained manifest backup.
- Legacy IndexedDB Blob: chunked SHA-256 migration to native files; original Blob remains available for rollback.
- Direct HTTP(S) audio: Rust client with public-address DNS validation, MIME/extension/size checks and bounded cache. Playback remains native Rodio.
- Browser: separate Tauri WebView window; supported downloads are imported into the native library.
- System tray: show/hide/quit and previous/play-pause/next events.

No Electron or Python runtime is required. Existing IndexedDB/localStorage keys remain for profile and metadata compatibility; Rust owns the native file library and SQLite account/sync backend.
