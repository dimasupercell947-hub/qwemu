import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaybackSnapshot, restorePlaybackSnapshot } from '../public/assets/playback-state.js';

test('creates a bounded, normalized playback snapshot', () => {
  const snapshot = createPlaybackSnapshot({
    queueIds: ['a', 'b', 'a', '', 12],
    currentId: 'c',
    position: 999999,
    shuffle: true,
    shuffleBackupIds: ['a', 'b', 'a'],
    repeatMode: 'one'
  });
  assert.deepEqual(snapshot.queueIds, ['c', 'a', 'b']);
  assert.equal(snapshot.currentId, 'c');
  assert.equal(snapshot.position, 86400);
  assert.equal(snapshot.shuffle, true);
  assert.deepEqual(snapshot.shuffleBackupIds, ['a', 'b']);
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
    shuffleBackupIds: ['stream', 'bookmark', 'local', 'local'],
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
  assert.deepEqual(snapshot.shuffleBackupIds, ['stream', 'local']);
});

test('ignores unsupported snapshots and caps queue length', () => {
  assert.equal(restorePlaybackSnapshot({ schemaVersion: 2 }, []), null);
  const queueIds = Array.from({ length: 6000 }, (_, index) => 'track-' + index);
  const snapshot = createPlaybackSnapshot({ queueIds }, null);
  assert.equal(snapshot.queueIds.length, 5000);
});

test('keeps a pending resume point when the app closes again without playback', () => {
  const pending = {
    currentId: 'track-b',
    position: 187,
    queueIds: ['track-a', 'track-b', 'track-c'],
    shuffle: true,
    shuffleBackupIds: ['track-a', 'track-b', 'track-c'],
    repeatMode: 'all'
  };
  const firstClose = createPlaybackSnapshot({
    queueIds: pending.queueIds,
    currentId: null,
    position: 0,
    shuffle: pending.shuffle,
    shuffleBackupIds: pending.shuffleBackupIds,
    pendingResume: pending,
    repeatMode: pending.repeatMode
  });
  const restored = restorePlaybackSnapshot(firstClose, [
    { id: 'track-a' }, { id: 'track-b' }, { id: 'track-c' }
  ]);
  const secondClose = createPlaybackSnapshot({
    queueIds: restored.queueIds,
    currentId: null,
    position: 0,
    shuffle: restored.shuffle,
    shuffleBackupIds: restored.shuffleBackupIds,
    pendingResume: restored,
    repeatMode: restored.repeatMode
  });
  assert.equal(secondClose.currentId, 'track-b');
  assert.equal(secondClose.position, 187);
  assert.deepEqual(secondClose.queueIds, ['track-a', 'track-b', 'track-c']);
  assert.deepEqual(secondClose.shuffleBackupIds, ['track-a', 'track-b', 'track-c']);
  assert.equal(secondClose.repeatMode, 'all');
});
