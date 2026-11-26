import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toggleSelection,
  toggleVisibleSelection,
  selectedInOrder,
  pruneSelection
} from '../public/assets/selection-state.js';

test('track selection adds and removes only valid identifiers', () => {
  let selected = toggleSelection([], 'track-a', true);
  selected = toggleSelection(selected, 'track-b', true);
  selected = toggleSelection(selected, '', true);
  assert.deepEqual([...selected], ['track-a', 'track-b']);
  selected = toggleSelection(selected, 'track-a', false);
  assert.deepEqual([...selected], ['track-b']);
});

test('visible selection toggles the current view without changing hidden selections', () => {
  const initial = new Set(['hidden-track', 'visible-a']);
  const selected = toggleVisibleSelection(initial, ['visible-a', 'visible-b']);
  assert.deepEqual([...selected], ['hidden-track', 'visible-a', 'visible-b']);
  const cleared = toggleVisibleSelection(selected, ['visible-a', 'visible-b']);
  assert.deepEqual([...cleared], ['hidden-track']);
});

test('selected tracks follow library order and ignore duplicate or missing identifiers', () => {
  const result = selectedInOrder(new Set(['b', 'a', 'missing']), ['a', 'b', 'a', 'c']);
  assert.deepEqual(result, ['a', 'b']);
});

test('stale selection is pruned and the selection limit is enforced', () => {
  const stale = pruneSelection(new Set(['a', 'gone']), ['a', 'b']);
  assert.deepEqual([...stale], ['a']);
  const oversized = Array.from({ length: 5100 }, (_, index) => 'track-' + index);
  assert.equal(toggleVisibleSelection([], oversized).size, 5000);
});

test('invalid selection inputs are safe no-ops', () => {
  assert.deepEqual([...toggleSelection(null, null, true)], []);
  assert.deepEqual([...toggleVisibleSelection(['ok'], null)], ['ok']);
  assert.deepEqual(selectedInOrder(null, ['ok']), []);
});
