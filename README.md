# QWEMU MUSIC Desktop

**Нативная ПК-версия QWEMU MUSIC для Windows 10/11.**  
Версия: **1.5.0** · Tauri 2 · Rust · HTML/CSS/JavaScript

## Возможности

- Локальный музыкальный плеер с импортом MP3, WAV, FLAC, OGG, M4A, AAC и AIFF.
- Сохранение импортированной медиатеки между запусками приложения через IndexedDB.
- Плейлисты, избранное, поиск, повтор, громкость и темы оформления.
- Воспроизведение локальных файлов без отправки аудио на сервер.
- Оконное приложение Windows с установщиками NSIS (.exe) и MSI.
- Проверки Rust и frontend-кода в GitHub Actions.

## Сборка на Windows

Требуются Windows 10/11 x64, Rust stable с MSVC toolchain и Visual Studio Build Tools (C++ build tools). Для запуска WebView2 Runtime должен быть установлен; установщик Tauri может загрузить bootstrapper при необходимости.

1. Установи Rust с https://rustup.rs/ и выбери MSVC toolchain.
2. Установи Visual Studio Build Tools с компонентом **Desktop development with C++**.
3. Открой папку проекта.
4. Запусти `run.bat` для разработки или `build.bat` для сборки установщиков.

Команды вручную из корня репозитория:

```powershell
cargo install tauri-cli --version "^2" --locked
cargo tauri dev --config src-tauri/tauri.conf.json
cargo tauri build --config src-tauri/tauri.conf.json
```

Артефакты сборки находятся в `src-tauri/target/release/bundle/`.

## Запуск без установки

Для разработки:

```powershell
cargo tauri dev --config src-tauri/tauri.conf.json
```

## Локальные данные и приватность

Музыкальные файлы остаются на компьютере. Desktop Edition сохраняет файлы и метаданные медиатеки в локальном хранилище WebView (IndexedDB); при удалении приложения данные могут быть удалены вместе с его пользовательским хранилищем. Не используй очистку данных приложения, если хочешь сохранить библиотеку.

**Cloudflare Web Edition — отдельный продукт.** В этой Desktop-сборке облачная авторизация и синхронизация отключены, чтобы приложение не отправляло запросы на не настроенный сервер. Плейлисты, избранное и настройки сохраняются локально.

## Проверки

```powershell
check.bat
```

CI дополнительно выполняет проверку JavaScript, smoke-тесты и `cargo check` на Windows. Успешный CI не заменяет тестирование установщика на реальном ПК.

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
