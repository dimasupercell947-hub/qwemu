# История изменений QWEMU MUSIC Desktop

## 1.7.0 — Lyrics, Background & Link Update

### Новое
- Тексты песен: прикрепление TXT/LRC, редактирование и ограничение размера; LRC временные метки синхронизируют подсветку и seek.
- Фоновое воспроизведение по умолчанию, ручной переключатель и MediaSession actions (если поддерживаются).
- Добавление музыки по ссылке с проверкой HTTPS, разрешённых музыкальных сайтов и расширений прямых аудиофайлов.
- Ссылки на платформы сохраняются как закладки; прямые audio links могут воспроизводиться как потоки. Загрузка/извлечение защищённого контента не реализовано.
- QWEMU PLUS — демонстрационный экран (явно помечен DEMO, без подписок, платежей или реального каталога).
- Автоматическая проверка обновлений при запуске через CDN-манифест и резервный GitHub Releases API; баннер с переходом к установщикам.
- Расширены аудио-форматы, обновлены кнопки, логотип и дизайн плеера.

### Безопасность и совместимость
- HTTPS only, reject credential URLs, local addresses, unknown music-site domains and unsupported media extensions.
- LRC/TXT лимит 100 KiB, текст хранится локально.
- WebView2/кодеки определяют реальную поддержку некоторых контейнеров/кодеков.
- Проверка обновлений только по публичному GitHub API/manifest, без автозагрузки.

### Проверки
- Unit-тесты для LRC parsing, URL classification, audio format whitelist и IndexedDB link metadata.
- Smoke checks расширены.
- CI: frontend checks, unit/smoke, Rust formatting, Windows EXE/MSI build.

- Добавлен GitHub Actions release workflow: публикация Windows EXE/MSI по тегу `v*` и обновление version manifest.
- Обновлён блок горячих клавиш, подписи тем, анимационный чекбокс, единый coral range UI и симметричная панель управления без кнопки Stop.
