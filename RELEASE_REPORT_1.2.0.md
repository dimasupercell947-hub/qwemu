# QWEMU MUSIC 1.2.0 — Release report (BETA)

## Сводка
Версия 1.2.0 подготовлена как beta-обновление поверх существующего QWEMU MUSIC 1.1.0. Исходный ZIP не перезаписывался; изменения выполнены в отдельной рабочей копии.

## Основные изменения
- Исправлены пропущенные файлы frontend в Tauri production directory `web/assets`.
- Версии package/Cargo/Tauri/Rust API/launcher выровнены на 1.2.0.
- Добавлен валидируемый backup v2 и безопасное объединение метаданных с существующим профилем.
- Добавлены local metadata pages для artists/albums.
- Добавлены regression checks для backup core и packaged assets.

## Релизный статус
BETA / подготовка к Windows QA. Успешная Windows Tauri сборка, MSI/EXE и аппаратное воспроизведение в этой среде не подтверждены. Смотри `BUILD_REPORT_1.2.0.md`, `TEST_REPORT_1.2.0.md` и `KNOWN_ISSUES.md`.
