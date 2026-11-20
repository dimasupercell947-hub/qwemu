# Запуск QWEMU MUSIC 1.2.0 на Windows 10/11

## Первый запуск

1. Полностью распакуй ZIP в обычную локальную папку, например `C:\QWEMU\QWEMU_MUSIC_1.2.0`. Не запускай BAT из окна ZIP.
2. Установи Node.js LTS.
3. Запусти `DIAGNOSE_QWEMU.bat` и дождись окончания диагностики.
4. Если диагностика успешна, запусти `RUN_QWEMU.bat`. Он проверит проект, зависимости и откроет Tauri-приложение.
5. Не открывай `web\index.html` двойным щелчком: без Tauri недоступны Rust API, нативное аудио и импорт.

## Сборка установщиков

Запусти `BUILD_EXE.bat`. Потребуются Rust stable MSVC, Visual Studio 2022 Build Tools с workload **Desktop development with C++**, Windows SDK, Node.js/npm и WebView2 Runtime. Скрипт запускает проверки, Cargo-команды и Tauri packaging, после чего проверяет свежие MSI и NSIS EXE.

## Проблемы запуска

- Rustup `os error 10054`: см. `WINDOWS_BUILD_TROUBLESHOOTING.md`; если toolchain уже установлен полностью, setup BAT использует его локально.
- Ошибка MSVC/SDK: запусти `DIAGNOSE_QWEMU.bat` и приложи `diag_cargo_check.log`.
- Ошибка npm: проверь Node.js LTS и доступность реестра npm, затем запусти BAT повторно.

Старая версия QWEMU и пользовательская папка данных не должны удаляться до успешной проверки новой сборки.
