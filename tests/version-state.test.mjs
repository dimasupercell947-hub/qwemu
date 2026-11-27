import test from 'node:test';
import assert from 'node:assert/strict';
import { compareStableVersions, parseStableVersion } from '../public/assets/version-state.js';

test('accepts stable three-part versions and release tags', () => {
  assert.deepEqual(parseStableVersion('2.0.0'), [2, 0, 0]);
  assert.deepEqual(parseStableVersion('v2.0.3'), [2, 0, 3]);
  assert.deepEqual(parseStableVersion('V3.12.4'), [3, 12, 4]);
});

test('rejects malformed versions, leading zeroes and prereleases', () => {
  for (const value of ['2.0', '2.0.0.1', '02.0.0', '2.00.0', '2.0.00', '2.0.0-beta', '', null]) {
    assert.throws(() => parseStableVersion(value), TypeError, String(value));
  }
});

test('rejects unsafe version components', () => {
  assert.throws(() => parseStableVersion('999999999999999999999.0.0'), TypeError);
});

test('compares versions numerically', () => {
  assert.equal(compareStableVersions('2.10.0', '2.9.99'), 1);
  assert.equal(compareStableVersions('2.0.0', 'v2.0.0'), 0);
  assert.equal(compareStableVersions('2.0.0', '1.99.99'), 1);
  assert.equal(compareStableVersions('1.99.99', '2.0.0'), -1);
});
