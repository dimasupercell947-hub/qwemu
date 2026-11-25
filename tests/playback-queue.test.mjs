import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlaybackQueue } from '../public/assets/playback-queue.js';

const tracks = [
  { id: 'a', title: 'Alpha', artist: 'One', album: 'First' },
  { id: 'b', title: 'Beta', artist: 'Two', album: 'Second' },
  { id: 'c', title: 'Gamma', artist: 'Three', album: 'Third' },
  { id: 'd', title: 'Delta', artist: 'Four', album: 'Fourth' },
  { id: 'e', title: 'Echo', artist: 'Five', album: 'Fifth' },
  { id: 'f', title: 'Foxtrot', artist: 'Six', album: 'Sixth' },
  { id: 'g', title: 'Older Match', artist: 'Seven', album: 'Seventh' }
];

test('playlist queue preserves playlist order and excludes unrelated tracks', () => {
  assert.deepEqual(buildPlaybackQueue({
    page: 'playlists',
    activePlaylist: 'mix',
    playlists: [{ id: 'mix', trackIds: ['a', 'c', 'a', 'missing'] }],
    tracks
  }), ['a', 'c']);
});

test('favorites queue contains only favorite tracks', () => {
  assert.deepEqual(buildPlaybackQueue({ page: 'favorites', tracks, favorites: ['b', 'd', 'missing'] }), ['b', 'd']);
});

test('home search examines the whole library, while an empty search shows recent tracks', () => {
  assert.deepEqual(buildPlaybackQueue({ page: 'home', tracks, search: 'older match' }), ['g']);
  assert.deepEqual(buildPlaybackQueue({ page: 'home', tracks }), ['g', 'f', 'e', 'd', 'c', 'b']);
});
