const MAX_PLAYLIST_BYTES = 2 * 1024 * 1024;
const MAX_PLAYLIST_ENTRIES = 5000;
function cleanLine(value, limit = 240) { return String(value ?? "").replace(/[\r\n\0]/g, " ").trim().slice(0, limit); }
function normalizeKey(value) { return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU"); }
function basename(value) { const normalized = String(value ?? "").replace(/\\/g, "/"); return normalized.slice(normalized.lastIndexOf("/") + 1); }
export function exportPlaylistM3u(playlist, tracks) {
  if (!playlist || typeof playlist.name !== "string" || !Array.isArray(playlist.trackIds)) throw new TypeError("Некорректный плейлист.");
  const byId = new Map((Array.isArray(tracks) ? tracks : []).filter(t => t && typeof t.id === "string").map(t => [t.id, t]));
  const lines = ["#EXTM3U", "#PLAYLIST:" + cleanLine(playlist.name, 120)];
  for (const id of [...new Set(playlist.trackIds)].slice(0, MAX_PLAYLIST_ENTRIES)) {
    const track = byId.get(id);
    if (!track) continue;
    const duration = Number(track.duration);
    const seconds = Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : -1;
    const label = cleanLine((track.artist ? String(track.artist) + " - " : "") + (track.title || track.name || "Без названия"));
    lines.push("#EXTINF:" + seconds + "," + label, "#QWEMU-ID:" + cleanLine(track.id, 256), cleanLine(track.name || track.title || track.id, 512));
  }
  return lines.join("\r\n") + "\r\n";
}
export function parsePlaylistM3u(source, tracks) {
  if (typeof source !== "string") throw new TypeError("Содержимое M3U должно быть текстом.");
  if (source.length > MAX_PLAYLIST_BYTES) throw new RangeError("Файл плейлиста превышает лимит 2 МиБ.");
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  const first = lines.find(line => line.trim());
  if (!first || first.trim().toUpperCase() !== "#EXTM3U") throw new TypeError("Файл не является корректным плейлистом M3U/M3U8.");
  const library = (Array.isArray(tracks) ? tracks : []).filter(t => t && typeof t.id === "string");
  const byId = new Map(library.map(t => [t.id, t])), byName = new Map(), byLabel = new Map();
  for (const track of library) {
    const nameKey = normalizeKey(basename(track.name || ""));
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, track);
    const labelKey = normalizeKey((track.artist ? String(track.artist) + " - " : "") + (track.title || ""));
    if (labelKey && !byLabel.has(labelKey)) byLabel.set(labelKey, track);
  }
  let name = "", pendingId = "", pendingLabel = "", unmatched = 0, entries = 0;
  const trackIds = [], included = new Set();
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#PLAYLIST:")) { name = cleanLine(line.slice(10), 120); continue; }
    if (line.startsWith("#QWEMU-ID:")) { pendingId = cleanLine(line.slice(10), 256); continue; }
    if (line.startsWith("#EXTINF:")) { const comma = line.indexOf(","); pendingLabel = comma >= 0 ? cleanLine(line.slice(comma + 1)) : ""; continue; }
    if (line.startsWith("#")) continue;
    entries += 1;
    if (entries > MAX_PLAYLIST_ENTRIES) throw new RangeError("Плейлист содержит более 5000 записей.");
    const matched = byId.get(pendingId) || byName.get(normalizeKey(basename(line))) || byLabel.get(normalizeKey(pendingLabel));
    if (matched) { if (!included.has(matched.id)) { included.add(matched.id); trackIds.push(matched.id); } }
    else unmatched += 1;
    pendingId = ""; pendingLabel = "";
  }
  return { name, trackIds, unmatched, entries };
}
