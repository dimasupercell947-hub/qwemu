import { classifyMusicUrl } from './music-url.js';

export const BACKUP_FORMAT = 'qwemu-music-backup';
export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

const THEMES = new Set(['dark-red', 'orange-night', 'midnight', 'pure-black', 'light']);
const SORT_MODES = new Set(['added-desc', 'title-asc', 'artist-asc', 'duration-desc']);
const text = (value, limit, fallback = '') => String(value ?? fallback).replace(/\0/g, '').trim().slice(0, limit);
const safeId = value => typeof value === 'string' && value.trim() && value.length <= 256 ? value.trim() : null;

function normalizeTrack(track) {
  if (!track || typeof track !== 'object' || Array.isArray(track)) return null;
  const id = safeId(track.id);
  if (!id) return null;
  const normalized = {
    id,
    name: text(track.name || track.title, 240, 'Без названия'),
    title: text(track.title || track.name, 160, 'Без названия'),
    artist: text(track.artist, 120),
    album: text(track.album, 120),
    lyrics: String(track.lyrics ?? '').slice(0, 100000),
    size: Number.isFinite(Number(track.size)) ? Math.max(0, Math.min(512 * 1024 * 1024, Number(track.size))) : 0,
    lastModified: Number.isFinite(Number(track.lastModified)) ? Math.max(0, Number(track.lastModified)) : 0,
    duration: Number.isFinite(Number(track.duration)) ? Math.max(0, Math.min(86400, Number(track.duration))) : 0,
    addedAt: Number.isFinite(Number(track.addedAt)) ? Math.max(0, Number(track.addedAt)) : 0
  };
  if (track.url && track.externalUrl) throw new TypeError('В резервной копии у одной записи указан более чем один источник.');
  if (track.url || track.externalUrl) {
    const source = track.url || track.externalUrl;
    const classified = classifyMusicUrl(source);
    if (!classified.ok) throw new TypeError('Резервная копия содержит недопустимую музыкальную ссылку.');
    if (track.url && classified.kind !== 'direct-audio') throw new TypeError('Ссылка на поток не является прямым аудиофайлом.');
    if (track.externalUrl && classified.kind !== 'music-site') throw new TypeError('Закладка не ведёт на поддерживаемую музыкальную платформу.');
    if (track.url) normalized.url = classified.url;
    else normalized.externalUrl = classified.url;
  }
  return normalized;
}

function normalizeTrack(track, { exportMode = false, warnings = [] } = {}) {
  if (!track || typeof track !== 'object' || Array.isArray(track)) return null;
  const id = safeId(track.id);
  if (!id) return null;
  const normalized = {
    id,
    name: text(track.name || track.title, 240, 'Без названия'),
    title: text(track.title || track.name, 160, 'Без названия'),
    artist: text(track.artist, 120),
    album: text(track.album, 120),
    lyrics: String(track.lyrics ?? '').slice(0, 100000),
    size: Number.isFinite(Number(track.size)) ? Math.max(0, Math.min(512 * 1024 * 1024, Number(track.size))) : 0,
    lastModified: Number.isFinite(Number(track.lastModified)) ? Math.max(0, Number(track.lastModified)) : 0,
    duration: Number.isFinite(Number(track.duration)) ? Math.max(0, Math.min(86400, Number(track.duration))) : 0,
    addedAt: Number.isFinite(Number(track.addedAt)) ? Math.max(0, Number(track.addedAt)) : 0
  };
  if (track.url && track.externalUrl) throw new TypeError('В резервной копии у одной записи указан более чем один источник.');
  if (track.url || track.externalUrl) {
    const source = track.url || track.externalUrl;
    const classified = classifyMusicUrl(source);
    if (!classified.ok) {
      if (!exportMode) throw new TypeError('Резервная копия содержит недопустимую музыкальную ссылку.');
      warnings.push('Источник трека «' + normalized.title + '» пропущен: ссылка больше не поддерживается.');
      return normalized;
    }
    if (classified.kind === 'direct-audio') {
      if (track.externalUrl && exportMode) {
        warnings.push('Ссылка трека «' + normalized.title + '» переклассифицирована как прямой аудиопоток.');
      } else if (track.externalUrl && !exportMode) {
        throw new TypeError('Закладка должна вести на поддерживаемую музыкальную платформу.');
      }
      normalized.url = classified.url;
    } else if (classified.kind === 'music-site') {
      if (track.url && exportMode) {
        warnings.push('Старая ссылка трека «' + normalized.title + '» преобразована в закладку музыкальной платформы.');
      } else if (track.url && !exportMode) {
        throw new TypeError('Ссылка на поток не является прямым аудиофайлом.');
      }
      normalized.externalUrl = classified.url;
    } else {
      if (!exportMode) throw new TypeError('Резервная копия содержит недопустимый источник.');
      warnings.push('Источник трека «' + normalized.title + '» пропущен.');
    }
  }
  return normalized;
}

function normalizeSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const volume = Number(source.volume);
  return {
    theme: THEMES.has(source.theme) ? source.theme : 'dark-red',
    volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.8,
    reducedMotion: source.reducedMotion === true,
    backgroundPlayback: source.backgroundPlayback !== false
  };
}

function normalizeHistory(value, knownIds) {
  if (!Array.isArray(value)) return [];
  const latest = new Map();
  for (const row of value) {
    const trackId = safeId(row?.trackId);
    const playedAt = Number(row?.playedAt);
    if (!trackId || !knownIds.has(trackId) || !Number.isFinite(playedAt) || playedAt <= 0) continue;
    const previous = latest.get(trackId);
    if (!previous || playedAt > previous.playedAt) latest.set(trackId, { trackId, playedAt: Math.floor(playedAt) });
  }
  return [...latest.values()].sort((a, b) => b.playedAt - a.playedAt).slice(0, 100);
}

function normalizeCollections(value, knownIds) {
  if (!Array.isArray(value)) return [];
  const used = new Set();
  const result = [];
  for (const row of value.slice(0, 300)) {
    const id = safeId(row?.id);
    const name = text(row?.name, 60);
    if (!id || !name || used.has(id)) continue;
    used.add(id);
    const trackIds = [...new Set((Array.isArray(row.trackIds) ? row.trackIds : [])
      .map(safeId).filter(trackId => trackId && knownIds.has(trackId)))].slice(0, 5000);
    result.push({ id, name, description: text(row.description, 160), trackIds });
  }
  return result;
}

export function mergeBackupCollections({
  currentFavorites = [],
  backupFavorites = [],
  currentPlaylists = [],
  backupPlaylists = [],
  currentHistory = [],
  backupHistory = [],
  availableTrackIds = []
} = {}) {
  const available = availableTrackIds instanceof Set
    ? availableTrackIds
    : new Set(Array.isArray(availableTrackIds) ? availableTrackIds : []);
  const cleanFavorites = value => [...new Set((Array.isArray(value) ? value : [])
    .map(safeId).filter(id => id && available.has(id)))];
  const favorites = [...new Set([
    ...cleanFavorites(currentFavorites),
    ...cleanFavorites(backupFavorites)
  ])].slice(0, 5000);

  const playlists = [];
  const byPlaylistId = new Map();
  for (const row of [...(Array.isArray(currentPlaylists) ? currentPlaylists : []), ...(Array.isArray(backupPlaylists) ? backupPlaylists : [])]) {
    const id = safeId(row?.id);
    const name = text(row?.name, 60);
    if (!id || !name) continue;
    const trackIds = [...new Set((Array.isArray(row.trackIds) ? row.trackIds : [])
      .map(safeId).filter(trackId => trackId && available.has(trackId)))].slice(0, 5000);
    const previous = byPlaylistId.get(id);
    if (previous) {
      previous.trackIds = [...new Set([...previous.trackIds, ...trackIds])].slice(0, 5000);
      if (!previous.description && row.description) previous.description = text(row.description, 160);
      continue;
    }
    if (playlists.length >= 300) continue;
    const normalized = { id, name, description: text(row.description, 160), trackIds };
    byPlaylistId.set(id, normalized);
    playlists.push(normalized);
  }

  const history = normalizeHistory([
    ...(Array.isArray(currentHistory) ? currentHistory : []),
    ...(Array.isArray(backupHistory) ? backupHistory : [])
  ], available);

  return { favorites, playlists, playHistory: history };
}

function checkSize(source) {
  const bytes = new TextEncoder().encode(source).byteLength;
  if (bytes > MAX_BACKUP_BYTES) throw new RangeError('Файл резервной копии превышает лимит 8 МиБ.');
}

export function createBackup({
  appVersion = '2.0.0',
  tracks = [],
  favorites = [],
  playlists = [],
  settings = {},
  playHistory = [],
  sortMode = 'added-desc'
} = {}) {
  const safeTracks = [];
  const seen = new Set();
  const warnings = [];
  for (const row of (Array.isArray(tracks) ? tracks : []).slice(0, 5000)) {
    const track = normalizeTrack(row, { exportMode: true, warnings });
    if (track && !seen.has(track.id)) {
      seen.add(track.id);
      safeTracks.push(track);
    }
  }
  const backup = {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: text(appVersion, 32, '2.0.0'),
    exportedAt: new Date().toISOString(),
    includesAudioFiles: false,
    tracks: safeTracks,
    favorites: [...new Set((Array.isArray(favorites) ? favorites : []).map(safeId).filter(id => id && seen.has(id)))].slice(0, 5000),
    playlists: normalizeCollections(playlists, seen),
    settings: normalizeSettings(settings),
    playHistory: normalizeHistory(playHistory, seen),
    sortMode: SORT_MODES.has(sortMode) ? sortMode : 'added-desc',
    warnings: warnings.slice(0, 100)
  };
  checkSize(JSON.stringify(backup));
  return backup;
}

export function parseBackup(source) {
  if (typeof source !== 'string') throw new TypeError('Содержимое резервной копии должно быть текстом JSON.');
  checkSize(source);
  let parsed;
  try { parsed = JSON.parse(source); }
  catch { throw new TypeError('Файл не является корректным JSON.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
      parsed.format !== BACKUP_FORMAT || parsed.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new TypeError('Формат или версия резервной копии QWEMU не поддерживается.');
  }
  if (!Array.isArray(parsed.tracks) || parsed.tracks.length > 5000) {
    throw new RangeError('В резервной копии должно быть не более 5000 записей медиатеки.');
  }
  const tracks = [];
  const seen = new Set();
  for (const row of parsed.tracks) {
    const track = normalizeTrack(row);
    if (!track || seen.has(track.id)) continue;
    seen.add(track.id);
    tracks.push(track);
  }
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: text(parsed.appVersion, 32, 'unknown'),
    exportedAt: text(parsed.exportedAt, 40),
    includesAudioFiles: false,
    tracks,
    favorites: [...new Set((Array.isArray(parsed.favorites) ? parsed.favorites : []).map(safeId).filter(id => id && seen.has(id)))].slice(0, 5000),
    playlists: normalizeCollections(parsed.playlists, seen),
    settings: normalizeSettings(parsed.settings),
    playHistory: normalizeHistory(parsed.playHistory, seen),
    sortMode: SORT_MODES.has(parsed.sortMode) ? parsed.sortMode : 'added-desc',
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter(item => typeof item === 'string').slice(0, 100).map(item => text(item, 180)) : []
  };
}
