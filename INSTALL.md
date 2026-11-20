# Установка QWEMU MUSIC 1.2.0 INFINITY ULTIMATE (BETA)

1. Установи Node.js LTS.
2. Установи Rust stable для `x86_64-pc-windows-msvc`.
3. Установи Visual Studio 2022 Build Tools с workload **Desktop development with C++** и Windows SDK.
4. Убедись, что установлен WebView2 Runtime.
5. Распакуй ZIP полностью в отдельную папку; не запускай BAT внутри архива и не распаковывай поверх старой версии.
6. Запусти `DIAGNOSE_QWEMU.bat`.
7. Если диагностика успешна, запусти `RUN_QWEMU.bat`.
8. Для сборки установщиков запусти `BUILD_EXE.bat`.

Сначала проверяй обновление на копии пользовательского профиля. Старая версия и пользовательские данные не должны удаляться до проверки новой сборки. Подробные решения проблем с сетью Rustup/MSVC см. в `WINDOWS_BUILD_TROUBLESHOOTING.md`.

Для разработки: `npm install`, затем `npm run check`; после этого на Windows выполни `cargo fmt --check`, `cargo check`, `cargo test` и `npm run build`.
