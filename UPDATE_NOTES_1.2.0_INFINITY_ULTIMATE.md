# QWEMU MUSIC 1.2.0 — INFINITY ULTIMATE (BETA)

## Реализовано в этом обновлении
- Устранены отсутствующие production assets в `web/assets`.
- Выровнены версии приложения, Tauri, Cargo, Rust API и BAT-запускателей.
- Добавлен JSON backup v2 с проверкой схемы, лимитом размера, безопасной нормализацией и объединением с текущими списками.
- Добавлены backup/restore для списка избранного, истории, поиска, очереди, плейлистов, настроек интерфейса и аудиопредпочтений/EQ.
- Добавлены локальные страницы исполнителей и альбомов, использующие только реальные метаданные импортированной музыки.
- Добавлены автоматические проверки резервных копий и packaged frontend assets.

## Не входит в фактически реализованный scope
Глобальные Windows media keys, PCM-визуализатор с прямыми данными из Rodio worker, полноценный внешний музыкальный backend, HLS/DASH и автоматическое обновление с опубликованного доверенного сервера не заявляются как готовые функции.

Резервная копия не включает аудиофайлы, пароли, access tokens, локальные пути, а также не восстанавливает сами музыкальные файлы. После импорта необходимо повторно импортировать исходную музыкальную папку, если её содержимое отсутствует на устройстве.

## Windows BAT reliability hotfix

The launcher, release builder, Rust setup, MSVC environment helper and diagnostics were revised. The release builder now searches Tauri's nested installer folders, validates both MSI and NSIS outputs, and prints artifact paths. CMD delayed expansion was disabled to protect paths containing `!`; Rustup setup no longer changes persistent project overrides. npm dependencies are verified rather than inferred from a single shim file. Diagnostics now load the MSVC environment before Cargo checks.
