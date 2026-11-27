import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaybackSnapshot, restorePlaybackSnapshot } from '../public/assets/playback-state.js';

test('creates a bounded, normalized playback snapshot', () => {
  const snapshot = createPlaybackSnapshot({
    queueIds: ['a', 'b', 'a', '', 12],
    currentId: 'c',
    position: 999999,
    shuffle: true,
    repeatMode: 'one'
  });
  assert.deepEqual(snapshot.queueIds, ['c', 'a', 'b']);
  assert.equal(snapshot.currentId, 'c');
  assert.equal(snapshot.position, 86400);
  assert.equal(snapshot.shuffle, true);
  assert.equal(snapshot.repeatMode, 'one');
  assert.equal(snapshot.schemaVersion, 1);
});

test('restores only playable tracks and clamps invalid playback state', () => {
  const snapshot = restorePlaybackSnapshot({
    schemaVersion: 1,
    queueIds: ['local', 'bookmark', 'stream', 'missing', 'local'],
    currentId: 'stream',
    position: -5,
    shuffle: true,
    repeatMode: 'invalid',
    savedAt: 10
  }, [
    { id: 'local' },
    { id: 'bookmark', externalUrl: 'https://open.spotify.com/track/demo' },
    { id: 'stream', url: 'https://cdn.example.com/audio.mp3' }
  ]);
  assert.deepEqual(snapshot.queueIds, ['local', 'stream']);
  assert.equal(snapshot.currentId, 'stream');
  assert.equal(snapshot.position, 0);
  assert.equal(snapshot.repeatMode, 'off');
  assert.equal(snapshot.shuffle, true);
});

test('ignores unsupported snapshots and caps queue length', () => {
  assert.equal(restorePlaybackSnapshot({ schemaVersion: 2 }, []), null);
  const queueIds = Array.from({ length: 6000 }, (_, index) => 'track-' + index);
  const snapshot = createPlaybackSnapshot({ queueIds }, null);
  assert.equal(snapshot.queueIds.length, 5000);
});
