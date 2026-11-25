import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EQ_BANDS,
  EQ_PRESETS,
  calculateEqHeadroomGain,
  matchingEqPreset,
  normalizeEqSettings,
  parseEqSettings
} from '../public/assets/eq-state.js';

test('EQ has ten standard frequency bands from 31 Hz to 16 kHz', () => {
  assert.deepEqual(
    EQ_BANDS.map(({ label, frequency }) => [label, frequency]),
    [
      ['31 Hz', 31], ['62 Hz', 62], ['125 Hz', 125], ['250 Hz', 250], ['500 Hz', 500],
      ['1 kHz', 1000], ['2 kHz', 2000], ['4 kHz', 4000], ['8 kHz', 8000], ['16 kHz', 16000]
    ]
  );
});

test('first launch without stored data starts with ten flat bands', () => {
  assert.deepEqual(normalizeEqSettings(null), {
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    enabled: true
  });
  assert.deepEqual(parseEqSettings(null).gains, Array(10).fill(0));
  assert.deepEqual(parseEqSettings('{broken json').gains, Array(10).fill(0));
});

test('legacy five-band settings migrate to ten bands without losing their shape', () => {
  assert.deepEqual(
    normalizeEqSettings({ gains: [5, 3, 1, -2, -4], enabled: false }),
    { gains: [5, 5, 3, 3, 3, 1, 1, -2, -4, -4], enabled: false }
  );
});

test('ten-band settings are clamped, rounded to half decibels and restored', () => {
  const result = parseEqSettings(JSON.stringify({
    gains: [20, -20, 1.26, -1.26, '2.5', 'invalid', 0, 0.5, -0.5, 12],
    enabled: true
  }));
  assert.deepEqual(result.gains, [12, -12, 1.5, -1.5, 2.5, 0, 0, 0.5, -0.5, 12]);
  assert.equal(result.enabled, true);
});

test('restored preset selection matches current gains and custom values remain distinct', () => {
  assert.equal(matchingEqPreset([...EQ_PRESETS['Бас']]), 'Бас');
  assert.equal(matchingEqPreset([...EQ_PRESETS['Плоский']]), 'Плоский');
  assert.equal(matchingEqPreset([0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5]), 'custom');
});

test('headroom compensation stays below configured ceiling for boosted response', () => {
  assert.ok(Math.abs(calculateEqHeadroomGain([1, 1.5, 2.5], 0.9) - 0.36) < 1e-9);
  assert.equal(calculateEqHeadroomGain([0.5, 1, 0.95]), 1);
  assert.equal(calculateEqHeadroomGain([1, 2, Number.NaN, Number.POSITIVE_INFINITY], 0.85), 0.425);
  assert.equal(calculateEqHeadroomGain(null), 1);
});
