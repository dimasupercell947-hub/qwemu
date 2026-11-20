# QWEMU MUSIC 1.2.0 INFINITY ULTIMATE — Known issues (BETA)

## Проверенный статус

- Node.js project/regression suite passes in the current Linux environment: see `TEST_REPORT_1.2.0.md`.
- Rust formatting, compilation and unit tests are **not verified** here because `cargo`, `rustc` and `rustfmt` are not installed.
- Windows EXE/MSI packaging, WebView2, Windows system tray and physical audio output are **not verified** in this environment.

## Ограничения, которые остаются

1. **External sources:** supported direct HTTP(S) audio files only. HLS/DASH, DRM, authenticated cookies, redirect chains and non-audio web pages are intentionally unsupported.
2. **Legacy formats:** supported IndexedDB Blob tracks migrate to the native library; unsupported extensions remain in the original IndexedDB store and show an error rather than silently falling back to Web Audio in Tauri.
3. **Browser downloads:** WebView2 site-specific Blob downloads or custom JavaScript download handlers may not surface as ordinary file downloads.
4. **PCM visualizer:** the desktop visualizer remains a UI meter and does not yet consume PCM samples from the Rust worker.
5. **Global media keys:** tray menu controls are present; OS-wide media-key registration is not included.
6. **Data stores:** library files and server account/sync DB are Rust-managed; compatibility metadata and profile preferences still use existing IndexedDB/localStorage keys. They are preserved and not yet retired.
7. **Cache:** direct-source cache is pruned to approximately 1 GiB after playback changes; the active cache file is protected during pruning.
8. **Multi-instance writes:** manifest/cache mutexes serialize writes only within one process. Do not run multiple QWEMU instances against the same app-data directory until a cross-process lock or single-instance guard is added.
9. **Windows QA:** verify device changes, suspend/resume, sleep timer while hidden, tray commands, folder import, drag/drop, direct audio cache, EQ, queue and deletion of missing library entries on Windows 10/11.
10. **Real user data:** no personal SQLite/IndexedDB profile export was included in this archive, so no personal library or account data was migrated or modified during this repair.

## Data safety

- The old working build should remain installed and untouched until the new Windows build and a copy of the user's profile pass tests.
- Corrupt `library.json` is retained as `library.json.corrupt-<id>` when a validated backup is restored.
- `library.json.bak` is not overwritten with a corrupt primary during recovery.
- Missing file records remain in the manifest and can now be removed from the app without deleting arbitrary files outside the library.
- IndexedDB Blob rollback copies remain available after successful migration.
- Backups deliberately exclude passwords, password hashes, session tokens and source audio content unless the specific migration procedure says otherwise.

## AI Music Finder PRO — Stage 4

- Cloud AI requires a valid `OPENAI_API_KEY`, API project access to the selected Responses model and Web Search tool, network access and may incur API charges. The application only checks whether the key variable appears configured; it does not validate credentials until the first request.
- Live OpenAI API calls and actual music-site searches were not executed while preparing Stage 4 because no user API key was available. Model permissions, regional availability, account limits and billing must be checked with the user's API project.
- AI metadata and confidence are best-effort model output, not a guarantee. Review the source page and metadata before import.
- Search is limited to public Web Search results for the selected domain. Pages that are not indexed, dynamic pages requiring an account, robots/anti-bot protected content and external CDN audio URLs may not be found/importable.
- Audio import is intentionally limited to a supported direct public audio URL on the selected host or its subdomains. A page URL, streaming manifest, protected source or external CDN is not converted into an audio file.
- Duplicate detection is a normalized title + artist comparison against the current frontend library. It is a warning/prevention aid, not acoustic fingerprinting; alternate spellings, edits or versions may evade it.
- Search history is stored locally in `localStorage` (up to 12 entries) and is not synchronized or encrypted separately.
- Rust `cargo fmt/check/test`, Windows EXE/MSI, live AI/site tests, tray/background and physical audio tests remain unverified until run on a Windows 10/11 machine with Rust/MSVC/WebView2 and an authorized API key.


## 1.2.0 INFINITY ULTIMATE — подтверждённые ограничения
- Windows EXE/MSI и Rust compilation требуют отдельной проверки в Windows 10/11 с MSVC и Rust stable.
- Глобальные Windows media keys не реализованы.
- Визуализатор не получает PCM напрямую из Rodio audio worker; UI meter нельзя считать анализатором реального сигнала.
- Внешние источники ограничены поддерживаемыми прямыми URL; HLS/DASH, DRM и авторизация источников не заявляются как поддерживаемые.
- Backup переносит метаданные и настройки, но не сами музыкальные файлы.
- Онлайн AI Music Finder требует настроенного и доступного backend/API; локальные рекомендации FLOW не являются генеративным ИИ.

## 1.2.0 BETA — BAT hotfix validation boundary

- All BAT scripts received static regression checks, but they were not executed by Windows `cmd.exe` in the current Linux environment.
- `BUILD_EXE.bat` now expects both installer artifacts because the Tauri configuration enables both `nsis` and `msi`. If the local Windows environment lacks the WiX/MSI prerequisites, the script intentionally reports an MSI packaging failure instead of claiming the release is complete.
- Windows 10/11 validation is still required for Visual Studio detection, Rustup installation, npm dependency installation, `RUN_QWEMU.bat`, `DIAGNOSE_QWEMU.bat` and full installer creation.
