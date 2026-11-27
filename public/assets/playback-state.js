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
  shuffleBackupIds = [],
  pendingResume = null,
  repeatMode = 'off'
} = {}) {
  const queue = cleanIds(queueIds);
  const pending = pendingResume && typeof pendingResume === 'object' ? pendingResume : null;
  const activeId = typeof currentId === 'string' && currentId.trim() && currentId.length <= 256
    ? currentId.trim()
    : null;
  const pendingId = typeof pending?.currentId === 'string' && pending.currentId.trim() && pending.currentId.length <= 256
    ? pending.currentId.trim()
    : null;
  const current = activeId || pendingId;
  const effectivePosition = activeId
    ? position
    : (pendingId ? pending.position : position);
  if (!queue.length && pending && Array.isArray(pending.queueIds)) queue.push(...cleanIds(pending.queueIds));
  if (current && !queue.includes(current)) queue.unshift(current);
  const numericPosition = Number(effectivePosition);
  return {
    schemaVersion: 1,
    queueIds: queue,
    currentId: current,
    position: Number.isFinite(numericPosition) ? Math.max(0, Math.min(86400, numericPosition)) : 0,
    shuffle: shuffle === true,
    shuffleBackupIds: cleanIds(shuffleBackupIds),
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
  const shuffleBackupIds = cleanIds(value.shuffleBackupIds).filter(id => available.has(id));
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
    shuffleBackupIds,
    repeatMode: REPEAT_MODES.has(value.repeatMode) ? value.repeatMode : 'off',
    savedAt: Number.isFinite(savedAt) && savedAt > 0 ? savedAt : 0
  };
}
