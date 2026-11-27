const MAX_QUEUE_ITEMS = 5000;
const REPEAT_MODES = new Set(['off', 'all', 'one']);

function cleanIds(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const candidate of value) {
    if (typeof candidate !== 'string') continue;
    const id = candidate.trim();
    if (!id || id.length > 256 || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= MAX_QUEUE_ITEMS) break;
  }
  return result;
}

export function createPlaybackSnapshot({
  queueIds = [],
  currentId = null,
  position = 0,
  shuffle = false,
  repeatMode = 'off'
} = {}) {
  const queue = cleanIds(queueIds);
  const current = typeof currentId === 'string' && currentId.trim() && currentId.length <= 256
    ? currentId.trim()
    : null;
  if (current && !queue.includes(current)) queue.unshift(current);
  const numericPosition = Number(position);
  return {
    schemaVersion: 1,
    queueIds: queue,
    currentId: current,
    position: Number.isFinite(numericPosition) ? Math.max(0, Math.min(86400, numericPosition)) : 0,
    shuffle: shuffle === true,
    repeatMode: REPEAT_MODES.has(repeatMode) ? repeatMode : 'off',
    savedAt: Date.now()
  };
}

export function restorePlaybackSnapshot(value, tracks) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1) return null;
  const available = new Set(
    (Array.isArray(tracks) ? tracks : [])
      .filter(track => track && typeof track.id === 'string' && !track.externalUrl)
      .map(track => track.id)
  );
  const queueIds = cleanIds(value.queueIds).filter(id => available.has(id));
  const currentId = typeof value.currentId === 'string' && available.has(value.currentId)
    ? value.currentId
    : null;
  if (currentId && !queueIds.includes(currentId)) queueIds.unshift(currentId);
  const position = Number(value.position);
  const savedAt = Number(value.savedAt);
  return {
    queueIds,
    currentId,
    position: Number.isFinite(position) ? Math.max(0, Math.min(86400, position)) : 0,
    shuffle: value.shuffle === true,
    repeatMode: REPEAT_MODES.has(value.repeatMode) ? value.repeatMode : 'off',
    savedAt: Number.isFinite(savedAt) && savedAt > 0 ? savedAt : 0
  };
}
