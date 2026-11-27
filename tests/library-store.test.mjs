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
      lyrics: '[00:01]Line one',
      size: 4,
      lastModified: 123,
      duration: 0
    };
    const audio = new Blob(['test'], { type: 'audio/mpeg' });

    await store.put(track, audio);
    await store.updateMetadata({ ...track, title: 'Edited title', artist: 'New artist', album: 'New album' });

    const rows = await store.list();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, track.id);
    assert.equal(rows[0].title, 'Edited title');
    assert.equal(rows[0].artist, 'New artist');
    assert.equal(rows[0].album, 'New album');
    assert.equal(rows[0].lyrics, '[00:01]Line one');

    const restored = await store.getFile(track.id);
    assert.ok(restored instanceof Blob);
    assert.equal(await restored.text(), 'test');

    const direct = {id:'direct-1',name:'remote.opus',title:'Remote stream',artist:'QWEMU',album:'Link',url:'https://cdn.example.com/remote.opus',addedAt:Date.now()};
    const bookmark = {id:'bookmark-1',name:'Spotify link',title:'External',artist:'QWEMU',album:'Link',externalUrl:'https://open.spotify.com/track/demo',addedAt:Date.now()};
    await store.putLink(direct);await store.putLink(bookmark);
    const linked=await store.list();
    const storedDirect = linked.find(item => item.id === 'direct-1');
    const storedBookmark = linked.find(item => item.id === 'bookmark-1');
    assert.equal(storedDirect.url, direct.url);
    assert.equal(storedDirect.linkKind, 'direct-audio');
    assert.equal(storedDirect.providerId, 'direct-audio');
    assert.equal(storedDirect.providerName, 'Прямой аудиопоток');
    assert.equal(storedBookmark.externalUrl, bookmark.externalUrl);
    assert.equal(storedBookmark.linkKind, 'music-site');
    assert.equal(storedBookmark.providerId, 'spotify');
    assert.equal(storedBookmark.providerName, 'Spotify');
    await assert.rejects(store.putLink({...direct,url:'http://insecure.example.com/audio.mp3'}),TypeError);
    await assert.rejects(store.putLink({...direct,externalUrl:bookmark.externalUrl}),TypeError);

    const removed = await store.removeMany([track.id, direct.id, direct.id, bookmark.id]);
    assert.equal(removed, 3, 'batch deletion de-duplicates IDs and reports deleted entries');
    assert.deepEqual(await store.list(), []);
    assert.equal(await store.getFile(track.id), null);
    assert.equal(await store.removeMany([]), 0);
    await assert.rejects(store.remove(''), TypeError);
    await assert.rejects(store.removeMany(['valid', '']), TypeError);
    await assert.rejects(store.removeMany('not-an-array'), TypeError);
  } finally {
    if (original === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = original;
  }
});

test('LibraryStore persists Openverse stream URL and Creative Commons attribution', async () => {
  const original = globalThis.indexedDB;
  globalThis.indexedDB = createIndexedDB();
  try {
    const store = new LibraryStore();
    const track = {
      id: 'openverse-test-1', openverseId: 'openverse-test-1',
      name: 'Licensed song', title: 'Licensed song', artist: 'Sample Artist',
      album: 'Openverse', lyrics: '', size: 1024, duration: 42,
      providerId: 'openverse', providerName: 'Openverse',
      url: 'https://cdn.example.org/audio/song.mp3',
      sourceUrl: 'https://source.example.org/track/1',
      licenseCode: 'by', licenseVersion: '4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: 'Licensed song · Sample Artist · CC BY 4.0'
    };
    await store.putLink(track);
    const [saved] = await store.list();
    assert.equal(saved.url, track.url);
    assert.equal(saved.sourceUrl, track.sourceUrl);
    assert.equal(saved.licenseCode, 'by');
    assert.equal(saved.licenseVersion, '4.0');
    assert.equal(saved.licenseUrl, track.licenseUrl);
    assert.equal(saved.attribution, track.attribution);
    assert.equal(saved.providerId, 'openverse');
    assert.equal(saved.size, track.size);
    assert.equal(saved.duration, track.duration);
  } finally { globalThis.indexedDB = original; }
});
