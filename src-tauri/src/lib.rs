use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};

use tauri::Emitter;
use tauri_plugin_updater::UpdaterExt;

const UPDATER_PUBLIC_KEY: &str = match option_env!("QWEMU_UPDATER_PUBLIC_KEY") {
    Some(value) => value,
    None => "",
};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateInfo {
    version: String,
    current_version: String,
    notes: Option<String>,
    published_at: Option<String>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProgress {
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
}

fn require_updater_key() -> Result<(), String> {
    if UPDATER_PUBLIC_KEY.trim().is_empty() {
        return Err(
            "Автообновление ещё не настроено: разработчик должен добавить публичный ключ подписи QWEMU в сборку."
                .to_string(),
        );
    }
    Ok(())
}

#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    require_updater_key()?;

    let updater = app
        .updater_builder()
        .build()
        .map_err(|error| format!("Не удалось подготовить проверку обновлений: {error}"))?;

    let update = updater
        .check()
        .await
        .map_err(|error| format!("Сервер обновлений недоступен: {error}"))?;

    Ok(update.map(|update| UpdateInfo {
        version: update.version,
        current_version: update.current_version,
        notes: update.body,
        published_at: update.date.map(|date| date.to_string()),
    }))
}

#[tauri::command]
async fn install_update(
    app: tauri::AppHandle,
    expected_version: String,
) -> Result<(), String> {
    require_updater_key()?;

    let updater = app
        .updater_builder()
        .build()
        .map_err(|error| format!("Не удалось подготовить установщик обновления: {error}"))?;

    // Re-check immediately before installation so stale UI state cannot install
    // a different release than the version the user explicitly selected.
    let update = updater
        .check()
        .await
        .map_err(|error| format!("Не удалось повторно проверить обновление: {error}"))?
        .ok_or_else(|| "Выбранная версия больше не доступна для обновления.".to_string())?;

    if update.version != expected_version {
        return Err(format!(
            "Версия обновления изменилась: ожидалась {expected_version}, сервер сообщает {}. Проверь обновления ещё раз.",
            update.version
        ));
    }

    let downloaded = Arc::new(AtomicU64::new(0));
    let chunk_counter = Arc::clone(&downloaded);
    let finish_counter = Arc::clone(&downloaded);
    let progress_app = app.clone();
    let finish_app = app.clone();

    update
        .download_and_install(
            move |chunk_length, content_length| {
                let current = chunk_counter
                    .fetch_add(chunk_length as u64, Ordering::Relaxed)
                    + chunk_length as u64;
                let _ = progress_app.emit(
                    "qwemu-updater-progress",
                    UpdateProgress {
                        downloaded_bytes: current,
                        total_bytes: content_length,
                    },
                );
            },
            move || {
                let _ = finish_app.emit(
                    "qwemu-updater-progress",
                    UpdateProgress {
                        downloaded_bytes: finish_counter.load(Ordering::Relaxed),
                        total_bytes: None,
                    },
                );
            },
        )
        .await
        .map_err(|error| format!("Не удалось проверить подпись или установить обновление: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_updater::Builder::new()
                .pubkey(UPDATER_PUBLIC_KEY.to_owned())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            check_for_updates,
            install_update
        ])
        .run(tauri::generate_context!())
        .expect("failed to run QWEMU MUSIC Desktop");
}
