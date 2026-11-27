import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EQ_BANDS } from '../public/assets/eq-state.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(root, path), 'utf8');

const required = [
  'public/index.html',
  'public/version.json',
  'public/assets/main.js',
  'public/assets/plus-search.js',
  'tests/plus-search.test.mjs',
  'public/assets/library-store.js',
  'public/assets/desktop-bridge.js',
  'public/assets/playback-queue.js',
  'public/assets/playback-state.js',
  'public/assets/queue-state.js',
  'public/assets/playback-request.js',
  'public/assets/serial-task-queue.js',
  'public/assets/selection-state.js',
  'public/assets/backup-state.js',
  'public/assets/version-state.js',
  'tests/selection-state.test.mjs',
  'tests/playback-state.test.mjs',
  'tests/queue-state.test.mjs',
  'tests/backup-state.test.mjs',
  'tests/version-state.test.mjs',
  'scripts/check-version.mjs',
  'public/assets/history-state.js',
  'public/assets/track-sort.js',
  'public/assets/playlist-io.js',
  'public/assets/audio-adapter.js',
  'tests/audio-adapter.test.mjs',
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
  'src-tauri/tauri.updater.conf.json',
  'scripts/create-updater-manifest.ps1',
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
const packageJson = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('public/version.json'));
const cargo = read('src-tauri/Cargo.toml');
const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
assert.equal(config.productName, 'QWEMU MUSIC');
assert.equal(config.version, '2.0.2');
assert.equal(packageJson.version, '2.0.2');
assert.equal(cargoVersion, '2.0.2');
assert.equal(config.identifier, 'com.qwemu.music.desktop');
assert.equal(config.build.frontendDist, '../public');
assert.deepEqual(config.bundle.targets, ['nsis', 'msi']);
assert.ok(config.app.windows.some(window => window.label === 'main' && window.minWidth === 960));
assert.ok(config.app.security.csp.includes("script-src 'self'"));
assert.equal(manifest.channel, 'stable');
assert.ok(manifest.version && manifest.tag === 'v' + manifest.version, 'Public version manifest must identify its currently published release.');
assert.equal(config.bundle.createUpdaterArtifacts, false, 'Updater artifacts are only signed in the release workflow.');
assert.equal(config.app.withGlobalTauri, true, 'Static HTML frontend needs Tauri global invoke/event APIs.');
assert.equal(config.plugins.updater.endpoints[0], 'https://github.com/dimasupercell947-hub/qwemu/releases/latest/download/latest.json');
assert.equal(config.plugins.updater.windows.installMode, 'passive');
assert.equal(JSON.parse(read('src-tauri/tauri.updater.conf.json')).bundle.createUpdaterArtifacts, true);

const html = read('public/index.html');
assert.match(html, /<meta name="app-version" content="2\.0\.2">/);
assert.ok(html.includes('id="app-version-label"'));
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
  'selectedTrackIds',
  'function addSelectedTracksToQueue',
  'function addSelectedTracksToPlaylist',
  'function exportSelectedTracks',
  'function deleteSelectedTracks',
  'function persistPlaybackSnapshot',
  'function resumePlayback',
  'buildBulkQueueUpdate',
  'resolveTransportQueue',
  'resolveResumeQueue',
  'shuffleUpcomingQueue',
  'restoreUnshuffledQueue',
  'function exportProfileBackup',
  'serializeBackup',
  'function importProfileBackup',
  'function searchPlusMusic',
  'function renderPlusPage',
  'download_openverse_audio',
  'function checkForUpdates',
  'function installAvailableUpdate',
  'invokeDesktopCommand',
  'qwemu-updater-progress',
  'state.playbackQueue',
  'function queueTrackNext',
  'function toggleShuffle',
  'function clearHistory',
  'parsePlaylistM3u',
  'recordPlay',
  'sortTracks',
  'backup-import'
]) {
  assert.ok(main.includes(feature), 'Missing main feature: ' + feature);
}
assert.equal((main.match(/async function deleteSelectedTracks\(\)/g) || []).length, 1, 'deleteSelectedTracks must be declared exactly once');
assert.ok(!/aiff/i.test(main), 'AIFF must not be advertised');
assert.ok(main.includes("invokeDesktopCommand('check_for_updates')"), 'The update check must use the native updater.');
assert.ok(main.includes("invokeDesktopCommand('install_update'"), 'Update installation must be invoked from the app.');
assert.ok(read('src-tauri/src/lib.rs').includes('tauri_plugin_updater::Builder'), 'The official Tauri updater must be registered.');
assert.ok(read('src-tauri/src/lib.rs').includes('download_and_install'), 'The native update command must install the verified bundle.');
assert.ok(read('.github/workflows/release.yml').includes('TAURI_SIGNING_PRIVATE_KEY'), 'Release builds must require a private signing key.');
assert.ok(read('.github/workflows/release.yml').includes('latest.json'), 'Releases must publish the updater manifest.');
assert.ok(read('scripts/create-updater-manifest.ps1').includes('.sig'), 'Updater manifest must include the signed EXE signature.');
assert.ok(!main.includes("' + newCount"), 'Bulk queue feedback must use the queue planner result');

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
assert.ok(css.includes('.resume-card'));
assert.ok(css.includes('.backup-actions'));
assert.ok(css.includes('.track-row.has-selection'), 'selection grid must only apply when the checkbox is present');
assert.ok(css.includes('.track-row{grid-template-columns:34px minmax(0,1fr);gap:7px}'), 'Home rows must retain a readable metadata column and spacing');
assert.ok(css.includes('grid-template-columns:minmax(160px,1fr) minmax(270px,1.4fr) 180px'));
assert.ok(eq.includes('Свои настройки'), 'Custom EQ values should be represented in the preset selector');

assert.ok(read('public/assets/library-store.js').includes('indexedDB.open'));
assert.ok(read('public/assets/library-store.js').includes('updateMetadata'));
assert.ok(read('public/assets/library-store.js').includes('removeMany'));
assert.ok(read('public/assets/library-store.js').includes('putLink'));
assert.ok(read('public/assets/lyrics-state.js').includes('parseLyrics'));
assert.ok(read('public/assets/selection-state.js').includes('toggleVisibleSelection'));
assert.ok(read('public/assets/queue-state.js').includes('buildBulkQueueUpdate'));
assert.ok(read('public/assets/queue-state.js').includes('resolveTransportQueue'));
assert.ok(read('public/assets/queue-state.js').includes('resolveResumeQueue'));
assert.ok(read('public/assets/queue-state.js').includes('shuffleUpcomingQueue'));
assert.ok(read('public/assets/queue-state.js').includes('restoreUnshuffledQueue'));
assert.ok(read('public/assets/backup-state.js').includes('mergeBackupCollections'));
assert.ok(read('public/assets/backup-state.js').includes('export function serializeBackup(value)'));
assert.ok(main.includes('serializeBackup(backup)'));
assert.ok(read('public/assets/backup-state.js').includes('normalizeEqSettings(eqSettings)'));
assert.ok(read('public/assets/eq.js').includes('window.QWEMU_EQ_API = Object.freeze'));
assert.ok(read('public/assets/plus-search.js').includes('license_type'));
assert.ok(html.includes('data-page="plus"'));
assert.ok(config.app.security.csp.includes('https://api.openverse.org'));
assert.ok(read('public/assets/music-url.js').includes('classifyMusicUrl'));
assert.ok(read('public/assets/music-url.js').includes('MUSIC_PLATFORMS'));
assert.ok(read('public/assets/music-url.js').includes('yandex-music'));
assert.ok(read('public/assets/audio-adapter.js').includes('shouldUseExternalElement'));
assert.ok(read('public/assets/library-store.js').includes('providerName: classification.serviceName'));
assert.ok(html.includes('id="link-sites"'));
assert.ok(css.includes('.source-catalog-chip'));
assert.ok(read('public/assets/audio-formats.js').includes('AUDIO_FORMATS'));
assert.ok(html.includes('id="shuffle"'));
assert.ok(html.includes('id="track-dialog"'));
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
assert.ok(cargo.includes('tauri = { version = "=2.12.7" }'));
assert.ok(read('src-tauri/src/main.rs').includes('qwemu_music_desktop_lib::run'));
assert.ok(read('.github/workflows/ci.yml').includes('QWEMU-MUSIC-Windows-2.0.2'));
assert.ok(read('.github/workflows/release.yml').includes('Refresh public update manifest'));
console.log('QWEMU Desktop 2.0.2 smoke passed: ' + required.length + ' required files, 10-band EQ, player, library, backup/restore, session recovery, strict updater, CSP, Tauri and Windows build configuration.');
