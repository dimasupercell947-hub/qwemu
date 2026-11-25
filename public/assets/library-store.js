const DB_NAME = 'qwemu.music.desktop.library';
const DB_VERSION = 1;
const TRACKS = 'tracks';
const AUDIO = 'audio';

export class LibraryStore {
  constructor() { this.database = null; this.opening = null; }

  open() {
    if (this.database) return Promise.resolve(this.database);
    if (this.opening) return this.opening;
    if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB недоступен в этом профиле Windows.'));
    this.opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(TRACKS)) db.createObjectStore(TRACKS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(AUDIO)) db.createObjectStore(AUDIO);
      };
      request.onsuccess = () => {
        this.database = request.result;
        this.database.onversionchange = () => {
          this.database?.close();
          this.database = null;
          this.opening = null;
        };
        resolve(this.database);
      };
      request.onerror = () => reject(request.error || new Error('Не удалось открыть медиатеку.'));
      request.onblocked = () => reject(new Error('Обновление медиатеки заблокировано другим окном QWEMU.'));
    }).catch(error => { this.opening = null; throw error; });
    return this.opening;
  }

  async put(track, audioBlob) {
    if (!track || typeof track.id !== 'string' || !(audioBlob instanceof Blob)) {
      throw new TypeError('Некорректные метаданные или аудиофайл.');
    }
    const db = await this.open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([TRACKS, AUDIO], 'readwrite');
      tx.objectStore(TRACKS).put({
        id: track.id, name: track.name, title: track.title, artist: track.artist,
        album: track.album, type: audioBlob.type || '', size: track.size,
        lastModified: track.lastModified, duration: track.duration || 0, addedAt: Date.now()
      });
      tx.objectStore(AUDIO).put(audioBlob, track.id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('Не удалось записать аудиофайл.'));
      tx.onabort = () => reject(tx.error || new Error('Запись аудиофайла отменена.'));
    });
  }

  async list() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS, 'readonly');
      const request = tx.objectStore(TRACKS).getAll();
      request.onsuccess = () => {
        const rows = Array.isArray(request.result) ? request.result : [];
        rows.sort((a,b) => (Number(a.addedAt)||0) - (Number(b.addedAt)||0));
        resolve(rows);
      };
      request.onerror = () => reject(request.error || new Error('Не удалось прочитать медиатеку.'));
    });
  }

  async getFile(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO, 'readonly');
      const request = tx.objectStore(AUDIO).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Не удалось прочитать аудиофайл.'));
    });
  }
}
