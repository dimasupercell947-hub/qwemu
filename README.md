# QWEMU MUSIC 1.2.0 — INFINITY ULTIMATE

Премиальный локальный музыкальный плеер для Windows на Tauri 2 + Rust/Rodio + SQLite.

## Запуск

- Windows: `RUN_QWEMU.bat` (проверяет зависимости и запускает приложение).
- Сборка: `BUILD_EXE.bat` (требуются Rust Stable, Node.js и Visual Studio C++ Build Tools).
- Диагностика: `DIAGNOSE_QWEMU.bat`.

## Основные возможности

- Нативное воспроизведение Rust/Rodio, 10-полосный DSP EQ и системный трей.
- Локальная библиотека, очередь, история, избранное, профили и плейлисты.
- AI Music Finder через существующий Rust backend и OpenAI Responses API (нужен свой API key).
- FLOW: Daily, Discovery, Favorites, Underground и Random; рекомендации рассчитываются локально.
- Экспорт выбранного плейлиста в JSON.
- Темы Infinity Appearance.

## Проверки

`npm run check` выполняет статические проверки проекта и JS regression tests. Для полноценной сборки также запусти `cargo fmt --check`, `cargo check`, `cargo test` и `npm run build` на Windows с MSVC.

Основные документы: `INSTALL.md`, `STARTUP_GUIDE_WINDOWS_RU.md`, `ARCHITECTURE.md`, `KNOWN_ISSUES.md`, `BUILD_REPORT_1.2.0.md`, `TEST_REPORT_1.2.0.md` и `WINDOWS_BUILD_TROUBLESHOOTING.md`.

## Структура проекта

- `web/` — единственный исходник production-интерфейса и его локальных ресурсов.
- `src-tauri/` — Rust backend, конфигурация и Windows-иконка.
- `tools/` — автоматические проверки и регрессионные тесты.
- `*.bat` — запуск, диагностика, настройка toolchain и сборка Windows.
- История изменений хранится в `CHANGELOG.md`; устаревшие промежуточные отчёты удалены из дистрибутива.
