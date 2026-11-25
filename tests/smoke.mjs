import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(root, path), 'utf8');
const required = [
  'public/index.html',
  'public/assets/main.js',
  'public/assets/library-store.js',
  'public/assets/desktop-bridge.js',
  'public/assets/playback-queue.js',
  'public/assets/audio-adapter.js',
  'public/assets/storage-adapter.js',
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
assert.equal(config.version, '1.5.0');
assert.equal(config.identifier, 'com.qwemu.music.desktop');
assert.equal(config.build.frontendDist, '../public');
assert.deepEqual(config.bundle.targets, ['nsis', 'msi']);
assert.ok(config.app.windows.some(window => window.label === 'main' && window.minWidth === 960));
assert.ok(config.app.security.csp.includes("script-src 'self'"));

const html = read('public/index.html');
assert.ok(html.includes('assets/desktop-bridge.js'));
assert.ok(!html.includes('globalThis.QWEMU_DESKTOP = true;'), 'Desktop flag must not use CSP-blocked inline JS');
assert.ok(read('public/assets/desktop-bridge.js').includes('globalThis.QWEMU_DESKTOP = true'));

const main = read('public/assets/main.js');
assert.ok(main.includes('new LibraryStore'));
assert.ok(main.includes('restoreDesktopLibrary'));
assert.ok(main.includes('libraryStore.getFile'));
assert.ok(main.includes('libraryStore.put'));
assert.ok(main.includes('libraryStore.remove'));
assert.ok(main.includes('deleteLibraryTrack'));
assert.ok(main.includes('buildPlaybackQueue'));
assert.ok(main.includes('state.playbackQueue'));
assert.ok(!/aiff/i.test(main), 'AIFF must not be advertised as supported');

const store = read('public/assets/library-store.js');
assert.ok(store.includes('indexedDB.open'));
assert.ok(store.includes('async getFile'));
assert.ok(store.includes('async remove'));
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
  assert.ok(content.startsWith('@echo off'), name + ' must disable command echo');
  assert.ok(content.includes('cd /d "%~dp0"'), name + ' must run from its own folder');
}
assert.ok(read('build.bat').includes('NSIS installer was not created'));
assert.ok(read('build.bat').includes('MSI installer was not created'));
assert.ok(read('check.bat').includes('Node.js 22 or newer'));
assert.ok(read('src-tauri/Cargo.toml').includes('tauri = { version = "2" }'));
assert.ok(read('src-tauri/src/main.rs').includes('qwemu_music_desktop_lib::run'));

console.log('QWEMU Desktop smoke test passed: ' + required.length + ' required files, Tauri configuration, ICO header, CSP bridge and build guards.');
