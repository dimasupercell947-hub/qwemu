import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseStableVersion } from '../public/assets/version-state.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const packageJson = JSON.parse(read('package.json'));
const tauriConfig = JSON.parse(read('src-tauri/tauri.conf.json'));
const cargo = read('src-tauri/Cargo.toml');
const html = read('public/index.html');
const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const htmlVersion = html.match(/<meta\s+name="app-version"\s+content="([^"]+)"/)?.[1];
const versions = {
  package: packageJson.version,
  tauri: tauriConfig.version,
  cargo: cargoVersion,
  html: htmlVersion
};

for (const [source, version] of Object.entries(versions)) {
  assert.ok(version, 'Не удалось прочитать версию из ' + source);
  parseStableVersion(version);
  assert.equal(version, packageJson.version, 'Версия ' + source + ' расходится с package.json');
}
console.log('Версия QWEMU MUSIC синхронизирована: ' + packageJson.version);
