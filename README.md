# QWEMU MUSIC Desktop

**Нативная ПК-версия QWEMU MUSIC для Windows 10/11.**  
Версия: **1.5.0** · Tauri 2 · Rust · HTML/CSS/JavaScript

## Возможности

- Локальный музыкальный плеер с импортом MP3, WAV, FLAC, OGG, OGA, M4A и AAC.
- Сохранение импортированной медиатеки между запусками приложения через IndexedDB (лимит 2 ГиБ, 512 МиБ на файл).
- Плейлисты, избранное, поиск, повтор, громкость и темы оформления.
- Удаление треков с освобождением места в хранилище.
- Очередь воспроизведения учитывает текущий плейлист или избранное.
- Воспроизведение локальных файлов без отправки аудио на сервер.
- Оконное приложение Windows с установщиками NSIS (.exe) и MSI.
- Проверки Rust и frontend-кода в GitHub Actions.

## Сборка на Windows

Требуются Windows 10/11 x64, Node.js 22+, Rust stable с MSVC toolchain и Visual Studio Build Tools (C++ build tools). WebView2 Runtime обычно уже установлен в Windows 10/11; установщик Tauri настроен на загрузку bootstrapper при необходимости.

1. Установи Rust с https://rustup.rs/ и выбери MSVC toolchain.
2. Установи Visual Studio Build Tools с компонентом **Desktop development with C++**.
3. Открой папку проекта.
4. Запусти `run.bat` для разработки или `build.bat` для сборки установщиков.

Команды вручную из корня репозитория:

```powershell
npm install --no-package-lock
npm run tauri -- dev --config src-tauri/tauri.conf.json
npm run tauri -- build --config src-tauri/tauri.conf.json
```

Tauri CLI закреплён на версии 2.12.6 в `package.json`. Он устанавливается npm как готовый CLI-wrapper; Rust-код приложения всё равно компилируется Cargo.

Артефакты сборки находятся в `src-tauri/target/release/bundle/`.

Поддерживаемые расширения: `.mp3`, `.wav`, `.flac`, `.ogg`, `.oga`, `.m4a`, `.aac`. AIFF пока не принимается: штатный аудиодекодер Windows WebView2 не гарантирует его воспроизведение.

## Запуск без установки

Для разработки:

```powershell
npm install --no-package-lock
npm run tauri -- dev --config src-tauri/tauri.conf.json
```

## Локальные данные и приватность

Музыкальные файлы остаются на компьютере. Desktop Edition сохраняет файлы и метаданные медиатеки в локальном хранилище WebView (IndexedDB); при удалении приложения данные могут быть удалены вместе с его пользовательским хранилищем. Не используй очистку данных приложения, если хочешь сохранить библиотеку.

**Cloudflare Web Edition — отдельный продукт.** В этой Desktop-сборке облачная авторизация и синхронизация отключены, чтобы приложение не отправляло запросы на не настроенный сервер. Плейлисты, избранное и настройки сохраняются локально.

## Проверки

```powershell
check.bat
```

Windows CI выполняет frontend unit/smoke tests, проверку Rust formatting и полную Tauri-сборку обоих установщиков NSIS EXE и MSI. Полная сборка сама компилирует Rust в release-профиле без отдельной повторной debug-компиляции. Для дополнительного debug-проверочного прохода локально запусти `check.bat --rust`. Файлы прикрепляются к артефактам запуска Actions на 14 дней. Установщики пока не подписаны цифровым сертификатом, поэтому Windows может показывать предупреждение SmartScreen. Скачивай их только из доверенного запуска GitHub Actions.

## Структура

```text
public/                 Интерфейс и логика плеера
src-tauri/              Tauri 2 + Rust shell
tests/                  Smoke-проверки
.github/workflows/      CI и сборка релизов
run.bat                 Запуск разработки
build.bat               Сборка NSIS/MSI
check.bat               Проверка проекта
```

## Лицензия

Лицензия пока не назначена. Не распространяй сборки как open-source производные без разрешения автора проекта.
