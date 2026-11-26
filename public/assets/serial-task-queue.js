/**
 * Runs asynchronous tasks in order and keeps the queue alive after failures.
 */
export class SerialTaskQueue {
  constructor() {
    this.tail = Promise.resolve();
  }

  run(task) {
    if (typeof task !== "function") {
      return Promise.reject(new TypeError("Serial queue task must be a function."));
    }

    const result = this.tail.then(task, task);
    this.tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}
