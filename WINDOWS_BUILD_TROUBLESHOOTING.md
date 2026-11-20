# Windows: запуск, диагностика и сборка QWEMU MUSIC 1.2.0

## Правильный порядок

1. Распакуйте весь архив в отдельную папку. Не запускайте BAT внутри ZIP.
2. Запустите `DIAGNOSE_QWEMU.bat`.
3. Если диагностика прошла, запустите `RUN_QWEMU.bat`.
4. Для создания установщиков запустите `BUILD_EXE.bat`.

## Требования

- Windows 10 или Windows 11 x64.
- Node.js LTS и npm.
- Rust stable для `x86_64-pc-windows-msvc`.
- Visual Studio 2022 Build Tools / Visual Studio с компонентом Desktop development with C++.
- Windows 10/11 SDK и WebView2 Runtime.

## Ошибки Rustup / os error 10054

BAT сначала проверяет локально установленный `stable-x86_64-pc-windows-msvc`, `rustfmt` и target. Уже установленная полная конфигурация переиспользуется без принудительной синхронизации канала. Если компонентов действительно нет, Rustup должен скачать их с `static.rust-lang.org`; при сетевом сбое проверьте соединение, proxy/VPN и firewall, затем повторите команду. Не отключайте проверку TLS и не скачивайте rustup-init с посторонних сайтов.

Чтобы вручную запросить обновление установленного toolchain, используйте `QWEMU_UPDATE_RUST_STABLE=1` в окружении перед запуском setup BAT.

## Что собирать

`BUILD_EXE.bat` выполняет Node-проверки, `cargo fmt --check`, `cargo check`, `cargo test` и `tauri build`. В конфигурации включены оба формата установщика: MSI (WiX) и NSIS EXE. Итоговые файлы ищутся рекурсивно в `src-tauri\target\release\bundle`. Скрипт не считает сборку успешной, если свежие MSI и NSIS EXE не созданы.

## Диагностический файл

После `DIAGNOSE_QWEMU.bat` приложите `diag_cargo_check.log` к сообщению об ошибке. Перед отправкой проверьте, что в нём нет секретов или персональных путей, которыми вы не хотите делиться.

## Границы проверок

Node regression suite и статические BAT-проверки не заменяют запуск Windows CMD, `cargo check/test`, реальное воспроизведение через аудиоустройство и проверку MSI/EXE на Windows 10/11. Эти проверки должны быть выполнены на целевой системе.
