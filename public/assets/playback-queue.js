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
