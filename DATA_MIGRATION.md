# QWEMU MUSIC 1.2.0 — миграция пользовательских данных

## SQLite
- Целевая база проверяется через `PRAGMA integrity_check`.
- Старая база копируется вместе с WAL/journal sidecar в staging; копия проверяется и checkpoint-ится.
- Исходная база и проверенная backup-копия остаются на месте. Повреждённая целевая база не перезаписывается.

## IndexedDB Blob → native Rust music storage
1. Пользователь запускает перенос из «Настройки → Нативная медиатека Rust».
2. WebView выбирает локальные записи IndexedDB, у которых сохранился `Blob`; поддерживаются MP3, WAV, FLAC, OGG/OGA, M4A, AAC, AIFF/AIF.
3. `legacy_migration_begin` проверяет ID, размер, расширение, очищает метаданные и создаёт сессию с временным файлом внутри `app_data/music/.migration-staging`. Одновременно допускается не более двух сессий.
4. Blob читается блоками до 192 KiB. Для каждого блока WebCrypto вычисляет SHA-256; Rust пересчитывает его до записи и проверяет непрерывность `offset`.
5. `legacy_migration_finalize` проверяет точный размер, синхронизирует файл на диск, вычисляет SHA-256 полного файла, перемещает файл в `app_data/music` и атомарно обновляет `library.json`.
6. Предыдущая версия `library.json` сохраняется в `library.json.bak`. Если основной manifest отсутствует, чтение использует backup.
7. Только после успешной регистрации существующая IndexedDB-запись дополняется `nativePath` и `sha256`. Поле `file` (Blob) не удаляется.
8. При следующем запуске Rust manifest связывается с уже загруженными метаданными по ID; повторного копирования не требуется.

## Сохранность и восстановление
- Исходный Blob остаётся в IndexedDB после успешного переноса как резервная копия.
- При ошибке transfer активная сессия отменяется, `.part` staging-файл удаляется, исходный Blob остаётся доступен.
- После аварийного завершения незаконченные `.part` файлы из выделенного staging-каталога удаляются при следующем запуске. Основные файлы медиатеки не затрагиваются.
- Записи manifest о временно отсутствующих файлах не отбрасываются: они сохраняются с `available: false` и не добавляются в список воспроизводимых треков до восстановления файла.
- `library-migration-report.json` хранит дату, источник, общую статистику, SHA-256 успешных файлов и причины отказов.
- Если запись метаданных обратно в IndexedDB не удалась после фиксации native manifest, Rust manifest остаётся источником восстановления; следующий запуск связывает треки по ID.

## Что не мигрируется этим этапом
- Внешние HTTP(S)-URL, remote-провайдеры и записи без доступного Blob.
- Legacy-файлы с расширением, которое не поддерживает текущий нативный декодер.
- Профили, аватары и списки пользователя остаются в существующих механизмах хранения; этот этап переносит только аудиофайлы и их метаданные.
- Фактическая миграция личной библиотеки выполняется на устройстве пользователя, где доступна исходная IndexedDB.


## Stage 6 playback migration

- Supported old IndexedDB Blob tracks are copied to Rust on first playback, using 192 KiB chunks, per-chunk SHA-256, exact offsets/size, full-file SHA-256 and staging.
- The original Blob remains in IndexedDB as a rollback copy. If migration fails, the track remains in the old store and the Rust playback attempt reports the error.
- Direct HTTP(S) audio playback uses a separate bounded cache; it is not inserted into the permanent library unless the user uses the explicit link-import form.
- Local folder import is performed by Rust and registers each copied file in the native manifest.
