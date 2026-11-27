const MAX_QUEUE_ITEMS = 5000;

function uniqueIds(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || id.length > 256 || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= MAX_QUEUE_ITEMS) break;
  }
  return result;
}

function shuffleIds(ids, random = Math.random) {
  const result = [...ids];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const value = Number(random());
    const safe = Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0.5;
    const target = Math.floor(safe * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function insertAfterCurrent(queue, currentId, additions) {
  if (!currentId) return [...additions, ...queue];
  const currentIndex = queue.indexOf(currentId);
  if (currentIndex < 0) return [currentId, ...additions, ...queue.filter(id => id !== currentId)].slice(0, MAX_QUEUE_ITEMS);
  return [
    ...queue.slice(0, currentIndex + 1),
    ...additions,
    ...queue.slice(currentIndex + 1)
  ].slice(0, MAX_QUEUE_ITEMS);
}

export function buildBulkQueueUpdate({
  queueIds = [],
  currentId = null,
  selectedIds = [],
  shuffle = false,
  shuffleBackupIds = [],
  random = Math.random
} = {}) {
  const queue = uniqueIds(queueIds);
  const selected = uniqueIds(selectedIds);
  const current = typeof currentId === 'string' && currentId.trim() ? currentId.trim() : null;
  const additions = selected.filter(id => !queue.includes(id) && id !== current);
  const addedCount = additions.length;

  if (!shuffle) {
    return {
      queueIds: insertAfterCurrent(queue, current, additions),
      shuffleBackupIds: [],
      addedCount
    };
  }

  const backupBase = uniqueIds(shuffleBackupIds);
  const stableBase = backupBase.length ? backupBase : queue;
  const nextBackup = insertAfterCurrent(stableBase, current, additions);
  const currentIndex = current ? queue.indexOf(current) : -1;
  const prefix = currentIndex >= 0 ? queue.slice(0, currentIndex + 1) : [];
  const upcoming = currentIndex >= 0 ? queue.slice(currentIndex + 1) : queue;
  const shuffledUpcoming = shuffleIds([...additions, ...upcoming], random);

  return {
    queueIds: [...prefix, ...shuffledUpcoming].slice(0, MAX_QUEUE_ITEMS),
    shuffleBackupIds: nextBackup,
    addedCount
  };
}

export function resolveTransportQueue({ page = 'library', currentId = null, preparedQueue = [], pageQueue = [] } = {}) {
  const prepared = uniqueIds(preparedQueue);
  if (page === 'queue' || (!currentId && prepared.length)) return prepared;
  return uniqueIds(pageQueue);
}

export function resolveResumeQueue({ savedCurrentId = null, liveQueue = [], availableTrackIds = [] } = {}) {
  const available = availableTrackIds instanceof Set
    ? availableTrackIds
    : new Set(Array.isArray(availableTrackIds) ? availableTrackIds : []);
  const queue = uniqueIds(liveQueue).filter(id => available.has(id));
  if (typeof savedCurrentId !== 'string' || !available.has(savedCurrentId) || !queue.includes(savedCurrentId)) return null;
  return queue;
}

export function shuffleUpcomingQueue(queueIds = [], currentId = null, random = Math.random) {
  const queue = uniqueIds(queueIds);
  const currentIndex = currentId ? queue.indexOf(currentId) : -1;
  if (currentIndex < 0) return shuffleIds(queue, random);
  return [
    ...queue.slice(0, currentIndex + 1),
    ...shuffleIds(queue.slice(currentIndex + 1), random)
  ].slice(0, MAX_QUEUE_ITEMS);
}

export function restoreUnshuffledQueue(shuffleBackupIds = [], currentQueueIds = []) {
  const backup = uniqueIds(shuffleBackupIds);
  return backup.length ? backup : uniqueIds(currentQueueIds);
}
