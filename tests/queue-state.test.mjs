import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBulkQueueUpdate, resolveTransportQueue, resolveResumeQueue, shuffleUpcomingQueue, restoreUnshuffledQueue } from '../public/assets/queue-state.js';

test('adds selected tracks after the current item without replaying the played prefix', () => {
  const result = buildBulkQueueUpdate({
    queueIds: ['a', 'b', 'c'],
    currentId: 'b',
    selectedIds: ['d', 'a', 'd']
  });
  assert.deepEqual(result.queueIds, ['a', 'b', 'd', 'c']);
  assert.equal(result.addedCount, 1);
  assert.deepEqual(result.shuffleBackupIds, []);
});

test('does not move already queued tracks across the playhead', () => {
  const result = buildBulkQueueUpdate({
    queueIds: ['a', 'b', 'c', 'd'],
    currentId: 'c',
    selectedIds: ['a', 'd', 'e']
  });
  assert.deepEqual(result.queueIds, ['a', 'b', 'c', 'e', 'd']);
  assert.equal(result.addedCount, 1);
});

test('updates the original queue and shuffles only upcoming tracks', () => {
  const result = buildBulkQueueUpdate({
    queueIds: ['a', 'c', 'b', 'd'],
    currentId: 'c',
    selectedIds: ['e'],
    shuffle: true,
    shuffleBackupIds: ['a', 'b', 'c', 'd'],
    random: () => 0
  });
  assert.deepEqual(result.queueIds.slice(0, 2), ['a', 'c']);
  assert.deepEqual(result.queueIds.slice(2).sort(), ['b', 'd', 'e']);
  assert.deepEqual(result.shuffleBackupIds, ['a', 'b', 'c', 'e', 'd']);
  assert.equal(result.addedCount, 1);
});

test('prepares bulk queue ahead of page-derived queue when playback is idle', () => {
  assert.deepEqual(resolveTransportQueue({
    page: 'library',
    currentId: null,
    preparedQueue: ['selected-b', 'selected-c'],
    pageQueue: ['first-library-track']
  }), ['selected-b', 'selected-c']);
});

test('uses the current page queue when no prepared queue exists', () => {
  assert.deepEqual(resolveTransportQueue({
    page: 'library',
    currentId: null,
    preparedQueue: [],
    pageQueue: ['library-a', 'library-b']
  }), ['library-a', 'library-b']);
  assert.deepEqual(resolveTransportQueue({
    page: 'queue',
    currentId: 'a',
    preparedQueue: ['a', 'b'],
    pageQueue: ['other']
  }), ['a', 'b']);
});

test('resumes only with the live, edited queue and does not re-add removed tracks', () => {
  assert.deepEqual(resolveResumeQueue({
    savedCurrentId: 'a',
    liveQueue: ['a', 'c'],
    availableTrackIds: ['a', 'b', 'c']
  }), ['a', 'c']);
  assert.equal(resolveResumeQueue({
    savedCurrentId: 'a',
    liveQueue: ['b', 'c'],
    availableTrackIds: ['a', 'b', 'c']
  }), null);
  assert.deepEqual(resolveResumeQueue({
    savedCurrentId: 'a',
    liveQueue: ['a', 'b', 'missing'],
    availableTrackIds: ['a', 'b']
  }), ['a', 'b']);
});

test('shuffle never moves the already-played prefix behind the current track', () => {
  const result = shuffleUpcomingQueue(['a', 'b', 'c', 'd', 'e', 'f'], 'c', () => 0);
  assert.deepEqual(result.slice(0, 3), ['a', 'b', 'c']);
  assert.deepEqual(result.slice(3).sort(), ['d', 'e', 'f']);
  assert.deepEqual(restoreUnshuffledQueue(['a', 'b', 'c', 'd', 'e', 'f'], result), ['a', 'b', 'c', 'd', 'e', 'f']);
});
