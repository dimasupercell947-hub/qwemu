import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, parseBackup, BACKUP_FORMAT } from '../public/assets/backup-state.js';

const sample = {
  appVersion: '2.0.0',
  tracks: [
    { id: 'local-1', name: 'song.mp3', title: 'Song', artist: 'QWEMU', album: 'Local', lyrics: '[00:01]Hello', size: 1024, duration: 180, addedAt: 10 },
    { id: 'stream-1', name: 'stream.mp3', title: 'Stream', url: 'https://cdn.example.com/stream.mp3' },
    { id: 'bookmark-1', name: 'Spotify', title: 'External', externalUrl: 'https://open.spotify.com/track/demo' }
  ],
  favorites: ['local-1', 'local-1', 'missing'],
  playlists: [{ id: 'playlist-1', name: 'Mix', description: 'Daily', trackIds: ['local-1', 'bookmark-1', 'missing'] }],
  settings: { theme: 'midnight', volume: 0.45, reducedMotion: true },
  playHistory: [{ trackId: 'local-1', playedAt: 100 }, { trackId: 'local-1', playedAt: 90 }],
  sortMode: 'title-asc'
};

test('exports a metadata-only portable backup and restores normalized data', () => {
  const backup = createBackup(sample);
  assert.equal(backup.format, BACKUP_FORMAT);
  assert.equal(backup.schemaVersion, 1);
  assert.equal(backup.includesAudioFiles, false);
  assert.equal(backup.tracks.length, 3);
  assert.equal('file' in backup.tracks[0], false);
  const restored = parseBackup(JSON.stringify(backup));
  assert.deepEqual(restored.favorites, ['local-1']);
  assert.deepEqual(restored.playlists[0].trackIds, ['local-1', 'bookmark-1']);
  assert.equal(restored.settings.theme, 'midnight');
  assert.equal(restored.settings.volume, 0.45);
  assert.equal(restored.playHistory.length, 1);
  assert.equal(restored.tracks[1].url, 'https://cdn.example.com/stream.mp3');
  assert.equal(restored.tracks[2].externalUrl, 'https://open.spotify.com/track/demo');
});

test('rejects malformed, oversized and unsupported backups', () => {
  assert.throws(() => parseBackup('{broken'), TypeError);
  assert.throws(() => parseBackup(JSON.stringify({ format: 'other', schemaVersion: 1, tracks: [] })), TypeError);
  assert.throws(() => parseBackup('x'.repeat(8 * 1024 * 1024 + 1)), RangeError);
  assert.throws(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, schemaVersion: 1, tracks: Array(5001).fill({ id: 'x' }) })), RangeError);
});

test('rejects unsafe external URLs and conflicting sources', () => {
  assert.throws(() => createBackup({ tracks: [{ id: 'bad', title: 'Unsafe', externalUrl: 'http://127.0.0.1/admin' }] }), TypeError);
  assert.throws(() => createBackup({ tracks: [{ id: 'bad', url: 'https://cdn.example.com/song.mp3', externalUrl: 'https://open.spotify.com/track/x' }] }), TypeError);
});
