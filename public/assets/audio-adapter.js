export class BrowserAudioAdapter {
  constructor(element) {
    if (!(element instanceof HTMLAudioElement)) {
      throw new TypeError('Нужен HTMLAudioElement.');
    }

    this.element = element;
    this.externalElement = document.createElement('audio');
    this.externalElement.preload = 'metadata';
    this.externalElement.setAttribute('aria-hidden', 'true');
    this.externalElement.tabIndex = -1;
    this.element.insertAdjacentElement('afterend', this.externalElement);

    this.activeElement = this.element;
    this.currentUrl = null;
    this.volume = Number.isFinite(element.volume) ? element.volume : 0.8;
    this.muted = Boolean(element.muted);
    this.repeat = Boolean(element.loop);
    this.listeners = new Map();
    this.handlers = new Map();

    const mediaEvents = [
      'play', 'pause', 'ended', 'timeupdate', 'loadedmetadata',
      'durationchange', 'error', 'waiting', 'canplay'
    ];

    for (const type of mediaEvents) {
      const handlers = new Map();
      for (const media of [this.element, this.externalElement]) {
        const handler = event => {
          if (media !== this.activeElement) return;
          this.listeners.get(type)?.forEach(callback => callback(event));
        };
        handlers.set(media, handler);
        media.addEventListener(type, handler);
      }
      this.handlers.set(type, handlers);
    }

    this.applyAudioSettings(this.element);
    this.applyAudioSettings(this.externalElement);
  }

  on(type, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Обработчик аудиособытия должен быть функцией.');
    }
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
    return () => this.listeners.get(type)?.delete(callback);
  }

  applyAudioSettings(media) {
    media.volume = this.volume;
    media.muted = this.muted;
    media.loop = this.repeat;
  }

  shouldUseExternalElement(track) {
    if (!(track?.url && !track.file)) return false;

    try {
      const source = new URL(track.url, document.baseURI);
      return source.origin !== globalThis.location?.origin;
    } catch {
      return true;
    }
  }

  clearMediaSource(media) {
    try {
      media.pause();
      media.removeAttribute('src');
      media.load();
    } catch {
      // Keep cleanup best-effort: the next source must still be loadable.
    }
  }

  async play(track) {
    if (!track?.file && !track?.url) {
      throw new Error('У композиции нет доступного аудиофайла.');
    }

    const target = this.shouldUseExternalElement(track)
      ? this.externalElement
      : this.element;

    for (const media of [this.element, this.externalElement]) {
      this.clearMediaSource(media);
    }
    this.revokeObjectUrl();

    this.activeElement = target;
    this.applyAudioSettings(target);

    const source = track.file instanceof Blob
      ? URL.createObjectURL(track.file)
      : track.url;

    this.currentUrl = track.file instanceof Blob ? source : null;
    target.src = source;
    target.load();
    await target.play();
  }

  async resume() {
    await this.activeElement.play();
  }

  pause() {
    this.activeElement.pause();
  }

  stop() {
    for (const media of [this.element, this.externalElement]) {
      this.clearMediaSource(media);
    }
    this.revokeObjectUrl();
    this.activeElement = this.element;
  }

  seek(seconds) {
    const duration = this.activeElement.duration;
    if (!Number.isFinite(seconds) || !Number.isFinite(duration)) return;
    this.activeElement.currentTime = Math.max(0, Math.min(seconds, duration || 0));
  }

  setVolume(value) {
    const numeric = Number(value);
    this.volume = Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : 0;
    for (const media of [this.element, this.externalElement]) {
      media.volume = this.volume;
    }
  }

  setMuted(enabled) {
    this.muted = Boolean(enabled);
    for (const media of [this.element, this.externalElement]) {
      media.muted = this.muted;
    }
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  setRepeat(enabled) {
    this.repeat = Boolean(enabled);
    for (const media of [this.element, this.externalElement]) {
      media.loop = this.repeat;
    }
  }

  getStatus() {
    const media = this.activeElement;
    return {
      playing: !media.paused && !media.ended,
      position: media.currentTime || 0,
      duration: Number.isFinite(media.duration) ? media.duration : 0
    };
  }

  revokeObjectUrl() {
    if (this.currentUrl) URL.revokeObjectURL(this.currentUrl);
    this.currentUrl = null;
  }

  destroy() {
    this.stop();
    for (const [type, handlers] of this.handlers) {
      for (const [media, handler] of handlers) {
        media.removeEventListener(type, handler);
      }
      handlers.clear();
    }
    this.handlers.clear();
    this.listeners.clear();
    this.externalElement.remove();
  }
}
