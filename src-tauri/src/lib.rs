use std::{
    net::{IpAddr, SocketAddr},
    path::PathBuf,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use tauri::Manager;
use tokio::io::AsyncWriteExt;

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
async fn install_update(app: tauri::AppHandle, expected_version: String) -> Result<(), String> {
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
                let current = chunk_counter.fetch_add(chunk_length as u64, Ordering::Relaxed)
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

const MAX_OPENVERSE_DOWNLOAD_BYTES: u64 = 150 * 1024 * 1024;
const AUDIO_RESPONSE_HEADERS_TIMEOUT: Duration = Duration::from_secs(30);
const AUDIO_CHUNK_STALL_TIMEOUT: Duration = Duration::from_secs(45);
const ALLOWED_OPENVERSE_LICENSES: &[&str] = &["cc0", "pdm", "by", "by-sa"];

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenverseDownloadRequest {
    url: String,
    source_url: String,
    license_url: String,
    license_code: String,
    license_version: String,
    title: String,
    creator: String,
    attribution: String,
    file_type: String,
}

fn safe_public_https_url(value: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(value).map_err(|_| "Некорректная HTTPS-ссылка.".to_string())?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some_and(|port| port != 443)
    {
        return Err(
            "Разрешены только общедоступные HTTPS-ссылки без логина и нестандартного порта."
                .to_string(),
        );
    }
    let host = url
        .host_str()
        .ok_or_else(|| "В ссылке отсутствует имя хоста.".to_string())?
        .to_ascii_lowercase();
    if host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || host.ends_with(".internal")
        || host.ends_with(".lan")
        || host.ends_with(".home")
        || host.ends_with(".test")
        || host.parse::<IpAddr>().is_ok()
        || !host.contains('.')
    {
        return Err("Локальные адреса, IP-адреса и непубличные имена запрещены.".to_string());
    }
    Ok(url)
}

fn safe_license_url(value: &str) -> Result<reqwest::Url, String> {
    let url = safe_public_https_url(value)?;
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    if host != "creativecommons.org" && !host.ends_with(".creativecommons.org") {
        return Err("Ссылка на лицензию должна вести на Creative Commons.".to_string());
    }
    Ok(url)
}

fn address_is_private(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(ip) => {
            ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_broadcast()
                || ip.is_unspecified()
                || ip.is_multicast()
                || ip.octets()[0] == 0
                || ip.octets()[0] >= 240
        }
        IpAddr::V6(ip) => {
            ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_unique_local()
                || ip.is_unicast_link_local()
                || ip.is_multicast()
                || ip
                    .to_ipv4()
                    .is_some_and(|mapped| address_is_private(IpAddr::V4(mapped)))
        }
    }
}

async fn get_public_audio_response(url: &reqwest::Url) -> Result<reqwest::Response, String> {
    let host = url
        .host_str()
        .ok_or_else(|| "В аудиоссылке отсутствует домен.".to_string())?;
    let port = url.port_or_known_default().unwrap_or(443);
    let addresses: Vec<SocketAddr> = tokio::net::lookup_host((host, port))
        .await
        .map_err(|error| format!("Не удалось проверить адрес аудиоисточника: {error}"))?
        .collect();
    if addresses.is_empty()
        || addresses
            .iter()
            .any(|address| address_is_private(address.ip()))
    {
        return Err("Аудиоисточник разрешается в локальный или недопустимый IP-адрес.".to_string());
    }
    // Pin validated DNS results. Redirects are resolved and checked again.
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(8))
        .resolve_to_addrs(host, &addresses)
        .build()
        .map_err(|error| format!("Не удалось подготовить безопасное соединение: {error}"))?;
    let request = client
        .get(url.clone())
        .header(reqwest::header::USER_AGENT, "QWEMU-MUSIC/2.0.3")
        .header(
            reqwest::header::ACCEPT,
            "audio/*, application/ogg, application/octet-stream",
        );
    tokio::time::timeout(AUDIO_RESPONSE_HEADERS_TIMEOUT, request.send())
        .await
        .map_err(|_| "Аудиоисточник не прислал заголовки за 30 секунд.".to_string())?
        .map_err(|error| format!("Не удалось загрузить аудиофайл: {error}"))
}

async fn fetch_public_audio(start: reqwest::Url) -> Result<reqwest::Response, String> {
    let mut current = start;
    for _ in 0..=5 {
        let response = get_public_audio_response(&current).await?;
        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or_else(|| "Аудиоисточник вернул перенаправление без Location.".to_string())?;
            current = current
                .join(location)
                .map_err(|_| "Аудиоисточник вернул некорректное перенаправление.".to_string())?;
            current = safe_public_https_url(current.as_str())?;
            continue;
        }
        if !response.status().is_success() {
            return Err(format!("Аудиоисточник ответил HTTP {}.", response.status()));
        }
        return Ok(response);
    }
    Err("Слишком много перенаправлений от аудиоисточника.".to_string())
}

fn clean_metadata_line(value: &str, max_chars: usize) -> String {
    value
        .chars()
        .filter(|ch| !ch.is_control())
        .take(max_chars)
        .collect::<String>()
        .trim()
        .to_string()
}

fn safe_filename_stem(value: &str) -> String {
    let filtered = value
        .chars()
        .map(|ch| {
            if ch.is_control()
                || ch == char::from(92)
                || matches!(ch, '<' | '>' | ':' | '"' | '/' | '|' | '?' | '*')
            {
                '_'
            } else {
                ch
            }
        })
        .collect::<String>();
    let trimmed = filtered.trim_matches(|ch: char| ch == '.' || ch.is_whitespace());
    let mut stem = trimmed.chars().take(80).collect::<String>();
    if stem.is_empty() {
        stem = "QWEMU-Open-Audio".to_string();
    }
    let upper = stem.to_ascii_uppercase();
    if [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ]
    .contains(&upper.as_str())
    {
        stem.insert(0, '_');
    }
    stem
}

fn safe_audio_extension(
    file_type: &str,
    content_type: &str,
    url: &reqwest::Url,
) -> Result<&'static str, String> {
    let mime = content_type
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let mime_extension = match mime.as_str() {
        "audio/mpeg" | "audio/mp3" | "audio/x-mp3" => "mp3",
        "audio/wav" | "audio/x-wav" | "audio/wave" => "wav",
        "audio/flac" | "audio/x-flac" => "flac",
        "audio/ogg" | "application/ogg" => "ogg",
        "audio/opus" => "opus",
        "audio/aac" | "audio/aacp" => "aac",
        "audio/mp4" | "audio/x-m4a" | "video/mp4" => "m4a",
        "audio/webm" => "webm",
        "audio/3gpp" => "3gp",
        _ => "",
    };
    if !mime_extension.is_empty() {
        return Ok(mime_extension);
    }

    let candidate = file_type.to_ascii_lowercase();
    let mime_or_extension = candidate
        .rsplit('/')
        .next()
        .unwrap_or(candidate.as_str());
    let mapped = match mime_or_extension {
        "mpeg" | "mp3" | "x-mp3" | "mp32" => "mp3",
        "wav" | "x-wav" | "wave" => "wav",
        "flac" | "x-flac" => "flac",
        "ogg" => "ogg",
        "oga" => "oga",
        "opus" => "opus",
        "aac" | "adts" => "aac",
        "mp4" | "m4a" | "x-m4a" | "mp4a-latm" => "m4a",
        "webm" => "webm",
        "3gp" => "3gp",
        "m4b" => "m4b",
        _ => "",
    };
    if !mapped.is_empty() {
        return Ok(mapped);
    }

    let path_segment = url.path().rsplit('/').next().unwrap_or("");
    let path_extension = path_segment
        .rsplit_once('.')
        .map(|(_, extension)| extension)
        .unwrap_or(path_segment)
        .to_ascii_lowercase();
    match path_extension.as_str() {
        "mp3" | "mp32" => Ok("mp3"),
        "wav" => Ok("wav"),
        "flac" => Ok("flac"),
        "ogg" => Ok("ogg"),
        "oga" => Ok("oga"),
        "opus" => Ok("opus"),
        "aac" => Ok("aac"),
        "m4a" | "mp4" => Ok("m4a"),
        "webm" => Ok("webm"),
        "3gp" => Ok("3gp"),
        "m4b" => Ok("m4b"),
        _ => Err(
            "Не удалось определить поддерживаемый аудиоформат. Источник не будет сохранён как неизвестный файл."
                .to_string(),
        ),
    }
}

struct DownloadReservation {
    marker: PathBuf,
}

impl Drop for DownloadReservation {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.marker);
    }
}

fn reserve_unique_download_path(
    folder: &std::path::Path,
    stem: &str,
    extension: &str,
) -> Result<(PathBuf, PathBuf, DownloadReservation), String> {
    let mut index = 1u32;
    loop {
        let suffix = if index == 1 {
            String::new()
        } else {
            format!(" ({index})")
        };
        let path = folder.join(format!("{stem}{suffix}.{extension}"));
        let sidecar = folder.join(format!("{stem}{suffix}.license.txt"));
        let marker = folder.join(format!(".{stem}{suffix}.qwemu-reserve"));
        match std::fs::OpenOptions::new().write(true).create_new(true).open(&marker) {
            Ok(file) => {
                drop(file);
                let reservation = DownloadReservation { marker };
                if path.exists() || sidecar.exists() {
                    drop(reservation);
                    index = index.saturating_add(1);
                    continue;
                }
                return Ok((path, sidecar, reservation));
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                index = index.saturating_add(1);
            }
            Err(error) => {
                return Err(format!("Не удалось зарезервировать имя загрузки: {error}"));
            }
        }
        if index == u32::MAX {
            return Err("Не удалось подобрать свободное имя файла.".to_string());
        }
    }
}

#[tauri::command]
async fn download_openverse_audio(
    app: tauri::AppHandle,
    request: OpenverseDownloadRequest,
) -> Result<String, String> {
    let license_code = request.license_code.to_ascii_lowercase();
    if !ALLOWED_OPENVERSE_LICENSES.contains(&license_code.as_str()) {
        return Err(
            "Скачивание разрешено только для CC0, Public Domain, CC BY и CC BY-SA.".to_string(),
        );
    }
    let source_url = safe_public_https_url(&request.source_url)?;
    let license_url = safe_license_url(&request.license_url)?;
    let media_url = safe_public_https_url(&request.url)?;
    if request.title.trim().is_empty()
        || request.title.len() > 480
        || request.creator.len() > 360
        || request.attribution.len() > 2400
        || request.license_version.len() > 20
        || request.file_type.len() > 40
    {
        return Err("Метаданные трека имеют недопустимую длину.".to_string());
    }

    let response = fetch_public_audio(media_url.clone()).await?;
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    if !(content_type.starts_with("audio/")
        || content_type == "application/ogg"
        || content_type == "application/octet-stream")
    {
        return Err(
            "Источник не вернул аудиофайл. Скачивание HTML-страниц и видео запрещено.".to_string(),
        );
    }
    if response
        .content_length()
        .is_some_and(|size| size > MAX_OPENVERSE_DOWNLOAD_BYTES)
    {
        return Err("Размер аудиофайла превышает лимит 150 МиБ.".to_string());
    }
    let final_media_url = response.url().clone();

    let download_root = app
        .path()
        .download_dir()
        .map_err(|error| format!("Не удалось определить папку «Загрузки»: {error}"))?;
    let folder = download_root.join("QWEMU PLUS");
    tokio::fs::create_dir_all(&folder)
        .await
        .map_err(|error| format!("Не удалось создать папку загрузок QWEMU PLUS: {error}"))?;

    let extension = safe_audio_extension(&request.file_type, &content_type, &final_media_url)?;
    let stem = safe_filename_stem(&request.title);
    let (destination, sidecar, _reservation) =
        reserve_unique_download_path(&folder, &stem, extension)?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let part_path = destination.with_extension(format!("{extension}.{nonce}.part"));
    let sidecar_part = sidecar.with_extension(format!("txt.{nonce}.part"));

    let mut file = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&part_path)
        .await
        .map_err(|error| format!("Не удалось создать временный файл аудио: {error}"))?;
    let mut response = response;
    let mut total = 0u64;
    loop {
        let next = match tokio::time::timeout(AUDIO_CHUNK_STALL_TIMEOUT, response.chunk()).await {
            Ok(Ok(value)) => value,
            Ok(Err(error)) => {
                drop(file);
                let _ = tokio::fs::remove_file(&part_path).await;
                return Err(format!("Ошибка чтения аудиоисточника: {error}"));
            }
            Err(_) => {
                drop(file);
                let _ = tokio::fs::remove_file(&part_path).await;
                return Err("Аудиоисточник не передавал данные 45 секунд. Загрузка остановлена; временный файл удалён.".to_string());
            }
        };
        let Some(chunk) = next else {
            break;
        };
        total = total.saturating_add(chunk.len() as u64);
        if total > MAX_OPENVERSE_DOWNLOAD_BYTES {
            drop(file);
            let _ = tokio::fs::remove_file(&part_path).await;
            return Err("Размер аудиофайла превышает лимит 150 МиБ.".to_string());
        }
        if let Err(error) = file.write_all(&chunk).await {
            drop(file);
            let _ = tokio::fs::remove_file(&part_path).await;
            return Err(format!("Не удалось записать аудиофайл: {error}"));
        }
    }
    if total == 0 {
        drop(file);
        let _ = tokio::fs::remove_file(&part_path).await;
        return Err("Источник вернул пустой аудиофайл.".to_string());
    }
    if let Err(error) = file.flush().await {
        drop(file);
        let _ = tokio::fs::remove_file(&part_path).await;
        return Err(format!("Не удалось завершить запись аудио: {error}"));
    }
    drop(file);
    if let Err(error) = tokio::fs::rename(&part_path, &destination).await {
        let _ = tokio::fs::remove_file(&part_path).await;
        return Err(format!(
            "Не удалось сохранить аудиофайл в папку загрузок: {error}"
        ));
    }

    let title = clean_metadata_line(&request.title, 160);
    let creator = clean_metadata_line(&request.creator, 120);
    let attribution = clean_metadata_line(&request.attribution, 1200);
    let sidecar_text = format!(
        "QWEMU PLUS — сведения об аудиозаписи\n\nНазвание: {title}\nАвтор: {creator}\nЛицензия: {} {}\nУсловия лицензии: {}\nОригинальная страница: {}\n\nАтрибуция из каталога:\n{attribution}\n\nПеред повторным распространением проверь лицензию и права на оригинальной странице записи.\n",
        license_code.to_ascii_uppercase(),
        clean_metadata_line(&request.license_version, 20),
        license_url.as_str(),
        source_url.as_str()
    );
    if let Err(error) = tokio::fs::write(&sidecar_part, sidecar_text).await {
        let _ = tokio::fs::remove_file(&destination).await;
        return Err(format!(
            "Аудио получено, но не удалось записать сведения о лицензии: {error}"
        ));
    }
    if let Err(error) = tokio::fs::rename(&sidecar_part, &sidecar).await {
        let _ = tokio::fs::remove_file(&sidecar_part).await;
        let _ = tokio::fs::remove_file(&destination).await;
        return Err(format!(
            "Не удалось сохранить файл атрибуции, аудиофайл удалён: {error}"
        ));
    }

    Ok(destination.to_string_lossy().to_string())
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
            install_update,
            download_openverse_audio
        ])
        .run(tauri::generate_context!())
        .expect("failed to run QWEMU MUSIC Desktop");
}

#[cfg(test)]
mod openverse_download_tests {
    use super::*;

    #[test]
    fn only_public_https_media_urls_are_allowed() {
        assert!(safe_public_https_url("https://cdn.example.org/audio/song.mp3").is_ok());
        for value in [
            "http://cdn.example.org/song.mp3",
            "https://localhost/song.mp3",
            "https://nas.local/song.mp3",
            "https://127.0.0.1/song.mp3",
            "https://user:pass@cdn.example.org/song.mp3",
            "https://cdn.example.org:8443/song.mp3",
        ] {
            assert!(safe_public_https_url(value).is_err(), "{value}");
        }
    }

    #[test]
    fn licence_url_must_be_creative_commons_and_https() {
        assert!(safe_license_url("https://creativecommons.org/licenses/by/4.0/").is_ok());
        assert!(safe_license_url("https://evil.example/license").is_err());
        assert!(safe_license_url("http://creativecommons.org/licenses/by/4.0/").is_err());
    }

    #[test]
    fn windows_device_names_are_never_used_for_downloads() {
        assert_eq!(safe_filename_stem("CON"), "_CON");
        assert!(!safe_filename_stem("../Bad:name").contains('/'));
        assert!(!safe_filename_stem(" ").is_empty());
    }

    #[test]
    fn private_and_special_ip_addresses_are_rejected_after_dns_resolution() {
        for value in [
            "127.0.0.1",
            "10.0.0.1",
            "169.254.10.1",
            "192.168.1.1",
            "::1",
            "fc00::1",
        ] {
            let parsed: IpAddr = value.parse().unwrap();
            assert!(address_is_private(parsed), "{value}");
        }
        let public: IpAddr = "1.1.1.1".parse().unwrap();
        assert!(!address_is_private(public));
    }

    #[test]
    fn extensions_are_selected_from_a_whitelist() {
        let url = reqwest::Url::parse("https://cdn.example.org/music/track.mp3").unwrap();
        assert_eq!(
            safe_audio_extension("mp32", "audio/mpeg", &url),
            Ok("mp3")
        );
        let extensionless =
            reqwest::Url::parse("https://cdn.example.org/api/track/123/mp32").unwrap();
        assert_eq!(
            safe_audio_extension("mp32", "application/octet-stream", &extensionless),
            Ok("mp3")
        );
        assert_eq!(
            safe_audio_extension("audio/ogg", "application/ogg", &extensionless),
            Ok("ogg")
        );
        assert_eq!(
            safe_audio_extension("unknown", "application/octet-stream", &url),
            Ok("mp3")
        );
        let unknown =
            reqwest::Url::parse("https://cdn.example.org/api/track/123").unwrap();
        assert!(safe_audio_extension("", "application/octet-stream", &unknown).is_err());
    }
}

#[cfg(test)]
mod download_reservation_tests {
    use super::*;

    #[test]
    fn concurrent_downloads_reserve_distinct_audio_and_attribution_names() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let folder = std::env::temp_dir().join(format!("qwemu-plus-reservation-{nonce}"));
        std::fs::create_dir_all(&folder).unwrap();

        let (first_audio, first_sidecar, first_guard) =
            reserve_unique_download_path(&folder, "Untitled", "mp3").unwrap();
        let (second_audio, second_sidecar, second_guard) =
            reserve_unique_download_path(&folder, "Untitled", "mp3").unwrap();

        assert_ne!(first_audio, second_audio);
        assert_ne!(first_sidecar, second_sidecar);
        assert!(first_audio.ends_with("Untitled.mp3"));
        assert!(second_audio.ends_with("Untitled (2).mp3"));

        drop(first_guard);
        drop(second_guard);
        std::fs::remove_dir_all(folder).unwrap();
    }
}
