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

import { getNextQueueIndex, shuffleQueue } from '../public/assets/playback-queue.js';

test('queue navigation handles boundaries and repeat-all mode', () => {
  const queue = ['a', 'b', 'c'];
  assert.equal(getNextQueueIndex(queue, 'a', 1), 1);
  assert.equal(getNextQueueIndex(queue, 'c', 1), -1);
  assert.equal(getNextQueueIndex(queue, 'a', -1), -1);
  assert.equal(getNextQueueIndex(queue, 'c', 1, 'all'), 0);
  assert.equal(getNextQueueIndex(queue, 'a', -1, 'all'), 2);
  assert.equal(getNextQueueIndex([], null, 1), -1);
});

test('shuffle pins current track and de-duplicates IDs', () => {
  assert.deepEqual(shuffleQueue(['a', 'b', 'c', 'b'], 'b', () => 0), ['b', 'c', 'a']);
  assert.deepEqual(shuffleQueue(['a', 'b'], null, () => 0.99999), ['a', 'b']);
});
