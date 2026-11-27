import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyMusicUrl,
  DIRECT_AUDIO_EXTENSIONS,
  MUSIC_PLATFORMS,
  titleFromMusicUrl
} from '../public/assets/music-url.js';

test('recognizes the international and Russian music platform catalogue', () => {
  const examples = [
    ['https://music.youtube.com/watch?v=abc123', 'youtube-music'],
    ['https://youtu.be/abc123', 'youtube-music'],
    ['https://open.spotify.com/track/abc123', 'spotify'],
    ['https://spotify.link/example', 'spotify'],
    ['https://music.apple.com/us/album/example/123', 'apple-music'],
    ['https://on.soundcloud.com/example', 'soundcloud'],
    ['https://artist.bandcamp.com/album/example', 'bandcamp'],
    ['https://www.deezer.com/track/123', 'deezer'],
    ['https://listen.tidal.com/album/123', 'tidal'],
    ['https://audiomack.com/artist/song/example', 'audiomack'],
    ['https://www.mixcloud.com/artist/show-name/', 'mixcloud'],
    ['https://music.amazon.co.uk/albums/example', 'amazon-music'],
    ['https://play.qobuz.com/album/example', 'qobuz'],
    ['https://www.last.fm/music/artist', 'lastfm'],
    ['https://www.pandora.com/artist/example', 'pandora'],
    ['https://www.jamendo.com/track/123', 'jamendo'],
    ['https://audius.co/artist/song-123', 'audius'],
    ['https://freemusicarchive.org/music/artist/album/song/', 'free-music-archive'],
    ['https://hearthis.at/artist/example/', 'hearthis'],
    ['https://www.reverbnation.com/artist/song/123', 'reverbnation'],
    ['https://music.yandex.ru/album/123/track/456', 'yandex-music'],
    ['https://vk.com/music/playlist/123', 'vk-music'],
    ['https://vk.ru/audio', 'vk-music'],
    ['https://zvuk.com/track/123', 'zvuk'],
    ['https://music.mts.ru/track/123', 'mts-music'],
    ['https://play.anghami.com/song/123', 'anghami'],
    ['https://www.boomplay.com/songs/123', 'boomplay'],
    ['https://www.jiosaavn.com/song/example', 'jiosaavn'],
    ['https://www.kkbox.com/track/123', 'kkbox']
  ];

  for (const [url, serviceId] of examples) {
    const result = classifyMusicUrl(url);
    assert.equal(result.ok, true, url);
    assert.equal(result.kind, 'music-site', url);
    assert.equal(result.serviceId, serviceId, url);
    assert.ok(result.serviceName, url);
  }

  assert.equal(MUSIC_PLATFORMS.length, 26);
});

test('recognizes supported direct HTTPS audio extensions, including URL query strings', () => {
  for (const extension of DIRECT_AUDIO_EXTENSIONS) {
    const result = classifyMusicUrl('https://cdn.example.org/audio/song.' + extension + '?token=demo#player');
    assert.equal(result.ok, true, extension);
    assert.equal(result.kind, 'direct-audio', extension);
    assert.equal(result.extension, extension, extension);
    assert.equal(result.url.includes('#'), false, extension);
    assert.equal(result.url.includes('token=demo'), true, extension);
  }
});

test('normalizes host-only pasted links to HTTPS', () => {
  const result = classifyMusicUrl('music.yandex.ru/album/123/track/456');
  assert.equal(result.ok, true);
  assert.equal(result.url, 'https://music.yandex.ru/album/123/track/456');
  assert.equal(result.serviceId, 'yandex-music');
});

test('recognizes approved subdomains but rejects lookalike domains', () => {
  assert.equal(classifyMusicUrl('https://m.youtube.com/watch?v=123').serviceId, 'youtube-music');
  assert.equal(classifyMusicUrl('https://sub.artist.bandcamp.com/album/demo').serviceId, 'bandcamp');
  assert.equal(classifyMusicUrl('https://open.spotify.com.evil.example/track/1').ok, false);
  assert.equal(classifyMusicUrl('https://notbandcamp.com/album/demo').ok, false);
});

test('platform routes take priority over audio-looking file extensions', () => {
  const result = classifyMusicUrl('https://soundcloud.com/artist/track.mp3');
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'music-site');
  assert.equal(result.serviceId, 'soundcloud');
});

test('VK is recognized only for music and audio routes', () => {
  assert.equal(classifyMusicUrl('https://vk.com/music').serviceId, 'vk-music');
  assert.equal(classifyMusicUrl('https://vk.com/audio/playlist/123').serviceId, 'vk-music');
  assert.equal(classifyMusicUrl('https://vk.com/id123').ok, false);
});

test('rejects insecure, local, credentialed and arbitrary website URLs', () => {
  const invalid = [
    '',
    'not a url',
    'http://open.spotify.com/track/a',
    'file:///C:/song.mp3',
    'https://localhost/song.mp3',
    'https://localhost./song.mp3',
    'https://device.local/song.mp3',
    'https://device.local./song.mp3',
    'https://nas.local../song.mp3',
    'https://127.0.0.1/song.mp3',
    'https://192.168.1.20/song.mp3',
    'https://[::1]/song.mp3',
    'https://example.com/',
    'https://user:pass@open.spotify.com/track/a',
    'https://open.spotify.com:8443/track/a',
    'javascript:alert(1)'
  ];

  for (const value of invalid) {
    assert.equal(classifyMusicUrl(value).ok, false, value);
  }
});

test('does not accept arbitrary paths on services with constrained routes', () => {
  assert.equal(classifyMusicUrl('https://vk.com/market').ok, false);
});

test('title fallback is readable and malformed percent escapes are safe', () => {
  assert.equal(titleFromMusicUrl('https://cdn.example.com/lo-fi_song.mp3'), 'lo fi song');
  assert.equal(titleFromMusicUrl('https://cdn.example.com/%E0%A4%A'), 'Музыка по ссылке');
});
