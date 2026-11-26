import test from 'node:test';
import assert from 'node:assert/strict';
import { compareStableVersions, parseStableVersion } from '../public/assets/version-state.js';

test('accepts stable three-part versions and release tags', () => {
  assert.deepEqual(parseStableVersion('1.7.0'), [1, 7, 0]);
  assert.deepEqual(parseStableVersion('v1.7.0'), [1, 7, 0]);
  assert.deepEqual(parseStableVersion('V2.0.3'), [2, 0, 3]);
});

test('rejects malformed, four-part and leading-zero versions', () => {
  for (const value of ['1.7', '1.7.0.1', '01.7.0', '1.07.0', '1.7.00', '1.7.0-beta', '', null]) {
    assert.throws(() => parseStableVersion(value), TypeError, String(value));
  }
});

test('rejects unsafe numeric components', () => {
  assert.throws(() => parseStableVersion('999999999999999999999.0.0'), TypeError);
});

test('compares numeric version components correctly', () => {
  assert.equal(compareStableVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareStableVersions('1.7.0', 'v1.7.0'), 0);
  assert.equal(compareStableVersions('2.0.0', '1.99.99'), 1);
  assert.equal(compareStableVersions('1.6.99', '1.7.0'), -1);
});
