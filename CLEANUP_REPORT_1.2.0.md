# QWEMU MUSIC 1.2.0 — очистка дистрибутива

## Принцип
Оставлены только файлы, необходимые для запуска, сборки, проверки, поддержки и понимания текущей версии. Production frontend имеет один источник истины: `web/`.

## Удалено
- Корневой `index.html`, дублировавший `web/index.html` побайтно.
- Корневая папка `assets/`, дублировавшая `web/assets/`.
- Корневой `superupdate-061.js`, дублировавший `web/superupdate-061.js`.
- Неиспользуемые AURA-theme CSS и AURA logo assets, не подключённые к production frontend.
- Неиспользуемый PNG-дубликат логотипа; production UI использует SVG.
- Исторические BUILD/TEST/UPDATE отчёты промежуточных версий, заменённые `CHANGELOG.md` и актуальными отчётами 1.2.0.
- Старые hotfix-отчёты, сведённые в `WINDOWS_BUILD_TROUBLESHOOTING.md` и `BUILD_REPORT_1.2.0.md`.
- Устаревший отдельный AURA regression script; проверки текущего production интерфейса выполняются оставшимися тестами.

## Сохранено
- Все пять BAT-файлов и их актуальные проверки.
- Rust/Tauri исходники, конфигурации, capability manifest и Windows icon.
- Единственный production frontend и все подключённые локальные assets.
- Node regression suite и скрипты аудита.
- Актуальные инструкции, архитектурные документы, политика, privacy/legal notes, changelog, known issues, release/build/test reports.
- Пользовательские данные в архив не добавлялись и не изменялись.

## Проверки после очистки
- `npm run check` — PASS.
- BAT static audit — 95/95.
- Project checker — 116/116.
- Deep checker — 104/104.
- Regression suites: migration, native playback routing, Super Update, market redesign, release metadata, AI Music Finder, startup guard, Infinity Evolution/Experience, backup core — PASS.
- JS syntax checks for project scripts and embedded UI blocks — PASS.
- JSON/TOML parse and archive integrity — checked during packaging.

Windows CMD execution, Cargo build/tests, MSI/EXE packaging and physical audio QA still require Windows 10/11 with the relevant toolchain and hardware.
