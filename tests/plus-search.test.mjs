import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpenverseSearchUrl, isLicensedOpenverseTrack, isPublicHttpsUrl, normalizeOpenverseAudio, searchOpenverseAudio } from '../public/assets/plus-search.js';

const sample = {
  id: 'openverse-123', title: 'Openly Licensed Track', creator: 'Sample Artist',
  provider: 'Test Provider', url: 'https://cdn.example.org/audio/sample.mp3',
  foreign_landing_url: 'https://source.example.org/track/123',
  license: 'by', license_version: '4.0',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  filetype: 'mp3', duration: 182, filesize: 5000000
};

test('builds a bounded Openverse request with commercial-use filters', () => {
  const url = new URL(buildOpenverseSearchUrl('dabbackwood', 2));
  assert.equal(url.origin + url.pathname, 'https://api.openverse.org/v1/audio/');
  assert.equal(url.searchParams.get('q'), 'dabbackwood');
  assert.equal(url.searchParams.get('license_type'), 'commercial');
  assert.equal(url.searchParams.get('filter_dead'), 'true');
  assert.equal(url.searchParams.get('category'), 'music');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('page_size'), '20');
  assert.throws(() => buildOpenverseSearchUrl('x'), /не менее двух/);
});

test('accepts CC0, Public Domain, CC BY and CC BY-SA with HTTPS source URLs', () => {
  for (const license of ['cc0', 'pdm', 'by', 'by-sa']) {
    const normalized = normalizeOpenverseAudio({ ...sample, license });
    assert.ok(normalized, license);
    assert.equal(normalized.licenseCode, license);
    assert.equal(isLicensedOpenverseTrack({
      providerId: 'openverse', url: normalized.url, sourceUrl: normalized.sourceUrl,
      licenseCode: license, licenseUrl: normalized.licenseUrl
    }), true);
  }
});

test('rejects non-commercial and untrusted or insecure media metadata', () => {
  assert.equal(normalizeOpenverseAudio({ ...sample, license: 'by-nc' }), null);
  assert.equal(normalizeOpenverseAudio({ ...sample, url: 'http://cdn.example.org/file.mp3' }), null);
  assert.equal(normalizeOpenverseAudio({ ...sample, url: 'https://127.0.0.1/file.mp3' }), null);
  assert.equal(normalizeOpenverseAudio({ ...sample, foreign_landing_url: 'https://evil.local/track' }), null);
  assert.equal(normalizeOpenverseAudio({ ...sample, license_url: 'https://evil.example/license' }), null);
  assert.equal(normalizeOpenverseAudio({ ...sample, license: 'unknown' }), null);
});

test('public HTTPS URL validation rejects credentials, IP literals and local hosts', () => {
  for (const value of ['http://example.org/song.mp3', 'https://user:pass@example.org/song.mp3', 'https://localhost/song.mp3', 'https://nas.local/song.mp3', 'https://192.168.1.1/song.mp3', 'https://[::1]/song.mp3']) {
    assert.equal(isPublicHttpsUrl(value), false, value);
  }
  assert.equal(isPublicHttpsUrl('https://cdn.example.org/song.mp3'), true);
});

test('search omits credentials, normalizes results and forwards abort signals', async () => {
  let requestUrl = '';
  let requestOptions;
  const result = await searchOpenverseAudio('artist title', {
    fetchImpl: async (url, options) => {
      requestUrl = url;
      requestOptions = options;
      return new Response(JSON.stringify({
        page: 1, page_count: 3, result_count: 42, results: [sample, { ...sample, id: 'blocked', license: 'by-nc' }]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });
  assert.equal(new URL(requestUrl).searchParams.get('q'), 'artist title');
  assert.equal(requestOptions.credentials, 'omit');
  assert.equal(requestOptions.method, 'GET');
  assert.equal(result.page, 1);
  assert.equal(result.pageCount, 3);
  assert.equal(result.resultCount, 42);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].id, 'openverse-123');
});

test('surfaces source rate limiting with a useful message', async () => {
  await assert.rejects(searchOpenverseAudio('artist', { fetchImpl: async () => new Response('', { status: 429 }) }), /ограничил частоту/);
});
