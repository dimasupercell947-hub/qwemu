export const HISTORY_LIMIT = 100;
export function normalizePlayHistory(value, limit = HISTORY_LIMIT) {
  if (!Array.isArray(value)) return [];
  const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(HISTORY_LIMIT, limit)) : HISTORY_LIMIT;
  const latestByTrack = new Map();
  for (const item of value) {
    if (!item || typeof item.trackId !== "string" || !item.trackId.trim()) continue;
    const playedAt = Number(item.playedAt);
    if (!Number.isFinite(playedAt) || playedAt <= 0) continue;
    const entry = { trackId: item.trackId, playedAt: Math.floor(playedAt) };
    const current = latestByTrack.get(entry.trackId);
    if (!current || entry.playedAt > current.playedAt) latestByTrack.set(entry.trackId, entry);
  }
  return [...latestByTrack.values()].sort((a, b) => b.playedAt - a.playedAt).slice(0, safeLimit);
}
export function recordPlay(history, trackId, playedAt = Date.now()) {
  if (typeof trackId !== "string" || !trackId.trim()) return normalizePlayHistory(history);
  const timestamp = Number(playedAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return normalizePlayHistory(history);
  return normalizePlayHistory([{ trackId, playedAt: timestamp }, ...normalizePlayHistory(history)]);
}
export function resolveHistoryTracks(history, tracks) {
  const byId = new Map((Array.isArray(tracks) ? tracks : []).filter(t => t && typeof t.id === "string").map(t => [t.id, t]));
  return normalizePlayHistory(history).map(entry => ({ track: byId.get(entry.trackId), playedAt: entry.playedAt })).filter(entry => Boolean(entry.track));
}
