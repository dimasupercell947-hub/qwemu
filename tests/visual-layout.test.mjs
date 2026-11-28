import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'public/assets/ui-overhaul.css'), 'utf8');

test('player height and document reservation use the same responsive token', () => {
  assert.match(css, /--qwemu-player-height:\s*112px/);
  assert.match(css, /body\s*\{\s*padding-bottom:\s*var\(--qwemu-player-height\)/);
  assert.match(css, /\.player\s*\{\s*height:\s*var\(--qwemu-player-height\)/);
  assert.match(css, /@media\s*\(max-width:\s*700px\)[\s\S]*?--qwemu-player-height:\s*150px/);
  assert.match(css, /\.sidebar\s*\{\s*height:\s*calc\(100vh - var\(--qwemu-player-height\)\)/);
});

test('active equalizer uses the QWEMU coral accent instead of the legacy green state', () => {
  assert.match(css, /\.eq-toggle\.on\s*\{[^}]*color:\s*#ffad7e/);
  assert.match(css, /\.eq-toggle\.on\s*\{[^}]*border-color:\s*#ef895d/);
});

test('light theme overrides hard-coded dark player and overlay surfaces', () => {
  for (const selector of [
    ':root[data-theme="light"] .player',
    ':root[data-theme="light"] .lyrics-panel',
    ':root[data-theme="light"] .plus-hero',
    ':root[data-theme="light"] .plus-search-line input',
    ':root[data-theme="light"] .plus-track',
    ':root[data-theme="light"] .update-notice'
  ]) {
    assert.ok(css.includes(selector), 'Missing light-theme override: ' + selector);
  }
});
