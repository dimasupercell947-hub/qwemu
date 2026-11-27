import test from 'node:test';
import assert from 'node:assert/strict';
import { SerialTaskQueue } from '../public/assets/serial-task-queue.js';

test('serial queue executes asynchronous work in submission order', async () => {
  const queue = new SerialTaskQueue();
  const order = [];

  const first = queue.run(async () => {
    order.push('first:start');
    await new Promise(resolve => setTimeout(resolve, 10));
    order.push('first:end');
    return 1;
  });
  const second = queue.run(async () => {
    order.push('second:start');
    order.push('second:end');
    return 2;
  });

  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  assert.deepEqual(order, ['first:start', 'first:end', 'second:start', 'second:end']);
});

test('a failed task does not block later tasks', async () => {
  const queue = new SerialTaskQueue();
  const failure = queue.run(async () => {
    throw new Error('expected failure');
  });
  const next = queue.run(async () => 'recovered');

  await assert.rejects(failure, /expected failure/);
  assert.equal(await next, 'recovered');
});

test('non-function tasks are rejected without poisoning the queue', async () => {
  const queue = new SerialTaskQueue();

  await assert.rejects(queue.run(null), TypeError);
  assert.equal(await queue.run(() => 'ok'), 'ok');
});
