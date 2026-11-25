# QWEMU MUSIC Desktop

**Нативная ПК-версия QWEMU MUSIC для Windows 10/11.**  
Версия: **1.5.1** · Tauri 2 · Rust · HTML/CSS/JavaScript

## Возможности

- Локальный плеер с импортом MP3, WAV, FLAC, OGG, OGA, M4A и AAC.
- Постоянная медиатека IndexedDB (лимит 2 ГиБ, 512 МиБ на файл).
- Плейлисты, избранное, поиск, повтор, громкость и темы.
- **5-полосный эквалайзер** (60 Hz, 250 Hz, 1 kHz, 4 kHz, 12 kHz), пресеты и сохранение настроек.
- **Реактивная аудиовизуализация** в плеере.
- Обновлённые кнопки, анимации интерфейса и фирменный векторный логотип.
- Удаление треков освобождает место; очередь воспроизведения учитывает плейлист/избранное.
- Аудио остаётся локальным; облачная авторизация Desktop Edition отключена.
- Установщики Windows NSIS EXE и MSI.

## Сборка на Windows

Требуются Windows 10/11 x64, Node.js 22+, Rust stable MSVC и Visual Studio Build Tools (C++). WebView2 Runtime обычно встроен в Windows; Tauri installer настроен на bootstrapper.

1. Установи Rust через rustup с MSVC toolchain.
2. Установи Visual Studio Build Tools (Desktop development with C++).
3. Запусти `run.bat` для разработки или `build.bat` для установщиков.
4. `check.bat` запускает frontend checks и тесты.

CLI Tauri закреплён на 2.12.6. Результаты сборки: `src-tauri/target/release/bundle/`.

Для ручной работы из PowerShell: `npm install --no-package-lock`, затем `npm run tauri -- dev --config src-tauri/tauri.conf.json` или `npm run tauri -- build --config src-tauri/tauri.conf.json`.

Поддерживаются расширения `.mp3`, `.wav`, `.flac`, `.ogg`, `.oga`, `.m4a`, `.aac`. AIFF не принимается, так как WebView2 не гарантирует декодирование.

## Локальные данные и приватность

Музыка и настройки хранятся локально в WebView/IndexedDB. Файлы не отправляются в интернет. Не очищай данные приложения, чтобы не потерять медиатеку. Web Edition и её cloud sync — отдельный продукт.

## CI

GitHub Actions выполняет frontend syntax, unit/smoke tests, Rust formatting и полную сборку Windows NSIS EXE + MSI. Инсталляторы не подписаны цифровым сертификатом и могут вызвать SmartScreen.

## Структура

```
public/              UI and app logic
src-tauri/           Tauri/Rust shell
tests/               unit and smoke tests
.github/workflows/    CI and installer pipelines
```

## Лицензия

Лицензия проекта пока не назначена. Не распространяй производные сборки как open-source без разрешения автора.
