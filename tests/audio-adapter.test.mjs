import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserAudioAdapter } from '../public/assets/audio-adapter.js';

class FakeAudio extends EventTarget {
  constructor() {
    super();
    this.volume = 0.8;
    this.muted = false;
    this.loop = false;
    this.paused = true;
    this.ended = false;
    this.currentTime = 0;
    this.duration = 120;
    this.preload = '';
    this.src = '';
    this.attributes = new Map();
    this.removed = false;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'src') this.src = '';
  }

  insertAdjacentElement(_position, element) {
    this.externalElement = element;
  }

  load() {}

  async play() {
    this.paused = false;
    this.ended = false;
    this.dispatchEvent(new Event('play'));
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }

  remove() {
    this.removed = true;
  }
}

test('remote direct streams use a native audio element outside the Web Audio EQ graph', async () => {
  const original = {
    Audio: globalThis.HTMLAudioElement,
    document: globalThis.document,
    location: globalThis.location
  };

  globalThis.HTMLAudioElement = FakeAudio;
  globalThis.document = {
    baseURI: 'http://tauri.localhost/',
    createElement: tag => {
      assert.equal(tag, 'audio');
      return new FakeAudio();
    }
  };
  globalThis.location = { origin: 'http://tauri.localhost' };

  try {
    const mainElement = new FakeAudio();
    const adapter = new BrowserAudioAdapter(mainElement);
    let playEvents = 0;
    adapter.on('play', () => { playEvents += 1; });

    await adapter.play({
      id: 'remote',
      url: 'https://cdn.example.org/audio/song.mp3'
    });

    assert.equal(adapter.activeElement, adapter.externalElement);
    assert.equal(adapter.externalElement.src, 'https://cdn.example.org/audio/song.mp3');
    assert.equal(mainElement.paused, true);
    assert.equal(adapter.getStatus().playing, true);
    assert.equal(playEvents, 1);

    adapter.setVolume(0.35);
    assert.equal(adapter.externalElement.volume, 0.35);
    adapter.setMuted(true);
    assert.equal(adapter.isMuted(), true);
    assert.equal(adapter.externalElement.muted, true);

    adapter.stop();
    assert.equal(adapter.getStatus().playing, false);
    assert.equal(adapter.externalElement.src, '');
    adapter.destroy();
    assert.equal(adapter.externalElement.removed, true);
  } finally {
    if (original.Audio === undefined) delete globalThis.HTMLAudioElement;
    else globalThis.HTMLAudioElement = original.Audio;
    if (original.document === undefined) delete globalThis.document;
    else globalThis.document = original.document;
    if (original.location === undefined) delete globalThis.location;
    else globalThis.location = original.location;
  }
});

test('local Blob audio stays on the EQ-connected primary audio element', async () => {
  const original = {
    Audio: globalThis.HTMLAudioElement,
    document: globalThis.document,
    location: globalThis.location
  };

  globalThis.HTMLAudioElement = FakeAudio;
  globalThis.document = {
    baseURI: 'http://tauri.localhost/',
    createElement: () => new FakeAudio()
  };
  globalThis.location = { origin: 'http://tauri.localhost' };

  try {
    const mainElement = new FakeAudio();
    const adapter = new BrowserAudioAdapter(mainElement);
    const blob = new Blob(['local-audio'], { type: 'audio/mpeg' });

    await adapter.play({ id: 'local', file: blob });

    assert.equal(adapter.activeElement, mainElement);
    assert.match(mainElement.src, /^blob:/);
    assert.equal(adapter.getStatus().playing, true);

    adapter.setVolume(0.42);
    adapter.setRepeat(true);
    assert.equal(mainElement.volume, 0.42);
    assert.equal(mainElement.loop, true);

    adapter.destroy();
  } finally {
    if (original.Audio === undefined) delete globalThis.HTMLAudioElement;
    else globalThis.HTMLAudioElement = original.Audio;
    if (original.document === undefined) delete globalThis.document;
    else globalThis.document = original.document;
    if (original.location === undefined) delete globalThis.location;
    else globalThis.location = original.location;
  }
});
