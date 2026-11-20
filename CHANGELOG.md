## QWEMU MUSIC 1.2.0 — INFINITY ULTIMATE (BETA)

- Синхронизированы версии package.json, Cargo, Tauri, Rust API, version.json и Windows launch/build scripts.
- Исправлена упаковка frontend: ресурсы Infinity Evolution / Experience и логотип QWEMU Market теперь присутствуют в web/assets, откуда Tauri собирает интерфейс.
- Добавлен валидируемый импорт/экспорт резервной копии: списки, история, очередь, плейлисты, базовые настройки интерфейса и 10-полосные аудионастройки.
- Импорт объединяет списки с текущими данными, ограничивает размеры и значения, отвергает неизвестное приложение/версию; пароли, токены и локальные пути не экспортируются и не восстанавливаются.
- Добавлены отдельные локальные каталоги исполнителей и альбомов на основе существующих тегов библиотеки; биографии и онлайн-каталог не имитируются.
- Добавлены регрессионные тесты ядра резервных копий и проверки присутствия production assets.
- Сохранены исходные Tauri 2, Rust/Rodio audio worker, SQLite, FLOW, EQ, очередь, плейлисты, профили и прежние ключи пользовательских данных.

### 1.2.0 BETA — BAT / Rust toolchain diagnostics follow-up — 20 ноября 2026

- Исправлено сравнение установленного Rust toolchain: определяется точное имя MSVC stable, а GNU/nightly toolchain с похожим префиксом не принимаются за него.
- `DIAGNOSE_QWEMU.bat` теперь закрепляет все Cargo-команды за `stable-x86_64-pc-windows-msvc`, исключая случайное использование другого системного default toolchain.
- В диагностический лог добавлена запись активного `RUSTUP_TOOLCHAIN`.
- BAT-аудит расширен до 95 регрессионных проверок; добавлены тесты точного совпадения toolchain.

### 1.2.0 BETA — Rustup network/offline hotfix — 20 ноября 2026

- Исправлена причина сетевого сбоя при сборке: `SETUP_RUST_TOOLCHAIN.bat` больше не запускает синхронизацию Rust stable при каждом старте, если подходящий toolchain уже установлен локально.
- Перед установкой проверяются локальные toolchains, компонент rustfmt и target `x86_64-pc-windows-msvc`.
- Первичная загрузка rustup-init и установка действительно отсутствующих компонентов повторяются до 3 раз; ошибки сети сопровождаются подсказкой по proxy/VPN/firewall.
- Обновление существующего stable выполняется только по явному запросу `QWEMU_UPDATE_RUST_STABLE=1`.
- Добавлены регрессионные проверки поведения Rustup; инструкция по устранению сетевых ошибок сведена в `WINDOWS_BUILD_TROUBLESHOOTING.md`.
- Ограничение: сетевой доступ к официальному серверу всё ещё требуется для первой установки отсутствующего toolchain/компонента/target; BAT не может исправить внешнюю блокировку соединения.

## QWEMU MUSIC 1.1.0 INFINITY EVOLUTION — Stage 1 Appearance Foundation — 18 ноября 2026

- Начат переход на версию 1.1.0: синхронизированы package.json, Cargo.toml, Tauri config, version.json и Rust API version.
- Добавлен Infinity Appearance: Dark Red, Orange Night, Midnight, Pure Black, Light и Custom Theme.
- Добавлен выбор собственного цвета акцента с проверкой HEX-значения.
- Выбранная тема сохраняется локально и восстанавливается при следующем запуске.
- Сохранены существующие страницы настроек, аудиомодуль Rust/Rodio, FLOW, EQ, библиотека, очередь и миграции.
- Добавлены регрессионные проверки темы и синхронизации frontend-копий.

## QWEMU MUSIC 1.0.0 — Premium Release — 17 ноября 2026

- Выпущен новый премиальный дизайн музыкального пространства QWEMU.
- Обновлены главная страница, навигация, карточки, FLOW, плеер, авторизация и адаптивные состояния.
- Версия приложения синхронизирована до 1.0.0 во frontend, Tauri, Cargo и Rust API.
- Сохранены нативный Rust/Rodio playback, пользовательские данные и протокол миграции.

## 0.6.1 BETA — AURA Design Release

## Полный визуальный редизайн
- Новая фирменная система QWEMU AURA: векторный логотип, SVG favicon и обновлённая иконка Windows.
- Полностью новая палитра Liquid Glass: глубокий индиго, фиолетовое свечение и ледяной голубой акцент.
- Переработаны загрузочное интро, экран авторизации, боковая навигация, верхняя панель, главная витрина, карточки библиотеки, FLOW, профиль, настройки, модальные окна и нижний плеер.
- Добавлены стеклянные поверхности, аккуратные границы, световые ореолы, новые состояния наведения и адаптивные правила.
- QWEMU Studio Hub визуально согласован с основной темой.
- Сохранены Rust/Rodio backend, SQLite/API, manifest `library.json`, ключи хранилища и пользовательские файлы; миграция данных не выполнялась.

---

## 0.6.1 BETA — Rust Stage 6: Native Playback Completion — 17 ноября 2026
- В Tauri все поддерживаемые музыкальные источники направляются в Rust/Rodio: нативные файлы, старые IndexedDB Blob после безопасного переноса и прямые HTTP(S)-аудиофайлы через ограниченный дисковый кэш.
- Старые IndexedDB Blob автоматически переносятся в Rust при первом воспроизведении; перенос выполняется блоками с SHA-256, staging и сохранением исходной Blob-копии для отката.
- Прямые аудиоисточники загружаются потоково на диск с лимитом 512 МБ; проверяются HTTP(S), DNS-адреса, MIME, расширение и размер. Перенаправления, HLS/DASH и защищённые потоки не обходятся.
- Ссылка из формы импорта скачивается Rust-загрузчиком и добавляется в постоянную медиатеку; Openverse/внешние прямые аудиоисточники воспроизводятся нативно из ограниченного кэша.
- Добавлен нативный импорт папки и drag-and-drop: рекурсивный обход до 24 уровней и 5000 аудиофайлов, без перехода по symlink.
- Добавлены процессные mutex для manifest и аудиокэша, чтобы параллельные импорты и загрузки в одном экземпляре не теряли записи каталога.
- Таймер сна перенесён в Rust audio worker и продолжает работать, когда окно скрыто в трей.
- В системный трей добавлены команды предыдущей/следующей композиции и воспроизведения/паузы.
- Rodio OutputStream теперь удерживается одним worker-потоком между треками; устранено повторное создание устройства при переключении очереди.
- Исправлено обновление таймлайна нативного плеера: UI использует AudioStatus Rust, а не неактивный HTMLAudio элемент.
- Команда audio_play теперь разрешает открывать только файлы из app_data/music и проверенного app_cache/audio-cache.
- Сохранены прежние ключи IndexedDB/localStorage, manifest, SQLite, аккаунты, синхронизация, библиотека, FLOW, EQ, очередь, плейлисты, профили, аватары и цветовая система.

## 0.6.0 BETA — Super Update & Quality of Life — 17 ноября 2026
- Добавлен таймер сна: автоматическая остановка воспроизведения через 15–240 минут; таймер корректно очищается при замене или отключении.
- Добавлена проверка возможных дубликатов по нормализованным названию и исполнителю; проверка только показывает совпадения и никогда не удаляет файлы автоматически.
- Добавлена панель обслуживания медиатеки со счётчиками локальных треков и групп совпадений.
- Сохранены встроенный браузер, автоматический импорт поддерживаемых аудиозагрузок, нативная библиотека, Rust/Rodio, EQ, FLOW, очередь, плейлисты, профили, аватары, настройки и старые ключи данных.
- Синхронизированы версии frontend, package, Tauri bundle, Cargo и Windows build scripts до 0.6.0.
- Оптимизация релиза: сохранены единый frontend-файл и существующие ключи хранилища; не добавлены тяжёлые runtime-зависимости.
- Ограничение: полноценная Rust-компиляция и Windows EXE/MSI должны быть выполнены в Windows-среде с установленным Rust/MSVC/WebView2.

## 0.5.1 BETA — Rust Stage 3: Native Library Migration — 16 ноября 2026
- Добавлен потоковый перенос старых локальных треков из IndexedDB Blob в файловую медиатеку Rust/Rodio; интерфейс не отправляет весь аудиофайл одним IPC-сообщением.
- Перенос выполняется чанками до 192 KiB; каждый чанк проверяется SHA-256 на Rust-стороне до записи.
- Rust проверяет последовательность offset, точный итоговый размер и рассчитывает SHA-256 полного файла перед фиксацией.
- Файлы сначала записываются в `music/.migration-staging`, затем атомарно перемещаются в медиатеку; `library.json` обновляется через staging/backup.
- Исходные IndexedDB Blob не удаляются и остаются резервной копией. Запись IndexedDB дополняется nativePath только после успешной регистрации Rust-файла.
- Добавлен ручной запуск миграции в настройках и `library-migration-report.json` с количеством перенесённых, пропущенных и неудачных файлов; интерфейс показывает текущий файл и процент передачи.
- Добавлено ограничение одновременных сессий, безопасная очистка метаданных и восстановление Blob playback, если нативный файл временно недоступен.
- `library.json` получает backup `library.json.bak`; недоступные файлы помечаются `available: false`, но записи manifest не удаляются.
- Добавлена синхронизация редактирования метаданных с Rust manifest; IndexedDB Blob сохраняется и не затирается при сохранении нативной записи без Blob в памяти.
- Перенесённые локальные файлы направляются в нативный Rust/Rodio playback; внешние URL и неподдерживаемые форматы остаются отдельным браузерным fallback.
- Ограничения: Cargo/Rust toolchain отсутствует в среде создания архива; Rust-компиляция, Windows EXE/MSI, аппаратное воспроизведение и фактический перенос пользовательской IndexedDB-базы не запускались.

## 0.5.1 BETA — Rust Audio Stage 2 — 15 ноября 2026
- Подключён нативный 10-полосный DSP-эквалайзер Rust/Rodio для треков, импортированных в нативную медиатеку QWEMU.
- EQ использует отдельное состояние biquad-фильтров для каждого аудиоканала; изменения передаются в активный поток через атомарный snapshot без mutex на каждый sample.
- Исправлено применение EQ при переключении пресетов, изменении полос, включении/выключении эквалайзера и запуске нативного трека.
- Миграция SQLite теперь копирует базу и WAL sidecar в staging, выполняет `integrity_check`, checkpoint и только затем фиксирует резервную копию и новую базу.
- Исходная SQLite-база не перемещается и не удаляется; существующая база проверяется перед использованием.
- Исправлено удаление нативного аудиофайла: manifest сопоставляется с каноническим путём до удаления файла.
- Восстановлен системный трей Tauri: окно скрывается при закрытии, а аудиопоток продолжает работать; выход доступен через меню трея.
- Добавлены Rust unit tests для коэффициентов EQ, стереообработки и SQLite snapshot migration.
- Ограничения: `cargo check/test`, Windows EXE/MSI, аппаратное воспроизведение, tray/background и автоматический перенос старых IndexedDB Blob не подтверждены в этой среде.

## 0.5.0 RELEASE — дополнительный hotfix запуска и диагностики — 15 ноября 2026
- Исправлена ошибка старта локального Rust API при занятом порте 8765: сервер теперь пытается привязать порт до запуска фонового потока и возвращает понятную ошибку, вместо того чтобы принять чужой TCP listener за собственный API.
- BAT-сборка теперь запускает проверки целостности проекта и `cargo check` до полной Tauri-сборки; ошибки разделены на отдельные диагностические этапы.
- BAT-запуск теперь проверяет целостность проекта до старта приложения.
- Исправлено определение корневого каталога в `check-project.mjs` через `fileURLToPath`, чтобы Windows-пути с буквой диска корректно обрабатывались Node.js.
- Build metadata обновлена до `release-rust-compile-fix-3`; продуктовая версия 0.5.0 сохранена.

## 0.5.0 RELEASE — 14 ноября 2026
- Удалён системный трей и режим скрытия окна: закрытие завершает приложение и освобождает память.
- Отключены постоянные анимационные циклы визуализатора; анимации интерфейса выключены по умолчанию.
- Убраны дорогие backdrop blur эффекты.
- Каталог импортированной музыки теперь сохраняется в `app_data/music/library.json` на диске и восстанавливается при каждом запуске из Rust, независимо от профиля WebView.
- Удаление трека синхронно обновляет дисковый каталог; отсутствующие файлы автоматически исключаются при восстановлении.
- Интервал опроса статуса нативного плеера увеличен до 1 секунды.
- Release bundle содержит только web-интерфейс, версию и системную иконку; документация и инструменты разработки не входят в runtime.
- Сохранены библиотека, локальные аудиофайлы, плейлисты, избранное, очередь, FLOW, EQ, профили и Rust API.
- BAT-файлы запуска и сборки теперь обнаруживают ситуацию, когда `rustup` установлен, но default Rust toolchain не настроен.
- Добавлен `SETUP_RUST_TOOLCHAIN.bat`: с подтверждения пользователя он устанавливает минимальный профиль stable и задаёт `rustup default stable`; после этого проверяет Cargo и rustc.
- Диагностика теперь отдельно показывает активный Rust toolchain и ошибки запуска Cargo/rustc.
- Исправлена компиляция нативного Rust-аудиодвижка: Rodio `OutputStream` перенесён в выделенный worker thread, а Tauri state хранит только потокобезопасный канал команд.
- Исправлен доступ к пути текущего трека при удалении; добавлена явная типизация списка импортируемых файлов.
- Исправлены ошибки времени жизни MIME-типа и URL запроса в локальном Rust API.
- Проверяющие скрипты дополнены проверками архитектуры аудиопотока и исправлений Rust API.

## 0.5.0 Alpha — Deep UI Rebuild — 14 ноября 2026
- Перестроена визуальная система ПК-клиента: новая сетка, боковая навигация, верхняя панель, главная страница, поверхности карточек, библиотека, нижний плеер, настройки и адаптивные состояния.
- Временно убраны старые графические изображения логотипа из заставки, авторизации и шапки приложения. Новый фирменный знак в этот этап намеренно не включён.
- Добавлена поисковая палитра команд с фильтрацией, клавиатурной навигацией и запуском существующих действий/разделов.
- Добавлены быстрые действия на главной и видимая справка по горячим клавишам в настройках.
- Добавлены сочетания Ctrl/Cmd+K (команды), Ctrl/Cmd+F (поиск), Ctrl/Cmd+I (импорт), G затем H/L/P/F/S/Q/R (разделы), Space (пауза/воспроизведение), стрелки (предыдущая/следующая), M (звук).
- Добавлен статус локального/онлайн API в верхнюю панель с использованием существующего механизма обновления состояния сервера.
- Сохранены существующие идентификаторы, маршруты страниц, обработчики действий, локальные данные, API-контракты и Rust-команды.
- Добавлены статические проверки новой палитры команд, адаптивных правил и справки сочетаний клавиш.
- Ограничения прежней Alpha сохранены: Rust toolchain и Windows installer не проверены; старые IndexedDB Blob не мигрируют автоматически; нативный EQ и media-session integration не завершены.

# QWEMU PC — история обновлений

## 0.5.0 Alpha — Native Audio Core — 14 ноября 2026
- Добавлен Rust audio engine на Rodio для нативно импортированных файлов: воспроизведение, пауза, продолжение, остановка, перемотка, громкость и состояние.
- Добавлен системный импорт аудиофайлов через Tauri; файлы копируются в app data, исходники остаются на месте.
- Добавлены Rust-команды управления аудио и мост интерфейса Tauri.
- Добавлено локальное сохранение метаданных нативной медиатеки и удаление её файлов с проверкой каталога.
- Обновлены проверяющий скрипт, документация и Windows build scripts.
- Сохранены прежние интерфейс, профили, плейлисты, FLOW, история, избранное и старые записи IndexedDB.
- Ограничения: нативный 10-полосный EQ, автоматическая миграция старых IndexedDB blobs и полная замена WebAudio playback ещё не завершены.

## 0.3.4 BETA
- Горячие клавиши управления воспроизведением.
- Контекстная подсказка клавишей `?`.
- Защита от срабатывания горячих клавиш при вводе текста и авторизации.

## 0.3.3.2
- Редизайн ПК-интерфейса и реальная этапная загрузка.
- Синхронизация версии и политики релизов.

## 0.4.0 STABLE — 14 ноября 2026
- Глобальная переработка ПК-клиента и подготовка реального backend на Python + SQLite.
- Онлайн-регистрация/вход, профиль, сессии и версионируемая синхронизация пользовательских списков.
- Удалены чатовые интерфейсы и социальные остатки; при обновлении очищаются только старые ключи чата.
- Добавлены история поиска, сортировка медиатеки, редактирование метаданных, управление описанием и порядком плейлиста.
- Добавлены запуск плейлиста и управление очередью воспроизведения.
- Гостевой режим без искусственного лимита по времени.
- Существующий `qwemu-mark.png` сохранён без изменений; исправлены ссылки на отсутствующий WebP.
- Windows-запуск теперь поднимает клиент вместе с API-сервером.
- Добавлены интеграционные тесты HTTP API и ПК-чекер.
- Публичный разворот и лицензированный музыкальный провайдер остаются отдельными задачами развёртывания.

## 0.5.0 BETA — 14 ноября 2026
- Новый графитово-стеклянный визуальный стиль и рабочая система акцентного цвета.
- Точная настройка эквалайзера с шагом 0,1 dB и ручным вводом в пределах -12…+12 dB.
- Пользовательский EQ-пресет madk1d (кастомный).
- Автоматический и ручной режимы FLOW, множественный выбор и пакетное удаление музыки.
- Локальная аватарка профиля и восстановление последнего раздела после обновления.
- Media Session и подготовка Electron-оболочки с системным треем и продолжением воспроизведения в фоне.
- Исправления Windows BAT-файлов и подготовка сценария сборки EXE.


## 0.5.1 BETA — 14 ноября 2026
- Исправлено удаление активной композиции с корректной остановкой обоих аудиоканалов.
- Транзакции IndexedDB ожидаются до commit; неуспешное удаление не маскируется под успех.
- Пакетное удаление использует единое подтверждение и реальную статистику результата.
- Добавлена защита от гонок асинхронного запуска при быстром переключении треков.
- Множественный выбор ограничен библиотекой, исправлена мобильная сетка.
- Аватарки разделены по профилям, сохранённые настройки аудио нормализуются.
- Устранены устаревшие подписи версии в клиенте и экспорте резервной копии.
- Electron хранит БД в пользовательской папке, выбирает свободный порт и имеет запасной способ запуска Python.


## 0.5.0 STABLE — RUST EDITION — 14 ноября 2026
- Electron заменён desktop-оболочкой Tauri 2 + Rust.
- Добавлены Rust lifecycle management, запуск/health-check Python API и системный трей.
- Сохранены UI, IndexedDB, SQLite API и пользовательские сценарии; добавлен путь хранения БД в app data.
- Сборка Windows переведена на Tauri CLI (NSIS/MSI).
- Полный перенос Python API и Web Audio движка на Rust не входит в этот этап и явно отмечен как дальнейшая работа.

## 0.5.0 STABLE — Rust Backend Migration Stage 1 — 14 ноября 2026
- Electron runtime полностью удалён; desktop-оболочка работает на Tauri 2.
- Python API runtime заменён локальным HTTP API на Rust.
- Перенесены регистрация/вход/выход, cookie-сессии, профиль, удаление аккаунта, версионируемая синхронизация и catalog/health endpoints.
- SQLite переведена на rusqlite с WAL и foreign keys; параметры scrypt сохранены для совместимости с прежними аккаунтами.
- Добавлен staged импорт старой SQLite базы с integrity check и резервной копией без удаления исходника.
- Сохранён существующий frontend и контракты API; взяты последние исправления UI из 0.5.1 BETA.
- Python больше не требуется для запуска приложения.
- Нативный Rust audio engine и перенос IndexedDB media blobs остаются следующими этапами миграции.


## 0.5.0 RELEASE — Windows BAT hotfix — 15 ноября 2026
- Исправлен запуск BAT-файлов из ярлыков и сторонних рабочих каталогов: скрипты переходят в собственную папку.
- Убрана неоднозначность вызова `npx`; запуск и сборка используют npm scripts проекта.
- Добавлены проверки Node.js, npm, Cargo, rustc и структуры проекта с отдельными сообщениями об ошибках.
- Добавлен `DIAGNOSE_QWEMU.bat` для сбора сведений об окружении Windows.


## 0.5.1 BETA — Rust Stage 4 Browser & Downloads — 17 ноября 2026
- Добавлено отдельное окно встроенного браузера QWEMU на Tauri WebView; произвольные HTTP/HTTPS сайты открываются внутри приложения.
- Добавлен нативный Tauri download handler: при загрузке поддерживаемого аудиофайла браузер сохраняет его во временный каталог, затем Rust проверяет размер и SHA-256, переносит файл в медиатеку и регистрирует его в `library.json`.
- После успешной загрузки Rust отправляет событие в основное окно, и трек появляется в библиотеке без перезапуска.
- Добавлена загрузка прямых HTTP/HTTPS ссылок на аудиофайлы из формы импорта; в настольной Tauri-сборке файл теперь физически скачивается в медиатеку, а не только регистрируется как внешний URL.
- Добавлены ограничения размера 512 МБ, поддерживаемых расширений и блокировка очевидных localhost/private IP ссылок; автоматический импорт использует системный WebView download event, без выдачи удалённым сайтам доступа к Tauri IPC.
- Ссылки на страницы потоковых платформ, DRM-защищённые потоки и материалы без разрешения на скачивание не извлекаются.

## 0.6.1 SUPER UPDATE — Studio Hub & Productivity Layer

- Added QWEMU Studio Hub overlay with a dedicated control-room dashboard.
- Added safe JSON backup/export for allowlisted QWEMU preference keys. Authentication, session, token, password/hash and secret-like keys are excluded.
- Added validated backup import with an 8 MiB cap, strict schema validation, allowlisted keys, and non-destructive merge (existing values are never overwritten).
- Added local diagnostics report export; diagnostics are not sent to a server.
- Added M3U export using actual native Rust library paths. Web preview explicitly refuses to create a misleading playlist without filesystem paths.
- Added keyboard controls for playback, next/previous, volume, seeking, Studio Hub and safe backup export.
- Added a direct entry point to the existing FLOW page and launch action.
- Kept the existing app version at 0.6.1; this is a substantial in-version BETA update, not a stability claim.


## 0.6.1 BETA — QWEMU MUSIC MARKET REDESIGN
- Полностью заменено активное визуальное направление AURA Liquid Glass на новый редакционный музыкальный интерфейс QWEMU MUSIC.
- Создана новая фирменная SVG-эмблема QWEMU в виде звуковой волны.
- Новая светлая композиция приложения: белая навигация, светло-серый фон, красно-оранжевые промо-блоки, карточки и компактные списки треков.
- Переработаны главная, FLOW, библиотека, поиск, плейлисты, профиль, настройки, авторизация, интро и нижний плеер.
- Добавлено переключение светлой и тёмной темы с сохранением выбора.
- Сохранены Rust/Rodio, API, SQLite, библиотека, пользовательские ключи, очередь, избранное, история, EQ и профили.

## AI Music Finder — Stage 3 (2026-11-18)
- Добавлен облачный AI-поиск музыки по домену и ключевым словам через OpenAI Responses API + web_search.
- Добавлена Rust-проверка доступности сайта, HTTPS/HTTP URL, публичного DNS/IP и HTML-типа страницы.
- Добавлен выборочный импорт найденных прямых аудиофайлов в существующую нативную медиатеку.
- Сохранены существующий браузер, прямой импорт, Rust/Rodio, очередь, FLOW, EQ, плейлисты и профили.
- API-ключ читается Rust-процессом из переменной среды `OPENAI_API_KEY`; ключ не встроен в приложение.

## 1.0.0 STABLE — SUPER UPDATE STAGE 4: AI Music Finder PRO — 18 ноября 2026
- Расширен облачный AI Music Finder на OpenAI Responses API + Web Search: точный поиск, открытие близких релизов и поиск по альбому/EP.
- В Web Search добавлено серверное ограничение `allowed_domains` для сайта, выбранного пользователем; Rust дополнительно проверяет домен каждой страницы и прямой аудиоссылки. `tool_choice: required` запрещает модели пропускать поиск.
- В карточки результатов добавлены альбом, длительность, год, жанр, краткая причина совпадения и оценка уверенности.
- Добавлены лимиты выдачи, сортировка, настройка поиска ремиксов/live/альтернативных версий и подсчёт проверенных ссылок-источников.
- Добавлен индикатор конфигурации облачного ИИ без передачи API-ключа в frontend; имя модели можно переопределить через `QWEMU_AI_MODEL`.
- Добавлены локальная история последних 12 AI-запросов, повтор поиска и очистка истории.
- Добавлено предварительное распознавание вероятных дубликатов с блокировкой повторного импорта и выборочное пакетное добавление подтверждённых прямых аудиофайлов.
- Добавлены диагностические подсказки для ошибок API, ограничение размера ответа и обработка незавершённого ответа.
- Сохранены Rust/Rodio, EQ, FLOW, очередь, плейлисты, профили, аватары, настройки, локальная медиатека и пользовательские данные.
- Node.js regression suite: PASS (87/87 базовых, 104/104 глубоких, дополнительные специализированные наборы PASS). Rust compile/tests, Windows EXE/MSI, live API и аппаратное аудио требуют отдельной проверки на Windows.

## Startup Stage 5 — Windows one-click launcher

- `RUN_QWEMU.bat` now automatically installs the official Rust stable toolchain when rustup is missing, installs npm dependencies when needed, runs project checks, and starts the Tauri web frontend.
- Added `LOAD_MSVC_ENV.bat` to locate Visual Studio 2022 Build Tools and load the x64 compiler environment required by native Rust/Tauri builds.
- `BUILD_EXE.bat` now loads MSVC before Rust checks and packaging.
- Added `STARTUP_GUIDE_WINDOWS_RU.md`; obsolete intermediate stage reports are excluded from the clean distribution.
- Node.js LTS and Visual Studio C++ Build Tools remain system prerequisites; the scripts detect and explain missing prerequisites rather than silently failing.

## 1.0.0 — Stage 6 Startup Runtime Fix
- Исправлена диагностика при открытии index.html напрямую через file://.
- Добавлена понятная инструкция запуска через RUN_QWEMU.bat.
- Защищён вызов Tauri IPC от отсутствующего window.__TAURI__.
- Добавлен startup runtime regression test.


## [1.1.0] — INFINITY EVOLUTION (2026-11-18)

- Added five local FLOW modes: Daily, Discovery, Favorites, Underground and Random.
- Added local FLOW exclusions for artists and genres, plus a hide-played preference.
- Added portable JSON playlist export for the selected playlist.
- Added responsive FLOW controls and kept the existing recommendation engine as the source of track candidates.
- Updated visible product version and release metadata to 1.1.0.
- Kept Rust/Rodio playback, SQLite/API, AI Finder, library, profiles, queue and existing data keys.


## 1.1.0 — BAT reliability fixes
- Fixed MSVC environment propagation from `VsDevCmd.bat` by removing helper-local environment scoping.
- Corrected Tauri CLI installation detection in the launcher.
- Release builder now verifies that an MSI or EXE artifact actually exists before reporting success.

## 1.2.0 BETA — Windows BAT reliability hotfix

- Fixed installer verification to search Tauri's nested `bundle\\msi` and `bundle\\nsis` output directories and require both configured installer formats.
- Disabled CMD delayed expansion in launch/build/setup/diagnostic scripts to protect paths containing exclamation marks.
- Improved MSVC x64 setup and validation for `cl.exe`, `link.exe`, Windows SDK and target architecture.
- Removed persistent `rustup override set stable`; stable selection is now scoped to launcher/build sessions.
- Added npm dependency integrity checks and lockfile-aware `npm ci` / `npm install` handling.
- Updated diagnostics to initialize MSVC before Cargo checks and record separate exit codes.
- Switched project directory handling to `pushd`/`popd` for UNC paths.
- Added 68 BAT regression assertions to `npm run check`.


## 1.2.0 — Windows toolchain and release BAT reliability

- Pinned Windows builds to `stable-x86_64-pc-windows-msvc` across setup, launcher, build and diagnostics.
- Improved offline reuse of an existing local Rust MSVC toolchain.
- Validated actual Windows SDK headers and x64/UCRT libraries before compiling.
- Added current-run timestamp verification for MSI/NSIS artifacts to reject stale installers.
- Hardened the rustup installer download path for Windows temporary directories containing spaces.

## 1.2.0 — BAT reliability follow-up

- Диагностика запускает `cargo fmt`, `cargo check` и `cargo test` через точный `rustup run stable-x86_64-pc-windows-msvc`, а не через неоднозначный глобальный Cargo proxy.
- `DIAGNOSE_QWEMU.bat` больше не запускает нативную компиляцию и Rust-тесты при неинициализированном MSVC/Windows SDK; вместо каскада вторичных ошибок показывает причину и статус SKIPPED.
- Диагностический лог дополнен версией MSVC compiler, Windows SDK version, INCLUDE и LIB.
- Проверка свежести MSI/NSIS в `BUILD_EXE.bat` переведена на UTC ticks и invariant-culture parsing, чтобы не зависеть от локали Windows.
- Добавлены регрессионные проверки этих сценариев.



## 1.2.0 — Rust formatting release hotfix

- Приведены `src-tauri/build.rs`, `src-tauri/src/api.rs`, `src-tauri/src/audio.rs` и `src-tauri/src/main.rs` к выводу `rustfmt 1.11.0` из Windows Release Build.
- Проверки исходного кода API обновлены: они проверяют поведение независимо от переносов строк и форматирования `rustfmt`.
- Логика приложения и публичные интерфейсы Rust не изменялись.
