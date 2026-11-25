# QWEMU MUSIC Desktop

**Нативная ПК-версия QWEMU MUSIC для Windows 10/11.**  
Версия: **1.5.1** · Tauri 2 · Rust · HTML/CSS/JavaScript

## Возможности

- Локальный плеер с импортом MP3, WAV, FLAC, OGG, OGA, M4A и AAC.
- Постоянная медиатека IndexedDB (лимит 2 ГиБ, 512 МиБ на файл).
- Плейлисты, избранное, поиск, повтор, громкость и темы.
- **10-полосный эквалайзер:** 31, 62, 125, 250, 500 Hz, 1, 2, 4, 8 и 16 kHz.
- Шесть пресетов, индивидуальная настройка полос от −12 до +12 dB, обход и сброс.
- Автоматическая компенсация пикового усиления по рассчитанной АЧХ фильтров, чтобы эквалайзер не перегружал цифровой уровень.
- Настройки EQ сохраняются локально; старые 5-полосные настройки автоматически переносятся на 10 полос.
- Реактивная аудиовизуализация с поддержкой системного режима уменьшения анимации.
- Обновлённые кнопки, анимации интерфейса и фирменный векторный логотип.
- Удаление треков освобождает место; очередь воспроизведения учитывает плейлист/избранное.
- Аудио остаётся локальным; облачная авторизация Desktop Edition отключена.
- Установщики Windows NSIS EXE и MSI.

## Сборка на Windows

Требуются Windows 10/11 x64, Node.js 22+, Rust stable MSVC и Visual Studio Build Tools (C++). WebView2 Runtime обычно доступен в Windows; Tauri installer настроен на bootstrapper.

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

GitHub Actions выполняет frontend syntax, unit/smoke tests, Rust formatting и полную сборку Windows NSIS EXE + MSI. Инсталляторы не подписаны цифровым сертификатом и могут вызвать предупреждение SmartScreen.

## Структура

```text
public/              Интерфейс и логика плеера
src-tauri/           Tauri 2 + Rust shell
tests/               Unit и smoke-проверки
.github/workflows/    CI и сборка установщиков
```

## Лицензия

Лицензия проекта пока не назначена. Не распространяй производные сборки как open-source без разрешения автора.
