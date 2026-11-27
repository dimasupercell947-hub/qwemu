import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackRequestGate } from '../public/assets/playback-request.js';

test('a newer playback request invalidates an older pending request', () => {
  const gate = new PlaybackRequestGate();
  const first = gate.begin();
  const second = gate.begin();

  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
});

test('stopping playback invalidates the active request', () => {
  const gate = new PlaybackRequestGate();
  const pending = gate.begin();

  gate.invalidate();

  assert.equal(gate.isCurrent(pending), false);
});

test('invalid tokens are never considered current', () => {
  const gate = new PlaybackRequestGate();
  gate.begin();

  for (const token of [null, undefined, '1', 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(gate.isCurrent(token), false);
  }
});
