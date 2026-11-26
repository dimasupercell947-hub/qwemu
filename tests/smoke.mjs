import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EQ_BANDS } from '../public/assets/eq-state.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(root, path), 'utf8');

const required = [
  'public/index.html',
  'public/assets/main.js',
  'public/assets/library-store.js',
  'public/assets/desktop-bridge.js',
  'public/assets/playback-queue.js',
  'public/assets/playback-request.js',
  'public/assets/serial-task-queue.js',
  'public/assets/history-state.js',
  'public/assets/track-sort.js',
  'public/assets/playlist-io.js',
  'public/assets/audio-adapter.js',
  'public/assets/storage-adapter.js',
  'public/assets/eq.js',
  'public/assets/eq-state.js',
  'public/assets/ui-overhaul.css',
  'public/assets/logo.svg',
  'src-tauri/Cargo.toml',
  'src-tauri/build.rs',
  'src-tauri/src/lib.rs',
  'src-tauri/src/main.rs',
  'src-tauri/tauri.conf.json',
  'src-tauri/capabilities/default.json',
  'src-tauri/icons/icon.ico',
  'run.bat',
  'build.bat',
  'check.bat'
];

for (const path of required) {
  assert.ok(existsSync(join(root, path)), 'Missing required file: ' + path);
}

const config = JSON.parse(read('src-tauri/tauri.conf.json'));
assert.equal(config.productName, 'QWEMU MUSIC');
assert.equal(config.version, '1.7.0');
assert.equal(config.identifier, 'com.qwemu.music.desktop');
assert.equal(config.build.frontendDist, '../public');
assert.deepEqual(config.bundle.targets, ['nsis', 'msi']);
assert.ok(config.app.windows.some(window => window.label === 'main' && window.minWidth === 960));
assert.ok(config.app.security.csp.includes("script-src 'self'"));

const html = read('public/index.html');
assert.ok(html.includes('assets/desktop-bridge.js'));
assert.ok(html.includes('assets/eq.js'));
assert.ok(html.includes('assets/ui-overhaul.css'));
assert.ok(html.includes('assets/logo.svg'));
assert.ok(!html.includes('globalThis.QWEMU_DESKTOP = true;'), 'Desktop bridge flag must not use inline CSP-blocked JS');
assert.ok(read('public/assets/desktop-bridge.js').includes('globalThis.QWEMU_DESKTOP = true'));

const main = read('public/assets/main.js');
for (const feature of [
  'new LibraryStore',
  'restoreDesktopLibrary',
  'libraryStore.getFile',
  'libraryStore.put',
  'libraryStore.remove',
  'deleteLibraryTrack',
  'buildPlaybackQueue',
  'new PlaybackRequestGate',
  'new SerialTaskQueue',
  'state.playbackQueue',
  'function queueTrackNext',
  'function toggleShuffle',
  'function clearHistory',
  'parsePlaylistM3u',
  'recordPlay',
  'sortTracks'
]) {
  assert.ok(main.includes(feature), 'Missing main feature: ' + feature);
}
assert.ok(!/aiff/i.test(main), 'AIFF must not be advertised');

const eq = read('public/assets/eq.js');
for (const capability of [
  'createMediaElementSource',
  'createBiquadFilter',
  'getByteFrequencyData',
  'getFrequencyResponse',
  'parseEqSettings',
  'localStorage'
]) {
  assert.ok(eq.includes(capability), 'EQ missing capability: ' + capability);
}
assert.deepEqual(EQ_BANDS.map(({ label }) => label), [
  '31 Hz', '62 Hz', '125 Hz', '250 Hz', '500 Hz',
  '1 kHz', '2 kHz', '4 kHz', '8 kHz', '16 kHz'
]);

const css = read('public/assets/ui-overhaul.css');
assert.ok(css.includes('.qwemu-wave'));
assert.ok(css.includes('.player{height:100px'), 'Player grid must reserve space for waveform rows');
assert.ok(css.includes('.eq-panel'));
assert.ok(css.includes('prefers-reduced-motion'));
assert.ok(css.includes('grid-template-columns:minmax(160px,1fr) minmax(270px,1.4fr) 180px'));
assert.ok(eq.includes('Свои настройки'), 'Custom EQ values should be represented in the preset selector');

assert.ok(read('public/assets/library-store.js').includes('indexedDB.open'));
assert.ok(read('public/assets/library-store.js').includes('updateMetadata'));
assert.ok(read('public/assets/library-store.js').includes('putLink'));
assert.ok(read('public/assets/lyrics-state.js').includes('parseLyrics'));
assert.ok(read('public/assets/music-url.js').includes('classifyMusicUrl'));
assert.ok(read('public/assets/audio-formats.js').includes('AUDIO_FORMATS'));
assert.ok(read('public/index.html').includes('id="shuffle"'));
assert.ok(read('public/index.html').includes('id="track-dialog"'));
assert.ok(read('public/assets/playback-queue.js').includes('recentLimit'));

const icon = readFileSync(join(root, 'src-tauri/icons/icon.ico'));
assert.equal(icon.readUInt16LE(0), 0);
assert.equal(icon.readUInt16LE(2), 1);
assert.equal(icon.readUInt16LE(4), 1);
assert.equal(icon[6], 32);
assert.equal(icon[7], 32);

for (const [name, content] of [
  ['run.bat', read('run.bat')],
  ['build.bat', read('build.bat')],
  ['check.bat', read('check.bat')]
]) {
  assert.ok(content.startsWith('@echo off'), name + ' echo disabled');
  assert.ok(content.includes('cd /d "%~dp0"'), name + ' working folder guard');
}

assert.ok(read('build.bat').includes('NSIS installer was not created'));
assert.ok(read('build.bat').includes('MSI installer was not created'));
assert.ok(read('check.bat').includes('Node.js 22 or newer'));
assert.ok(read('src-tauri/Cargo.toml').includes('tauri = { version = "=2.12.7" }'));
assert.ok(read('src-tauri/Cargo.toml').includes('version = "1.8.0"'));
assert.ok(read('src-tauri/src/main.rs').includes('qwemu_music_desktop_lib::run'));

assert.equal(JSON.parse(read('package.json')).version, '1.8.0');
assert.ok(read('public/index.html').includes('DESKTOP EDITION · 1.8.0'));
console.log('QWEMU Desktop 1.8.0 smoke passed: ' + required.length + ' required files, EQ, playback queue, history, M3U8, metadata editing, visualizer, CSP, Tauri and build scripts.');
