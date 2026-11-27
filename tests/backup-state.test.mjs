import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, parseBackup, mergeBackupCollections, BACKUP_FORMAT } from '../public/assets/backup-state.js';

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

test('migrates legacy platform streams and skips obsolete URLs without aborting export', () => {
  const backup = createBackup({
    tracks: [
      { id: 'legacy', title: 'Legacy SoundCloud track', url: 'https://soundcloud.com/artist/song.mp3' },
      { id: 'obsolete', title: 'Old URL', externalUrl: 'http://127.0.0.1/admin' },
      { id: 'valid', title: 'Valid stream', url: 'https://cdn.example.com/song.mp3' }
    ]
  });
  assert.equal(backup.tracks.length, 3);
  assert.equal(backup.tracks[0].url, undefined);
  assert.equal(backup.tracks[0].externalUrl, 'https://soundcloud.com/artist/song.mp3');
  assert.equal(backup.tracks[1].externalUrl, undefined);
  assert.ok(backup.warnings.length >= 2);
  const restored = parseBackup(JSON.stringify(backup));
  assert.equal(restored.tracks.length, 3);
  assert.equal(restored.tracks[0].externalUrl, 'https://soundcloud.com/artist/song.mp3');
});

test('keeps strict URL validation when importing backup files', () => {
  const backup = createBackup({ tracks: [{ id: 'valid', title: 'Valid', url: 'https://cdn.example.com/song.mp3' }] });
  backup.tracks.push({ id: 'unsafe', title: 'Unsafe', externalUrl: 'http://127.0.0.1/admin' });
  assert.throws(() => parseBackup(JSON.stringify(backup)), TypeError);
  assert.throws(() => createBackup({ tracks: [{ id: 'conflict', url: 'https://cdn.example.com/a.mp3', externalUrl: 'https://open.spotify.com/track/x' }] }), TypeError);
});

test('merges backup collections without deleting newer favorites, playlists or history', () => {
  const merged = mergeBackupCollections({
    availableTrackIds: ['a', 'b', 'c', 'd'],
    currentFavorites: ['a', 'c'],
    backupFavorites: ['a', 'b'],
    currentPlaylists: [
      { id: 'newer', name: 'Road Trip', description: '', trackIds: ['c'] },
      { id: 'shared', name: 'Current Name', trackIds: ['a'] }
    ],
    backupPlaylists: [
      { id: 'shared', name: 'Backup Name', description: 'From backup', trackIds: ['b'] },
      { id: 'older', name: 'Old Mix', trackIds: ['d'] }
    ],
    currentHistory: [{ trackId: 'a', playedAt: 100 }, { trackId: 'c', playedAt: 200 }],
    backupHistory: [{ trackId: 'a', playedAt: 150 }, { trackId: 'b', playedAt: 90 }]
  });
  assert.deepEqual(merged.favorites, ['a', 'c', 'b']);
  assert.deepEqual(merged.playlists.map(item => item.id), ['newer', 'shared', 'older']);
  assert.equal(merged.playlists[1].name, 'Current Name');
  assert.deepEqual(merged.playlists[1].trackIds, ['a', 'b']);
  assert.deepEqual(merged.playlists[1].description, 'From backup');
  assert.deepEqual(merged.playHistory, [
    { trackId: 'c', playedAt: 200 },
    { trackId: 'a', playedAt: 150 },
    { trackId: 'b', playedAt: 90 }
  ]);
});
