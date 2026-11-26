export function buildPlaybackQueue({
  page = 'library',
  activePlaylist = null,
  playlists = [],
  tracks = [],
  favorites = [],
  search = '',
  recentLimit = 6
} = {}) {
  const library = Array.isArray(tracks) ? tracks.filter(track => track && typeof track.id === 'string') : [];
  const byId = new Map(library.map(track => [track.id, track]));
  const favoriteIds = new Set(Array.isArray(favorites) ? favorites : []);
  const query = String(search || '').trim().toLocaleLowerCase();
  let selected = library;

  if (page === 'favorites') {
    selected = library.filter(track => favoriteIds.has(track.id));
  } else if (page === 'playlists' && activePlaylist) {
    const playlist = (Array.isArray(playlists) ? playlists : []).find(item => item?.id === activePlaylist);
    selected = (Array.isArray(playlist?.trackIds) ? playlist.trackIds : [])
      .map(id => byId.get(id))
      .filter(Boolean);
  }

  if (query) {
    selected = selected.filter(track =>
      `${track.title || ''} ${track.artist || ''} ${track.album || ''}`.toLocaleLowerCase().includes(query)
    );
  } else if (page === 'home') {
    const limit = Number.isInteger(recentLimit) ? Math.max(1, Math.min(100, recentLimit)) : 6;
    selected = [...selected].slice(-limit).reverse();
  }

  return [...new Set(selected.map(track => track.id))];
}

export function getNextQueueIndex(queue, currentId, direction = 1, repeatMode = "off") {
  if (!Array.isArray(queue) || !queue.length) return -1;
  const step = Number(direction) < 0 ? -1 : 1;
  const current = queue.indexOf(currentId);
  const candidate = current < 0 ? (step > 0 ? 0 : queue.length - 1) : current + step;
  if (candidate >= 0 && candidate < queue.length) return candidate;
  return repeatMode === "all" ? (step > 0 ? 0 : queue.length - 1) : -1;
}
export function shuffleQueue(queue, currentId = null, random = Math.random) {
  const ids = [...new Set((Array.isArray(queue) ? queue : []).filter(id => typeof id === "string"))];
  const pinned = currentId && ids.includes(currentId) ? currentId : null;
  const rest = ids.filter(id => id !== pinned);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const value = Number(random());
    const safe = Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0.5;
    const j = Math.floor(safe * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return pinned ? [pinned, ...rest] : rest;
}
