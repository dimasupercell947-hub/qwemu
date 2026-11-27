const API_ENDPOINT = 'https://api.openverse.org/v1/audio/';
const COMMERCIAL_LICENSES = new Set(['cc0', 'pdm', 'by', 'by-sa']);
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.test'];

export function isPublicHttpsUrl(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false;
  const host = String(url.hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || BLOCKED_SUFFIXES.some(suffix => host.endsWith(suffix))) return false;
  if (host.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':')) return false;
  return host.includes('.');
}

function cleanText(value, maxLength) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function normalizeOpenverseAudio(item) {
  if (!item || typeof item !== 'object') return null;
  const id = cleanText(item.id, 180);
  const title = cleanText(item.title, 160);
  const creator = cleanText(item.creator || item.creator_name, 120);
  const provider = cleanText(item.provider, 80);
  const url = cleanText(item.url, 2048);
  const sourceUrl = cleanText(item.foreign_landing_url, 2048);
  const licenseCode = cleanText(item.license, 20).toLowerCase();
  const licenseVersion = cleanText(item.license_version, 20);
  const licenseUrl = cleanText(item.license_url, 2048);
  if (!id || !title || !url || !sourceUrl || !COMMERCIAL_LICENSES.has(licenseCode)) return null;
  if (!isPublicHttpsUrl(url) || !isPublicHttpsUrl(sourceUrl) || !isPublicHttpsUrl(licenseUrl)) return null;
  let licenseHost = '';
  try { licenseHost = new URL(licenseUrl).hostname.toLowerCase(); } catch {}
  if (!(licenseHost === 'creativecommons.org' || licenseHost.endsWith('.creativecommons.org'))) return null;
  const duration = Number(item.duration);
  const fileSize = Number(item.filesize);
  const fileType = cleanText(item.filetype || item.mimetype, 40).toLowerCase();
  const attribution = [
    '«' + title + '»',
    creator ? 'автор: ' + creator : '',
    'лицензия: ' + licenseCode.toUpperCase() + (licenseVersion ? ' ' + licenseVersion : ''),
    'источник: ' + sourceUrl,
    'условия: ' + licenseUrl
  ].filter(Boolean).join(' · ');
  return Object.freeze({
    id, title, creator: creator || 'Автор не указан', provider: provider || 'Openverse',
    url, sourceUrl, licenseCode, licenseVersion, licenseUrl, attribution,
    fileType, duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
    fileSize: Number.isFinite(fileSize) && fileSize > 0 ? fileSize : 0
  });
}

export function isLicensedOpenverseTrack(track) {
  if (!track || track.providerId !== 'openverse' || !COMMERCIAL_LICENSES.has(String(track.licenseCode || '').toLowerCase())) return false;
  if (!isPublicHttpsUrl(track.url) || !isPublicHttpsUrl(track.sourceUrl) || !isPublicHttpsUrl(track.licenseUrl)) return false;
  try {
    const host = new URL(track.licenseUrl).hostname.toLowerCase();
    return host === 'creativecommons.org' || host.endsWith('.creativecommons.org');
  } catch { return false; }
}

export function buildOpenverseSearchUrl(query, page = 1) {
  const normalized = cleanText(query, 200);
  if (normalized.length < 2) throw new TypeError('Введи не менее двух символов для поиска.');
  const safePage = Number.isSafeInteger(Number(page)) ? Math.max(1, Math.min(50, Number(page))) : 1;
  const url = new URL(API_ENDPOINT);
  url.searchParams.set('q', normalized);
  url.searchParams.set('license_type', 'commercial');
  url.searchParams.set('filter_dead', 'true');
  url.searchParams.set('category', 'music');
  url.searchParams.set('page', String(safePage));
  url.searchParams.set('page_size', '20');
  return url.href;
}

export async function searchOpenverseAudio(query, {
  page = 1, signal, fetchImpl = globalThis.fetch, timeoutMs = 15000
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('В этом окружении недоступен сетевой поиск.');
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error('timeout')), Math.max(1000, Math.min(30000, timeoutMs)));
  try {
    const response = await fetchImpl(buildOpenverseSearchUrl(query, page), {
      method: 'GET', headers: { Accept: 'application/json' },
      credentials: 'omit', cache: 'no-store', redirect: 'follow', signal: controller.signal
    });
    if (response.status === 429) throw new Error('Источник временно ограничил частоту поиска. Попробуй ещё раз немного позже.');
    if (!response.ok) throw new Error('Openverse вернул HTTP ' + response.status + '. Поиск временно недоступен.');
    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results.map(normalizeOpenverseAudio).filter(Boolean) : [];
    return {
      results,
      page: Math.max(1, Number(payload?.page) || Number(page) || 1),
      pageCount: Math.max(1, Number(payload?.page_count) || 1),
      resultCount: Math.max(0, Number(payload?.result_count) || results.length)
    };
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error('Поиск превысил время ожидания. Проверь подключение и повтори запрос.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}
