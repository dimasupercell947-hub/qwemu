import test from 'node:test';
import assert from 'node:assert/strict';
import { LibraryStore } from '../public/assets/library-store.js';

function createIndexedDB() {
  const databases = new Map();
  return {
    open(name) {
      const request = {};
      queueMicrotask(() => {
        let db = databases.get(name);
        let created = false;
        if (!db) {
          const stores = new Map();
          db = {
            objectStoreNames: { contains: storeName => stores.has(storeName) },
            createObjectStore(storeName, options = {}) {
              const store = new Map();
              store.keyPath = options.keyPath || null;
              stores.set(storeName, store);
              return {};
            },
            transaction() {
              const tx = { error: null, oncomplete: null, onerror: null, onabort: null };
              let completionQueued = false;
              const complete = () => {
                if (completionQueued) return;
                completionQueued = true;
                queueMicrotask(() => tx.oncomplete?.({ target: tx }));
              };
              tx.objectStore = storeName => {
                const store = stores.get(storeName);
                if (!store) throw new Error('Unknown object store: ' + storeName);
                return {
                  put(value, key) {
                    const actualKey = key ?? (store.keyPath ? value[store.keyPath] : undefined);
                    store.set(actualKey, value);
                    complete();
                  },
                  get(key) {
                    const req = {};
                    queueMicrotask(() => {
                      req.result = store.get(key);
                      req.onsuccess?.({ target: req });
                    });
                    return req;
                  },
                  getAll() {
                    const req = {};
                    queueMicrotask(() => {
                      req.result = [...store.values()];
                      req.onsuccess?.({ target: req });
                    });
                    return req;
                  },
                  delete(key) {
                    store.delete(key);
                    complete();
                  }
                };
              };
              return tx;
            },
            close() {}
          };
          databases.set(name, db);
          created = true;
        }
        request.result = db;
        if (created) request.onupgradeneeded?.({ target: request });
        request.onsuccess?.({ target: request });
      });
      return request;
    }
  };
}

test('LibraryStore persists metadata and audio, and deletes both atomically', async () => {
  const original = globalThis.indexedDB;
  globalThis.indexedDB = createIndexedDB();
  try {
    const store = new LibraryStore();
    const track = {
      id: 'track-1',
      name: 'sample.mp3',
      title: 'Sample',
      artist: 'QWEMU',
      album: 'Tests',
      size: 4,
      lastModified: 123,
      duration: 0
    };
    const audio = new Blob(['test'], { type: 'audio/mpeg' });

    await store.put(track, audio);

    const rows = await store.list();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, track.id);
    assert.equal(rows[0].title, track.title);

    const restored = await store.getFile(track.id);
    assert.ok(restored instanceof Blob);
    assert.equal(await restored.text(), 'test');

    await store.remove(track.id);
    assert.deepEqual(await store.list(), []);
    assert.equal(await store.getFile(track.id), null);
    await assert.rejects(store.remove(''), TypeError);
  } finally {
    if (original === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = original;
  }
});
