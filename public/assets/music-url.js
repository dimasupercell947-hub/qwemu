const PLATFORM_DEFINITIONS = [
  { id: 'youtube-music', name: 'YouTube Music / YouTube', category: 'Видео и музыка', domains: ['music.youtube.com', 'youtube.com', 'youtu.be'] },
  { id: 'spotify', name: 'Spotify', category: 'Стриминговые сервисы', domains: ['spotify.com', 'spotify.link'] },
  { id: 'apple-music', name: 'Apple Music', category: 'Стриминговые сервисы', domains: ['music.apple.com', 'apple.co'] },
  { id: 'soundcloud', name: 'SoundCloud', category: 'Независимая музыка', domains: ['soundcloud.com', 'on.soundcloud.com', 'snd.sc'] },
  { id: 'bandcamp', name: 'Bandcamp', category: 'Независимая музыка', domains: ['bandcamp.com'] },
  { id: 'deezer', name: 'Deezer', category: 'Стриминговые сервисы', domains: ['deezer.com', 'deezer.page.link', 'dzr.page.link'] },
  { id: 'tidal', name: 'TIDAL', category: 'Стриминговые сервисы', domains: ['tidal.com'] },
  { id: 'audiomack', name: 'Audiomack', category: 'Независимая музыка', domains: ['audiomack.com'] },
  { id: 'mixcloud', name: 'Mixcloud', category: 'Миксы и радио', domains: ['mixcloud.com'] },
  { id: 'amazon-music', name: 'Amazon Music', category: 'Стриминговые сервисы', domains: ['music.amazon.com', 'music.amazon.co.uk', 'music.amazon.de', 'music.amazon.fr', 'music.amazon.it', 'music.amazon.es', 'music.amazon.ca', 'music.amazon.co.jp', 'music.amazon.com.au', 'music.amazon.in'] },
  { id: 'qobuz', name: 'Qobuz', category: 'Стриминговые сервисы', domains: ['qobuz.com'] },
  { id: 'lastfm', name: 'Last.fm', category: 'Музыкальные сообщества', domains: ['last.fm'] },
  { id: 'pandora', name: 'Pandora', category: 'Радио', domains: ['pandora.com'] },
  { id: 'jamendo', name: 'Jamendo', category: 'Независимая музыка', domains: ['jamendo.com'] },
  { id: 'audius', name: 'Audius', category: 'Независимая музыка', domains: ['audius.co'] },
  { id: 'free-music-archive', name: 'Free Music Archive', category: 'Независимая музыка', domains: ['freemusicarchive.org'] },
  { id: 'hearthis', name: 'hearthis.at', category: 'Миксы и радио', domains: ['hearthis.at'] },
  { id: 'reverbnation', name: 'ReverbNation', category: 'Музыкальные сообщества', domains: ['reverbnation.com'] },
  { id: 'yandex-music', name: 'Яндекс Музыка', category: 'Российские сервисы', domains: ['music.yandex.ru', 'music.yandex.com', 'music.yandex.kz', 'music.yandex.by', 'music.yandex.uz'] },
  { id: 'vk-music', name: 'VK Музыка', category: 'Российские сервисы', domains: ['vk.com', 'vk.ru'], paths: ['/music', '/audio'] },
  { id: 'zvuk', name: 'Звук', category: 'Российские сервисы', domains: ['zvuk.com'] },
  { id: 'mts-music', name: 'МТС Музыка', category: 'Российские сервисы', domains: ['music.mts.ru'] },
  { id: 'anghami', name: 'Anghami', category: 'Стриминговые сервисы', domains: ['anghami.com'] },
  { id: 'boomplay', name: 'Boomplay', category: 'Стриминговые сервисы', domains: ['boomplay.com'] },
  { id: 'jiosaavn', name: 'JioSaavn', category: 'Стриминговые сервисы', domains: ['jiosaavn.com'] },
  { id: 'kkbox', name: 'KKBOX', category: 'Стриминговые сервисы', domains: ['kkbox.com'] }
];

export const MUSIC_PLATFORMS = Object.freeze(PLATFORM_DEFINITIONS.map(platform => Object.freeze({
  ...platform,
  domains: Object.freeze([...platform.domains]),
  paths: platform.paths ? Object.freeze([...platform.paths]) : undefined
})));

export const DIRECT_AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'flac', 'ogg', 'oga', 'm4a', 'aac',
  'opus', 'webm', 'mp4', '3gp', 'm4b'
]);

function normalizeInput(input) {
  const value = String(input ?? '').trim();
  if (!value) return null;

  // Pasted hostnames without a scheme are safely upgraded to HTTPS.
  if (!/^[a-z][a-z\d+.-]*:/i.test(value)) return 'https://' + value;
  return value;
}

function isPublicHostname(hostname) {
  const value = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!value || value === 'localhost') return false;
  if (/\.(?:localhost|local|internal|lan|home|test)$/i.test(value)) return false;
  // IP literals are deliberately not accepted. This avoids linking to local
  // network devices and keeps the importer limited to public DNS hostnames.
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) || value.includes(':')) return false;
  return value.includes('.');
}

function domainMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith('.' + domain);
}

function matchPlatform(url) {
  for (const platform of MUSIC_PLATFORMS) {
    const domainAllowed = platform.domains.some(domain => domainMatches(url.hostname, domain));
    if (!domainAllowed) continue;

    if (platform.paths) {
      const pathAllowed = platform.paths.some(path =>
        url.pathname === path || url.pathname.startsWith(path + '/')
      );
      if (!pathAllowed) continue;
    }

    // Amazon's parent domain is intentionally not trusted; only its explicit
    // regional Music hosts are present in the allow-list above.
    return platform;
  }
  return null;
}

function extensionFromPath(pathname) {
  const lastSegment = String(pathname || '').split('/').filter(Boolean).pop() || '';
  return lastSegment.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
}

export function classifyMusicUrl(input) {
  const normalized = normalizeInput(input);
  if (!normalized) return { ok: false, kind: 'invalid', reason: 'Вставь HTTPS-ссылку.' };

  let url;
  try {
    url = new URL(normalized);
  } catch {
    return { ok: false, kind: 'invalid', reason: 'Некорректная ссылка.' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, kind: 'invalid', reason: 'Разрешены только HTTPS-ссылки.' };
  }
  if (url.username || url.password || (url.port && url.port !== '443')) {
    return { ok: false, kind: 'invalid', reason: 'Ссылка содержит данные входа или нестандартный порт.' };
  }
  if (!isPublicHostname(url.hostname)) {
    return { ok: false, kind: 'invalid', reason: 'Локальные адреса и IP-адреса не принимаются.' };
  }

  url.hash = '';

  // An approved music platform remains a bookmark even when a slug happens
  // to end with an audio-looking extension.
  const platform = matchPlatform(url);
  if (platform) {
    return {
      ok: true,
      kind: 'music-site',
      serviceId: platform.id,
      serviceName: platform.name,
      category: platform.category,
      url: url.href,
      hostname: url.hostname,
      extension: ''
    };
  }

  const extension = extensionFromPath(url.pathname);
  if (DIRECT_AUDIO_EXTENSIONS.has(extension)) {
    return {
      ok: true,
      kind: 'direct-audio',
      serviceId: 'direct-audio',
      serviceName: 'Прямой аудиопоток',
      url: url.href,
      hostname: url.hostname,
      extension
    };
  }

  return {
    ok: false,
    kind: 'invalid',
    reason: 'Сайт не распознан. Поддерживаются прямые аудиофайлы и перечисленные музыкальные платформы.'
  };
}

export function titleFromMusicUrl(value) {
  try {
    const url = new URL(String(value));
    const tail = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
    const cleaned = tail
      .replace(/\.(mp3|wav|flac|ogg|oga|m4a|aac|opus|webm|mp4|3gp|m4b)$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    return cleaned || url.hostname.replace(/^www\./, '');
  } catch {
    return 'Музыка по ссылке';
  }
}
