import { classifyMusicUrl } from './music-url.js';
import { isLicensedOpenverseTrack } from './plus-search.js';

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
        album: track.album, lyrics: String(track.lyrics||'').slice(0,100000), type: audioBlob.type || '', size: track.size,
        lastModified: track.lastModified, duration: track.duration || 0, addedAt: Date.now()
      });
      tx.objectStore(AUDIO).put(audioBlob, track.id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('Не удалось записать аудиофайл.'));
      tx.onabort = () => reject(tx.error || new Error('Запись аудиофайла отменена.'));
    });
  }

  async putLink(track) {
    if (!track || typeof track.id !== 'string' || !track.id) {
      throw new TypeError('У ссылки должен быть ID.');
    }
    if (Boolean(track.url) === Boolean(track.externalUrl)) {
      throw new TypeError('Укажи ровно один источник: прямой аудиопоток или музыкальный сайт.');
    }

    const value = track.url || track.externalUrl;
    const openverseTrack = track.providerId === 'openverse' && isLicensedOpenverseTrack(track);
    const classification = openverseTrack
      ? { ok: true, kind: 'direct-audio', serviceId: 'openverse', serviceName: 'Openverse', url: value }
      : classifyMusicUrl(value);
    if (!classification.ok) {
      throw new TypeError(classification.reason || 'Ссылка не прошла проверку.');
    }
    if (track.url && classification.kind !== 'direct-audio') {
      throw new TypeError('Поток должен быть прямым аудиофайлом.');
    }
    if (track.externalUrl && classification.kind !== 'music-site') {
      throw new TypeError('Закладка должна вести на распознанный музыкальный сайт.');
    }

    const metadata = {
      id: track.id,
      name: String(track.name || track.title || 'Music link').trim().slice(0, 240),
      title: String(track.title || 'Music link').trim().slice(0, 160),
      artist: String(track.artist || '').trim().slice(0, 120),
      album: String(track.album || 'Added from link').trim().slice(0, 120),
      lyrics: String(track.lyrics || '').slice(0, 100000),
      type: 'link',
      providerId: classification.serviceId,
      providerName: classification.serviceName,
      linkKind: classification.kind,
      size: 0,
      lastModified: 0,
      duration: 0,
      addedAt: Number(track.addedAt) || Date.now()
    };

    if (openverseTrack) {
      metadata.openverseId = String(track.openverseId || track.id).slice(0, 180);
      metadata.sourceUrl = track.sourceUrl;
      metadata.licenseCode = String(track.licenseCode).toLowerCase();
      metadata.licenseVersion = String(track.licenseVersion || '').slice(0, 20);
      metadata.licenseUrl = track.licenseUrl;
      metadata.attribution = String(track.attribution || '').slice(0, 1200);
      metadata.fileType = String(track.fileType || '').slice(0, 40);
      metadata.size = Math.max(0, Number(track.size) || 0);
      metadata.duration = Math.max(0, Number(track.duration) || 0);
    }

    if (classification.kind === 'direct-audio') metadata.url = classification.url;
    else metadata.externalUrl = classification.url;

    const db = await this.open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS, 'readwrite');
      tx.objectStore(TRACKS).put(metadata);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('Не удалось сохранить ссылку.'));
      tx.onabort = () => reject(tx.error || new Error('Сохранение ссылки отменено.'));
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

  async updateMetadata(track) {
    if (!track || typeof track.id !== "string" || !track.id) {
      throw new TypeError("Для обновления метаданных нужен идентификатор трека.");
    }
    const metadata = {
      title: String(track.title || "").trim().slice(0, 160),
      artist: String(track.artist || "").trim().slice(0, 120),
      album: String(track.album || "").trim().slice(0, 120),
      lyrics: String(track.lyrics || "").slice(0, 100000)
    };
    if (!metadata.title) throw new TypeError("Название композиции не может быть пустым.");
    const db = await this.open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(TRACKS, "readwrite");
      const objectStore = tx.objectStore(TRACKS);
      const request = objectStore.get(track.id);
      request.onsuccess = () => {
        if (!request.result) {
          try { tx.abort(); } catch {}
          reject(new Error("Трек больше не существует в медиатеке."));
          return;
        }
        objectStore.put({ ...request.result, ...metadata });
      };
      request.onerror = () => {
        try { tx.abort(); } catch {}
        reject(request.error || new Error("Не удалось прочитать метаданные трека."));
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error("Не удалось обновить метаданные."));
      tx.onabort = () => reject(tx.error || new Error("Обновление метаданных отменено."));
    });
  }

  async removeMany(ids) {
    if (!Array.isArray(ids) || ids.length > 5000 || ids.some(id => typeof id !== 'string' || !id.trim())) {
      throw new TypeError('Для пакетного удаления нужен список допустимых ID треков (не более 5000).');
    }
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return 0;
    const db = await this.open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([TRACKS, AUDIO], 'readwrite');
      const metadata = tx.objectStore(TRACKS);
      const audio = tx.objectStore(AUDIO);
      for (const id of uniqueIds) {
        metadata.delete(id);
        audio.delete(id);
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('Не удалось пакетно удалить записи медиатеки.'));
      tx.onabort = () => reject(tx.error || new Error('Пакетное удаление медиатеки было отменено.'));
    });
    return uniqueIds.length;
  }

  async remove(id) {
    if (typeof id !== 'string' || !id.trim()) throw new TypeError('Для удаления нужен идентификатор трека.');
    return this.removeMany([id]);
  }
}
