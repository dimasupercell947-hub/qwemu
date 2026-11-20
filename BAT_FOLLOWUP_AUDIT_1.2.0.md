# QWEMU MUSIC 1.2.0 — BAT follow-up audit

## Изменения

1. `DIAGNOSE_QWEMU.bat`: все Cargo-команды теперь вызываются через `rustup.exe run stable-x86_64-pc-windows-msvc`.
2. `DIAGNOSE_QWEMU.bat`: при ошибке инициализации MSVC/Windows SDK форматирование Rust может быть проверено отдельно, но `cargo check` и `cargo test` пропускаются с явным статусом SKIPPED, а не запускаются в заведомо неполном окружении.
3. `DIAGNOSE_QWEMU.bat`: в лог записываются версия MSVC (`cl.exe /Bv`), WindowsSDKVersion, INCLUDE и LIB.
4. `BUILD_EXE.bat`: маркер времени сборки теперь хранится как UTC ticks и разбирается с invariant culture; сравнение с артефактами также выполняется по UTC ticks. Это устраняет зависимость от формата даты/времени Windows и локали.
5. `tools/check-bat-files.mjs`: добавлены регрессионные проверки новых сценариев.

## Проверки, реально выполненные в текущей среде

- `npm run check`: PASS.
- BAT static audit: 97/97.
- Main project checks: 116/116.
- Deep update checks: 104/104.
- AI Music Finder: 14/14.
- AI Music Finder PRO: 26/26.
- Startup runtime guard: 4/4.
- Infinity Evolution Stage 1: 20/20.
- Infinity Experience: 16/16.
- Backup core: 11/11.
- BAT encoding: ASCII, no BOM, CRLF for all five files.
- ZIP integrity: verified after packaging.

## Ограничения

Среда выполнения — Linux. Windows `cmd.exe`, PowerShell 5.1, Visual Studio `VsDevCmd`, MSVC, Windows SDK и Rust Windows target здесь не запускались. Поэтому реальное выполнение BAT на Windows, `cargo check/test` для Windows и создание MSI/NSIS пока не подтверждены. Если после установки этого архива BAT всё ещё выдаёт ошибку, нужен свежий `diag_cargo_check.log` и полный вывод `BUILD_EXE.bat`; не следует считать статические проверки эквивалентом запуска в Windows.
