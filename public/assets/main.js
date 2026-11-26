import { StorageAdapter } from './storage-adapter.js';
import { ApiAdapter } from './api-adapter.js';
import { AuthAdapter } from './auth-adapter.js';
import { BrowserAudioAdapter } from './audio-adapter.js';
import { fingerprintFile } from './file-fingerprint.js';
import { CloudWriteQueue } from './cloud-write-queue.js';
import { LibraryStore } from './library-store.js';
import { buildPlaybackQueue, getNextQueueIndex, shuffleQueue } from './playback-queue.js';
import { HISTORY_LIMIT, normalizePlayHistory, recordPlay, resolveHistoryTracks } from './history-state.js';
import { TRACK_SORT_MODES, sortTracks } from './track-sort.js';
import { exportPlaylistM3u, parsePlaylistM3u } from './playlist-io.js';
import { parseLyrics, activeLyricIndex, normalizeLyrics } from './lyrics-state.js';
import { classifyMusicUrl, titleFromMusicUrl } from './music-url.js';
import { AUDIO_ACCEPT, supportsAudioFile } from './audio-formats.js';

const $ = selector => document.querySelector(selector);
const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content || '1.7.0';
const RELEASES_URL = 'https://github.com/dimasupercell947-hub/qwemu/releases/latest';
const UPDATE_MANIFEST_URL = 'https://raw.githubusercontent.com/dimasupercell947-hub/qwemu/main/public/version.json';
const storage = new StorageAdapter();
const libraryStore = new LibraryStore();
const desktopRuntime = globalThis.QWEMU_DESKTOP === true;
let libraryReady = !desktopRuntime;
let libraryRestorePromise = Promise.resolve();
const api = new ApiAdapter();
const auth = new AuthAdapter(api);
const audio = new BrowserAudioAdapter($('#audio'));
const cloudWrites = new CloudWriteQueue();
const savedFavorites=storage.read('favorites', []);
const savedPlaylists=storage.read('playlists', []);
const savedSettings=storage.read('settings', {});
const savedHistory=storage.read('play-history', []);
const savedSortMode=storage.read('sort-mode', 'added-desc');
const validThemes = ['dark-red','orange-night','midnight','pure-black','light'];
function normalizeSettings(value) {
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const volume=Number(source.volume);
  return { theme: validThemes.includes(source.theme)?source.theme:'dark-red', volume:Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):0.8, reducedMotion:source.reducedMotion===true, backgroundPlayback:source.backgroundPlayback!==false };
}
const state = {
  page: 'home', tracks: [], favorites: Array.isArray(savedFavorites)?savedFavorites.filter(value=>typeof value==='string').slice(0,5000):[],
  playlists: Array.isArray(savedPlaylists)?savedPlaylists.filter(item=>item&&typeof item.id==='string'&&typeof item.name==='string'&&Array.isArray(item.trackIds)).slice(0,300):[],
  settings: normalizeSettings(savedSettings), settingsRevision: 0, repeatMode: 'off', shuffle: false, shuffleBackup: [],
  playHistory: normalizePlayHistory(savedHistory), sortMode: Object.hasOwn(TRACK_SORT_MODES, savedSortMode) ? savedSortMode : 'added-desc',
  currentId: null, playRequestId: 0, playbackQueue: [], playbackIndex: -1, search: '', user: null, authMode: 'login', cloudReady: false, cloudLoadId: 0, authTransition: false, activePlaylist: null, toastTimer: null,
  lyricsOpen: false, lyricsTrackId: null, activeLyric: -1, updateStatus: 'Автоматическая проверка обновлений выполняется при запуске.',
  cloudVersions: { playlists: null, favorites: null, settings: null }, cloudConflicts: {}, bootstrapData: null, pendingSequence: 0
};
const themes = { 'dark-red': ['#0c0b0d','#b51e32','#f07832'], 'orange-night': ['#100d0a','#b84b1e','#ff9b42'], midnight: ['#090d18','#394c9c','#9b85ff'], 'pure-black': ['#000000','#b51e32','#f07832'], light: ['#f3eef0','#a51f35','#e66a27'] };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const uid = () => globalThis.crypto?.randomUUID?.() || `track-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const formatTime = value => { const n = Number(value); return Number.isFinite(n) && n >= 0 ? `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}` : '0:00'; };
function toast(message) {
  const node = $('#toast'); node.textContent = message; node.classList.add('show');
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => node.classList.remove('show'), 3600);
}
function localKey(key) { return state.user ? `account.${state.user.id}.${key}` : key; }
function writeLocal(key, value) {
  try { storage.write(localKey(key), value); return true; }
  catch (error) { toast(error.message); return false; }
}
function readCloudPending() {
  const value=storage.read(localKey('pendingCloud'),{});
  return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}
function clearCloudPending(key) {
  const pending=readCloudPending();
  delete pending[key];
  try {
    if(Object.keys(pending).length)storage.write(localKey('pendingCloud'),pending);
    else storage.remove(localKey('pendingCloud'));
  } catch(error) { toast(`Не удалось очистить очередь синхронизации: ${error.message}`); }
}
function normalizeCloudValue(key,value) {
  if(key==='playlists') {
    return Array.isArray(value)?value.filter(item=>item&&typeof item.id==='string'&&typeof item.name==='string'&&Array.isArray(item.trackIds)).slice(0,300):[];
  }
  if(key==='favorites') {
    return Array.isArray(value)?[...new Set(value.filter(item=>typeof item==='string'))].slice(0,5000):[];
  }
  return normalizeSettings(value);
}
function loadScopedLocal() {
  const favorites=storage.read(localKey('favorites'),[]);
  const playlists=storage.read(localKey('playlists'),[]);
  const settings=storage.read(localKey('settings'),{});
  const history=storage.read(localKey('play-history'),[]);
  const sortMode=storage.read(localKey('sort-mode'),'added-desc');
  state.favorites=Array.isArray(favorites)?favorites.filter(value=>typeof value==='string').slice(0,5000):[];
  state.playlists=Array.isArray(playlists)?playlists.filter(item=>item&&typeof item.id==='string'&&typeof item.name==='string'&&Array.isArray(item.trackIds)).slice(0,300):[];
  state.settings=normalizeSettings(settings);
  state.playHistory=normalizePlayHistory(history);
  state.sortMode=Object.hasOwn(TRACK_SORT_MODES,sortMode)?sortMode:'added-desc';
  state.cloudVersions={playlists:null,favorites:null,settings:null};
  state.cloudConflicts={};
  state.cloudReady=false;
}
function saveLocal() {
  writeLocal('favorites',state.favorites);
  writeLocal('playlists',state.playlists);
  writeLocal('settings',state.settings);
  writeLocal('play-history',state.playHistory);
  writeLocal('sort-mode',state.sortMode);
}
function applyTheme() {
  const selected = themes[state.settings.theme] ? state.settings.theme : 'dark-red';
  document.documentElement.dataset.theme = selected;
  document.documentElement.classList.toggle('reduce-motion', state.settings.reducedMotion);
  const [bg, red, orange] = themes[selected];
  document.documentElement.style.setProperty('--bg', bg);
  document.documentElement.style.setProperty('--red', red);
  document.documentElement.style.setProperty('--orange', orange);
  document.documentElement.style.setProperty('--accent', `linear-gradient(115deg,${red},${orange})`);
  document.documentElement.style.colorScheme = selected === 'light' ? 'light' : 'dark';
  if (selected === 'light') {
    document.documentElement.style.setProperty('--panel', '#ffffff');
    document.documentElement.style.setProperty('--panel2', '#f6edf0');
    document.documentElement.style.setProperty('--line', '#dfd1d7');
    document.documentElement.style.setProperty('--text', '#21191e');
    document.documentElement.style.setProperty('--muted', '#766a71');
  } else {
    for (const [key, value] of [['--panel','#151316'],['--panel2','#1b181b'],['--line','#2a2429'],['--text','#f6f0f1'],['--muted','#a79da3']]) document.documentElement.style.setProperty(key, value);
  }
}
function historyTracks(limit=HISTORY_LIMIT) {
  return resolveHistoryTracks(state.playHistory,state.tracks).slice(0,limit)
    .map(entry=>({...entry.track,lastPlayedAt:entry.playedAt}));
}
function sortControl() {
  const options=Object.entries(TRACK_SORT_MODES).map(([value,label])=>
    '<option value="'+value+'" '+(state.sortMode===value?'selected':'')+'>'+escapeHtml(label)+'</option>'
  ).join('');
  return '<label class="sort-control">Сортировка<select id="sort-select">'+options+'</select></label>';
}
function visibleTracks() {
  let list=state.tracks;
  let fixedOrder=false;
  if(state.page==='favorites') list=list.filter(track=>state.favorites.includes(track.id));
  else if(state.page==='playlists'&&state.activePlaylist) {
    const playlist=state.playlists.find(item=>item.id===state.activePlaylist);
    list=list.filter(track=>playlist?.trackIds.includes(track.id));
  } else if(state.page==='queue') {
    const byId=new Map(state.tracks.map(track=>[track.id,track]));
    list=state.playbackQueue.map(id=>byId.get(id)).filter(Boolean);fixedOrder=true;
  } else if(state.page==='history') { list=historyTracks();fixedOrder=true; }
  const query=state.search.trim().toLocaleLowerCase();
  if(query) list=list.filter(track=>(String(track.title||'')+' '+String(track.artist||'')+' '+String(track.album||'')+' '+String(track.name||'')).toLocaleLowerCase().includes(query));
  return fixedOrder?list:sortTracks(list,state.sortMode);
}
function renderTracks(list) {
  if(!list.length) {
    const empty=state.page==='queue'?['Очередь пуста','Запусти трек или добавь композицию следующей.']:
      state.page==='history'?['История пока пуста','Начни воспроизведение — последние 100 композиций появятся здесь.']:
      ['Здесь пока пусто',desktopRuntime?'Добавь аудиофайлы. Они сохранятся в медиатеке после перезапуска.':'Добавь аудиофайлы. Они доступны до закрытия вкладки.'];
    return '<div class="empty-state"><b>'+empty[0]+'</b>'+empty[1]+'<br><br><label class="primary-button file-label">Выбрать аудио<input id="file-input-empty" type="file" accept="'+AUDIO_ACCEPT+'" multiple></label> <button class="secondary-button" data-action="open-link-dialog">Добавить по ссылке</button></div>';
  }
  return '<div class="track-list">'+list.map(track=>{
    const details=[track.artist||'Неизвестный исполнитель',track.album||'',track.duration?formatTime(track.duration):'',
      track.lastPlayedAt?'Прослушан: '+new Date(track.lastPlayedAt).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'}):''].filter(Boolean).join(' · ');
    const actions=[
      track.externalUrl
        ? '<button class="small-button" data-action="open-source" data-id="'+escapeHtml(track.id)+'" aria-label="Открыть музыкальный сайт" title="Открыть музыкальный сайт">↗</button>'
        : '<button class="small-button" data-action="play-track" data-id="'+escapeHtml(track.id)+'" aria-label="Воспроизвести '+escapeHtml(track.title)+'" title="Воспроизвести">▶</button>',
      '<button class="small-button '+(state.favorites.includes(track.id)?'active':'')+'" data-action="favorite" data-id="'+escapeHtml(track.id)+'" aria-label="Избранное" title="Избранное">♥</button>',
      '<button class="small-button" data-action="lyrics-open-track" data-id="'+escapeHtml(track.id)+'" aria-label="Текст песни" title="Текст песни">≡</button>',
      state.page==='queue'?(track.id===state.currentId?'':'<button class="small-button" data-action="queue-remove" data-id="'+escapeHtml(track.id)+'" aria-label="Убрать из очереди" title="Убрать из очереди">−</button>'):
        '<button class="small-button" data-action="queue-next" data-id="'+escapeHtml(track.id)+'" aria-label="Добавить следующим" title="Добавить следующим">↥</button>',
      '<button class="small-button" data-action="edit-track" data-id="'+escapeHtml(track.id)+'" aria-label="Изменить метаданные" title="Изменить метаданные">✎</button>',
      state.page==='playlists'&&state.activePlaylist?
        '<button class="small-button" data-action="remove-playlist-track" data-id="'+escapeHtml(track.id)+'" aria-label="Убрать из плейлиста" title="Убрать из плейлиста">−</button>':
        '<button class="small-button" data-action="add-playlist-track" data-id="'+escapeHtml(track.id)+'" aria-label="Добавить в плейлист" title="Добавить в плейлист">＋</button>',
      desktopRuntime?'<button class="small-button delete-track-button" data-action="delete-track" data-id="'+escapeHtml(track.id)+'" aria-label="Удалить '+escapeHtml(track.title)+' из медиатеки" title="Удалить из медиатеки">×</button>':''
    ].join('');
    const sourceBadge=track.externalUrl?' · Ссылка':track.url?' · Поток':'';
    return '<article class="track-row '+(track.id===state.currentId?'is-playing':'')+'"><div class="track-thumb" aria-hidden="true">♫</div><div class="track-meta"><b>'+escapeHtml(track.title)+'</b><span>'+escapeHtml(details+sourceBadge)+'</span></div><div class="row-actions">'+actions+'</div></article>';
  }).join('')+'</div>';
}
function librarySummary() {
  const count = state.tracks.length;
  const duration = state.tracks.reduce((sum, track) => sum + (Number(track.duration) || 0), 0);
  return `<div class="stats-grid"><div class="stat-card"><strong>${count}</strong><span>Треков в медиатеке</span></div><div class="stat-card"><strong>${state.favorites.length}</strong><span>Избранное</span></div><div class="stat-card"><strong>${formatTime(duration)}</strong><span>Известная длительность</span></div></div>`;
}
function pageContent() {
  if(state.page==='home') {
    const recent=state.search.trim()?visibleTracks():[...state.tracks].slice(-6).reverse();
    return '<section class="hero"><div class="eyebrow">QWEMU MUSIC · DESKTOP EDITION</div><h1>Твоя музыка.<br><span style="color:#ff9868">Твои правила.</span></h1><p>Локальный музыкальный центр: медиатека, плейлисты, история, очередь и настройка звучания. Файлы остаются на этом компьютере.</p><div class="hero-actions"><label class="primary-button file-label">＋ Добавить музыку<input id="file-input-hero" type="file" accept="'+AUDIO_ACCEPT+'" multiple></label><button class="secondary-button" data-action="open-link-dialog">Добавить по ссылке</button><button class="secondary-button" data-page="library">Открыть медиатеку</button><button class="secondary-button" data-page="queue">Очередь воспроизведения</button></div></section>'+librarySummary()+
    '<div class="section-head"><div><h2>Недавно добавленные</h2><p>Треки из локальной медиатеки</p></div><button class="text-button" data-page="library">Вся медиатека →</button></div>'+renderTracks(recent)+
    '<div class="section-head"><div><h2>Недавно прослушано</h2><p>Последние 4 композиции</p></div><button class="text-button" data-page="history">Вся история →</button></div>'+renderTracks(historyTracks(4));
  }
  if(state.page==='library') return '<div class="page-head"><div><div class="eyebrow">YOUR COLLECTION</div><h1 class="page-title">Медиатека</h1><p class="muted">Аудиофайлы и метаданные хранятся локально и доступны после перезапуска.</p></div><div class="queue-toolbar"><label class="primary-button file-label">＋ Добавить файлы<input id="file-input-library" type="file" accept="'+AUDIO_ACCEPT+'" multiple></label><button class="secondary-button" data-action="open-link-dialog">Добавить ссылку</button></div></div><div class="library-toolbar">'+sortControl()+'<span class="muted">'+visibleTracks().length+' треков</span></div>'+renderTracks(visibleTracks());
  if(state.page==='favorites') return '<div class="page-head"><div><div class="eyebrow">YOUR FAVORITES</div><h1 class="page-title">Избранное</h1><p class="muted">Список избранного хранится локально.</p></div></div><div class="library-toolbar">'+sortControl()+'</div>'+renderTracks(visibleTracks());
  if(state.page==='history') return '<div class="page-head"><div><div class="eyebrow">LISTENING HISTORY</div><h1 class="page-title">История прослушивания</h1><p class="muted">Последние 100 уникальных композиций; повтор поднимает трек вверх списка.</p></div><button class="secondary-button" data-action="clear-history">Очистить историю</button></div>'+renderTracks(visibleTracks());
  if(state.page==='queue') {
    const count=state.playbackQueue.filter(id=>id!==state.currentId).length;
    const current=state.tracks.find(track=>track.id===state.currentId);
    return '<div class="page-head"><div><div class="eyebrow">NOW PLAYING · UP NEXT</div><h1 class="page-title">Очередь воспроизведения</h1><p class="muted">Сейчас играет: '+(current?.title?escapeHtml(current.title):'ничего')+' · Далее: '+count+'</p></div><div class="queue-toolbar"><button class="secondary-button '+(state.shuffle?'active':'')+'" data-action="toggle-shuffle" aria-pressed="'+String(state.shuffle)+'">Перемешать</button><button class="secondary-button" data-action="clear-queue">Очистить очередь</button></div></div>'+renderTracks(visibleTracks());
  }
  if(state.page==='playlists') {
    const playlist=state.playlists.find(item=>item.id===state.activePlaylist);
    if(state.activePlaylist&&playlist) return '<div class="page-head"><div><div class="eyebrow">QWEMU PLAYLIST</div><h1 class="page-title">'+escapeHtml(playlist.name)+'</h1><p class="muted">'+playlist.trackIds.length+' треков · локальная подборка</p></div><div class="queue-toolbar"><button class="secondary-button" data-action="back-playlists">← Все плейлисты</button><button class="primary-button" data-action="export-playlist" data-id="'+escapeHtml(playlist.id)+'">Экспорт M3U8</button></div></div>'+renderTracks(visibleTracks());
    return '<div class="page-head"><div><div class="eyebrow">PERSONAL COLLECTIONS</div><h1 class="page-title">Плейлисты</h1><p class="muted">Создавай подборки и переноси их через M3U8.</p></div><div class="queue-toolbar"><label class="secondary-button file-label">Импорт M3U8<input id="m3u-import" type="file" accept=".m3u,.m3u8,audio/x-mpegurl,audio/mpegurl,text/plain"></label><button class="primary-button" data-action="create-playlist">＋ Новый плейлист</button></div></div><div class="playlist-grid">'+state.playlists.map(item=>
      '<article class="playlist-card"><div class="eyebrow">QWEMU PLAYLIST</div><h3>'+escapeHtml(item.name)+'</h3><p>'+item.trackIds.length+' треков · '+escapeHtml(item.description||'Без описания')+'</p><button class="secondary-button" data-action="open-playlist" data-id="'+escapeHtml(item.id)+'">Открыть</button> <button class="small-button" data-action="rename-playlist" data-id="'+escapeHtml(item.id)+'" aria-label="Переименовать">✎</button> <button class="small-button" data-action="export-playlist" data-id="'+escapeHtml(item.id)+'" aria-label="Экспортировать M3U8">⇩</button> <button class="small-button" data-action="delete-playlist" data-id="'+escapeHtml(item.id)+'" aria-label="Удалить">×</button></article>'
    ).join('')+'</div>'+(state.playlists.length?'':'<div class="empty-state"><b>Плейлистов ещё нет</b>Создай подборку или импортируй M3U8.</div>');
  }
  if (state.page === 'settings') {
    if (desktopRuntime) {
      return `<div class="page-head"><div><div class="eyebrow">DESKTOP PREFERENCES</div><h1 class="page-title">Настройки</h1><p class="muted">Параметры приложения сохраняются локально на этом компьютере.</p></div></div>
        <section class="surface"><h2>Внешний вид</h2><div class="form-grid">
          <label>Тема<select id="theme-select">${Object.keys(themes).map(theme=>`<option value="${theme}" ${state.settings.theme===theme?'selected':''}>${({'dark-red':'Тёмная коралловая','orange-night':'Оранжевая ночь',midnight:'Полночная','pure-black':'Абсолютно чёрная',light:'Светлая'}[theme]||theme)}</option>`).join('')}</select></label>
          <label>Громкость по умолчанию<input id="volume-setting" type="range" min="0" max="1" step="0.01" value="${state.settings.volume}"></label>
          <label class="motion-setting"><input id="reduced-motion-setting" type="checkbox" ${state.settings.reducedMotion?'checked':''}> Уменьшить анимации</label>
          <label class="motion-setting"><input id="background-playback-setting" type="checkbox" ${state.settings.backgroundPlayback!==false?'checked':''}> Фоновое воспроизведение</label>
        </div></section>
        <section class="surface" style="margin-top:14px"><h2>Локальная медиатека</h2>
          <p class="muted">Аудиофайлы хранятся в IndexedDB профиля приложения. Они не загружаются в интернет и не отправляются в Cloudflare. Не очищай данные приложения, чтобы не удалить сохранённую коллекцию.</p>
          <p class="muted">Облачная авторизация и синхронизация доступны в отдельной Web Edition.</p>
        </section>
        <section class="surface hotkeys-section" style="margin-top:14px"><h2>Горячие клавиши</h2><div class="hotkey-grid">
          <div class="hotkey-item"><span class="hotkey-keys"><kbd>Пробел</kbd></span><span>Пауза / воспроизведение</span></div>
          <div class="hotkey-item"><span class="hotkey-keys"><kbd>←</kbd><span>+</span><kbd>→</kbd></span><span>Перемотка на 5 секунд</span></div>
          <div class="hotkey-item"><span class="hotkey-keys"><kbd>Ctrl</kbd><span>+</span><kbd>←</kbd> / <kbd>→</kbd></span><span>Предыдущий / следующий трек</span></div>
          <div class="hotkey-item"><span class="hotkey-keys"><kbd>Ctrl</kbd><span>+</span><kbd>K</kbd></span><span>Поиск по медиатеке</span></div>
        </div><p class="muted hotkey-note">M3U8 переносит структуру плейлиста, но не аудиофайлы.</p></section>
        <details class="surface update-details" style="margin-top:14px"><summary>О программе и проверка обновлений</summary><div class="update-body"><p class="muted">QWEMU MUSIC Desktop ${APP_VERSION}. Проверка обновлений выполняется автоматически при запуске. Скачивание установщика — через GitHub Releases.</p><button class="secondary-button" data-action="check-updates">Проверить обновления</button><p id="update-status" class="muted" role="status">${escapeHtml(state.updateStatus)}</p><a class="text-button" href="https://github.com/dimasupercell947-hub/qwemu/releases" target="_blank" rel="noopener noreferrer">Открыть страницу релизов</a></div></details>
        <details class="surface plus-preview" style="margin-top:14px"><summary>QWEMU PLUS — DEMO</summary><div class="plus-body"><p>Демонстрационный экран расширенных функций. Это не реальная подписка и не платный каталог.</p><input id="plus-demo-query" type="search" maxlength="120" placeholder="Демо-поиск: исполнитель или название"><button class="secondary-button" data-action="plus-demo">Запустить демо</button><p id="plus-demo-result" class="muted" role="status"></p></div></details>`;
    }
    const conflictNames={playlists:'Плейлисты',favorites:'Избранное',settings:'Настройки'};
    const conflicts=Object.entries(state.cloudConflicts).map(([key])=>`<article class="surface" style="margin-top:10px"><h3>${conflictNames[key]||key}</h3><p class="muted">Эти данные были изменены на другом устройстве. Выбери, какую версию оставить.</p><button class="secondary-button" data-action="resolve-cloud-remote" data-key="${key}">Использовать облачную</button> <button class="primary-button" data-action="resolve-cloud-local" data-key="${key}">Оставить эту версию</button></article>`).join('');
    return `<div class="page-head"><div><div class="eyebrow">PREFERENCES</div><h1 class="page-title">Настройки</h1><p class="muted">Настройки веб-версии отдельно от Desktop Edition.</p></div></div><section class="surface"><h2>Внешний вид</h2><div class="form-grid"><label>Тема<select id="theme-select">${Object.keys(themes).map(theme=>`<option value="${theme}" ${state.settings.theme===theme?'selected':''}>${({'dark-red':'Тёмная коралловая','orange-night':'Оранжевая ночь',midnight:'Полночная','pure-black':'Абсолютно чёрная',light:'Светлая'}[theme]||theme)}</option>`).join('')}</select></label><label>Громкость по умолчанию<input id="volume-setting" type="range" min="0" max="1" step="0.01" value="${state.settings.volume}"></label><label class="motion-setting"><input id="reduced-motion-setting" type="checkbox" ${state.settings.reducedMotion?'checked':''}> Уменьшить анимации</label></div></section><section class="surface" style="margin-top:14px"><h2>Данные и приватность</h2><p class="muted">Аудиофайлы обрабатываются браузером и не передаются в Cloudflare. При входе синхронизируются только структурированные метаданные аккаунта.</p><button class="secondary-button" data-action="sync">Синхронизировать метаданные</button></section>${conflicts?'<section class="surface" style="margin-top:14px"><h2>Конфликты синхронизации</h2><p class="muted">Локальные изменения сохранены и не перезаписаны автоматически.</p>'+conflicts+'</section>':''}`;
  }
  if (state.page === 'profile') return `<div class="page-head"><div><div class="eyebrow">ACCOUNT</div><h1 class="page-title">Профиль</h1></div></div>${state.user ? `<section class="surface"><h2>${escapeHtml(state.user.displayName)}</h2><p class="muted">@${escapeHtml(state.user.username)} · ${escapeHtml(state.user.email||'Почта не указана')}</p><form id="profile-edit-form" class="form-grid"><label>Отображаемое имя<input name="displayName" required minlength="2" maxlength="32" value="${escapeHtml(state.user.displayName)}"></label><label>Email<input name="email" type="email" maxlength="160" value="${escapeHtml(state.user.email||'')}"></label><button class="primary-button" type="submit">Сохранить профиль</button></form><button class="secondary-button" data-action="logout">Выйти</button></section>` : `<div class="empty-state"><b>Ты используешь локальный режим</b>Войди в аккаунт, чтобы сохранять плейлисты и настройки в веб-версии.<br><br><button class="primary-button" data-action="open-auth">Войти или зарегистрироваться</button></div>`}`;
  return '';
}
function render() {
  $('#view').innerHTML = pageContent();
  document.querySelectorAll('[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === state.page));
  if (desktopRuntime) {
    $('#account-button').textContent = 'Локальный режим';
    $('#account-button').disabled = true;
    $('#account-button').title = 'Облачная авторизация доступна в Web Edition.';
    $('#account-button').setAttribute('aria-label', 'Локальный режим');
  } else {
    $('#account-button').textContent = state.user ? state.user.displayName : 'Войти';
    $('#account-button').disabled = false;
    $('#account-button').setAttribute('aria-label', state.user ? 'Открыть профиль' : 'Войти в аккаунт');
  }
  const current = state.tracks.find(track => track.id === state.currentId);
  $('#player-title').textContent = current?.title || 'Ничего не воспроизводится';
  $('#player-artist').textContent = current?.artist || 'Добавь аудиофайлы из своей коллекции';
  $('#cover').textContent = '';
  $('#cover').style.backgroundImage = "url('./assets/logo.svg')";
  $('#play').innerHTML = audio.getStatus().playing ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM15 5h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  $('#play').classList.toggle('playing',audio.getStatus().playing);
  const repeatLabels={off:'Повтор выключен',all:'Повтор плейлиста',one:'Повтор текущего трека'};
  $('#repeat').classList.toggle('active',state.repeatMode!=='off');$('#repeat').dataset.mode=state.repeatMode;$('#repeat').title=repeatLabels[state.repeatMode];$('#repeat').setAttribute('aria-label',repeatLabels[state.repeatMode]);$('#repeat').innerHTML=state.repeatMode==='one'?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8a8 8 0 1 1 2 9"/><path d="M4 4v4h4M12 7v6l4 2"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8a8 8 0 1 1 2 9"/><path d="M4 4v4h4"/></svg>';
  $('#shuffle').classList.toggle('active',state.shuffle);$('#shuffle').setAttribute('aria-pressed',String(state.shuffle));$('#shuffle').setAttribute('aria-label',state.shuffle?'Выключить перемешивание':'Включить перемешивание');$('#shuffle').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h2.5a4 4 0 0 1 3.2 1.6l6.6 9.8A4 4 0 0 0 18.5 18H21m-4-4 4 4-4 4M3 19h2.5a4 4 0 0 0 3.2-1.6l2-3M14 7l1.3-1.4A4 4 0 0 1 18.5 5H21m-4-4 4 4-4 4"/></svg>';
  $('#play').setAttribute('aria-label', audio.getStatus().playing ? 'Пауза' : 'Воспроизвести');
  renderLyricsPanel();updateMediaSession(current);
}
function setPage(page) {
  if (!['home','library','playlists','favorites','queue','history','settings','profile'].includes(page)) return;
  state.page = page; render();
}
function persistCloud(key, value) {
  const userId=state.user?.id;
  if(!userId||state.authTransition)return Promise.resolve(false);
  let snapshot;
  try { snapshot=JSON.parse(JSON.stringify(value)); }
  catch(error) { toast(`Не удалось подготовить облачные данные: ${error.message}`); return Promise.resolve(false); }

  const pending=readCloudPending();
  const queuedAt=Date.now()*1000+(++state.pendingSequence%1000);
  pending[key]={value:snapshot,baseUpdatedAt:state.cloudVersions[key]??null,queuedAt};
  try { storage.write(localKey('pendingCloud'),pending); }
  catch(error) { toast(`Не удалось сохранить очередь синхронизации: ${error.message}`); return Promise.resolve(false); }

  let attempted=null;
  return cloudWrites.enqueue(`${userId}:${key}`,async()=>{
    if(state.user?.id!==userId||state.authTransition)return false;
    const latest=readCloudPending()[key];
    if(!latest)return true;
    attempted=latest;
    const expectedUpdatedAt=state.cloudVersions[key]??latest.baseUpdatedAt??null;
    const result=await api.request(`/api/${key}`,{
      method:'PUT',
      headers:auth.csrfHeaders(),
      body:{value:latest.value,expectedUpdatedAt}
    });
    state.cloudVersions[key]=result.updatedAt;
    if(readCloudPending()[key]?.queuedAt===latest.queuedAt)clearCloudPending(key);
    delete state.cloudConflicts[key];
    state.cloudReady=true;
    return true;
  }).catch(error=>{
    if(error.status===409) {
      const current=error.payload?.current||{};
      state.cloudConflicts[key]={
        localValue:attempted?.value??snapshot,
        remoteValue:current.value??(key==='settings'?{}:[]),
        remoteUpdatedAt:current.updatedAt??null
      };
      if(state.page==='settings')render();
      toast('Облачные данные изменились на другом устройстве. Выбери версию в настройках.');
    } else {
      toast(`Изменения сохранены локально и ожидают синхронизации: ${error.message}`);
    }
    return false;
  });
}
function resolveCloudConflict(key,choice) {
  const conflict=state.cloudConflicts[key];
  if(!conflict)return;
  state.cloudVersions[key]=conflict.remoteUpdatedAt;
  if(choice==='remote') {
    state[key]=normalizeCloudValue(key,conflict.remoteValue);
    clearCloudPending(key);
    writeLocal(key,state[key]);
    delete state.cloudConflicts[key];
    applyTheme();
    render();
    toast('Использована облачная версия.');
    return;
  }
  const localValue=normalizeCloudValue(key,conflict.localValue);
  state[key]=localValue;
  delete state.cloudConflicts[key];
  writeLocal(key,state[key]);
  render();
  persistCloud(key,localValue).then(ok=>toast(ok?'Локальная версия отправлена в облако.':'Локальная версия сохранена; синхронизация ожидает повторной попытки.'));
}
async function loadCloud() {
  const userId=state.user?.id;
  if(!userId||state.authTransition)return;
  await cloudWrites.drain();
  if(state.user?.id!==userId||state.authTransition)return;
  const requestId=++state.cloudLoadId;
  try {
    const [playlists,favorites,settings]=await Promise.all(['playlists','favorites','settings'].map(key=>api.request(`/api/${key}`)));
    if(requestId!==state.cloudLoadId||state.user?.id!==userId||state.authTransition)return;
    const remote={playlists,favorites,settings};
    const pending=readCloudPending();
    const retry=[];
    const initialUpload=[];
    for(const key of ['playlists','favorites','settings']) {
      const row=remote[key];
      const remoteVersion=row.updatedAt??null;
      const remoteValue=normalizeCloudValue(key,row.value);
      state.cloudVersions[key]=remoteVersion;
      const localPending=pending[key];
      if(localPending) {
        state[key]=normalizeCloudValue(key,localPending.value);
        if((localPending.baseUpdatedAt??null)===remoteVersion) {
          delete state.cloudConflicts[key];
          retry.push(key);
        } else {
          state.cloudConflicts[key]={localValue:state[key],remoteValue,remoteUpdatedAt:remoteVersion};
        }
      } else if(remoteVersion!==null) {
        // The server is authoritative: removed items must not reappear from stale local snapshots.
        state[key]=remoteValue;
        delete state.cloudConflicts[key];
      } else {
        // First sync for a new account: preserve the user's local-only metadata.
        const initial=state.bootstrapData?.[key]??state[key];
        state[key]=normalizeCloudValue(key,initial);
        initialUpload.push(key);
      }
    }
    state.bootstrapData=null;
    saveLocal();
    state.cloudReady=true;
    applyTheme();
    render();
    for(const key of [...retry,...initialUpload])persistCloud(key,state[key]);
    if(Object.keys(state.cloudConflicts).length)toast('Обнаружен конфликт синхронизации. Проверь раздел «Настройки».');
  } catch(error) {
    if(requestId===state.cloudLoadId&&state.user?.id===userId&&!state.authTransition) {
      toast(`Аккаунт доступен, но метаданные не загружены: ${error.message}`);
    }
  }
}
async function restoreDesktopLibrary() {
  const records = await libraryStore.list();
  state.tracks = records.filter(track => track && typeof track.id === 'string' && typeof track.name === 'string' && typeof track.title === 'string' && Number.isFinite(Number(track.size)));
  render();
  if (state.tracks.length) toast('Медиатека восстановлена: ' + state.tracks.length + ' треков.');
}

async function addFiles(fileList) {
  if (desktopRuntime && !libraryReady) await libraryRestorePromise;
  const selected = [...(fileList || [])].filter(file => file instanceof File && supportsAudioFile(file));
  if (selected.length > 500) { toast('За один импорт можно добавить не более 500 файлов.'); return; }
  if (!selected.length) { toast('Не найдено поддерживаемых аудиофайлов.'); return; }
  const files=selected.filter(file=>file.size>0 && file.size<=512*1024*1024);
  const alreadyUsed=state.tracks.reduce((sum,track)=>sum+(Number(track.size)||0),0);
  const remainingBytes=Math.max(0,2*1024*1024*1024-alreadyUsed);
  let plannedBytes=0;
  const boundedFiles=files.filter(file=>{if(plannedBytes+file.size>remainingBytes)return false;plannedBytes+=file.size;return true;});
  const rejected=selected.length-boundedFiles.length;
  if (rejected) toast(`Пропущено файлов из-за пустого файла или ограничений размера (512 МиБ на файл, 2 ГиБ на медиатеку): ${rejected}.`);
  if (state.tracks.length + boundedFiles.length > 5000) { toast(desktopRuntime ? 'Лимит Desktop Edition — 5000 треков в медиатеке.' : 'Лимит Web Edition — 5000 треков в одной сессии.'); return; }
  let added = 0;
  const existing=new Set(state.tracks.map(track=>track.id));
  for (const file of boundedFiles) {
    let id;
    try { id = await fingerprintFile(file); }
    catch (error) { toast(error?.message || 'Не удалось проверить аудиофайл.'); return; }
    if (existing.has(id)) continue;
    const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g,' ').trim() || file.name;
    const track = { id, name: file.name, title, artist: 'Неизвестный исполнитель', album: 'Локальный файл', lyrics: '', size: file.size, lastModified: file.lastModified, duration: 0, addedAt: Date.now() };
    if (!desktopRuntime) track.file = file.slice(0, file.size, file.type);
    if (desktopRuntime) {
      try { await libraryStore.put(track, file.slice(0, file.size, file.type)); }
      catch (error) { toast('Не удалось сохранить «' + file.name + '»: ' + (error?.message || error)); continue; }
    }
    state.tracks.push(track);
    existing.add(id); added++;
  }
  render(); toast(added ? (desktopRuntime ? `Добавлено файлов: ${added}. Они сохранены в медиатеке.` : `Добавлено файлов: ${added}. Они остаются в этой вкладке.`) : 'Выбранные файлы уже добавлены.');
}
function getPlaybackQueue() {
  const playable=state.tracks.filter(track=>!track.externalUrl);
  if(state.page==='queue')return state.playbackQueue.filter(id=>playable.some(track=>track.id===id));
  if(state.page==='history')return visibleTracks().filter(track=>!track.externalUrl).map(track=>track.id);
  return buildPlaybackQueue({page:state.page,activePlaylist:state.activePlaylist,playlists:state.playlists,tracks:playable,favorites:state.favorites.filter(id=>playable.some(track=>track.id===id)),search:state.search});
}

async function playTrack(id, queueIds = null) {
  const selected=state.tracks.find(track=>track.id===id);
  if(selected?.externalUrl){openMusicSource(selected.externalUrl);return;}
  const available=new Set(state.tracks.filter(track=>!track.externalUrl).map(track=>track.id));
  const requested=Array.isArray(queueIds)?queueIds:getPlaybackQueue();
  const unique=[...new Set(requested.filter(trackId=>available.has(trackId)))];
  if(!unique.includes(id))unique.unshift(id);
  if(state.shuffle&&!Array.isArray(queueIds)) {
    if(state.page!=='queue') state.shuffleBackup=[...unique];
    state.playbackQueue=shuffleQueue(unique,id);
  } else {
    state.playbackQueue=unique;
  }
  state.playbackIndex=state.playbackQueue.indexOf(id);
  const track=state.tracks.find(item=>item.id===id);if(!track)return;
  const requestId=++state.playRequestId;
  try {
    const playable=desktopRuntime&&!track.url?{...track,file:await libraryStore.getFile(id)}:track;
    if(desktopRuntime&&!track.url&&!(playable.file instanceof Blob))throw new Error('Аудиофайл отсутствует в медиатеке. Импортируй его повторно.');
    if(track.externalUrl)throw new Error('Это сохранённая ссылка на музыкальный сайт. Открой источник для прослушивания.');
    await audio.play(playable);
    if(requestId!==state.playRequestId)return;
    state.currentId=id;state.lyricsTrackId=id;state.playHistory=recordPlay(state.playHistory,id);writeLocal('play-history',state.playHistory);render();
  }catch(error){
    if(requestId!==state.playRequestId)return;
    audio.stop();state.currentId=null;render();toast('Не удалось воспроизвести "'+track.title+'": '+(error.message||'проверь формат файла'));
  }
}
function stopPlayback(){state.playRequestId+=1;audio.stop();state.currentId=null;render();}
function advance(direction) {
  const available=new Set(state.tracks.filter(track=>!track.externalUrl).map(track=>track.id));
  const queue=state.playbackQueue.filter(id=>available.has(id));
  if(!queue.length){const initial=getPlaybackQueue();if(!initial.length)return;playTrack(initial[direction>0?0:initial.length-1],initial);return;}
  const next=getNextQueueIndex(queue,state.currentId,direction,state.repeatMode);
  if(next<0){state.playbackQueue=queue;state.currentId=null;audio.stop();render();return;}
  playTrack(queue[next],queue);
}
function previousTrack(){if(audio.getStatus().position>3){audio.seek(0);return;}advance(-1);}
function toggleRepeat(){
  const modes=['off','all','one'];state.repeatMode=modes[(modes.indexOf(state.repeatMode)+1)%modes.length];
  audio.setRepeat(state.repeatMode==='one');render();
  toast(state.repeatMode==='off'?'Повтор выключен.':state.repeatMode==='all'?'Повтор очереди включён.':'Повтор текущего трека включён.');
}
function toggleShuffle(){
  state.shuffle=!state.shuffle;
  if(state.shuffle){state.shuffleBackup=[...state.playbackQueue];state.playbackQueue=shuffleQueue(state.playbackQueue,state.currentId);}
  else{
    const backup=state.shuffleBackup.filter(id=>state.tracks.some(track=>track.id===id));
    const base=backup.length?backup:(state.page==='queue'?state.playbackQueue:getPlaybackQueue());
    state.playbackQueue=state.currentId&&base.includes(state.currentId)?[state.currentId,...base.filter(id=>id!==state.currentId)]:[...base];
    state.shuffleBackup=[];
  }
  state.playbackIndex=state.playbackQueue.indexOf(state.currentId);render();toast(state.shuffle?'Перемешивание включено.':'Исходный порядок восстановлен.');
}
function queueTrackNext(id){
  const selected=state.tracks.find(track=>track.id===id);
  if(!selected)return;
  if(selected.externalUrl){toast('Внешние музыкальные сайты сохраняются как закладки и не добавляются в очередь.');return;}
  if(id===state.currentId){toast('Этот трек уже воспроизводится.');return;}
  const queue=state.playbackQueue.filter(trackId=>state.tracks.some(track=>track.id===trackId));
  if(state.currentId&&!queue.includes(state.currentId))queue.unshift(state.currentId);
  const without=queue.filter(trackId=>trackId!==id);
  if(!state.currentId){
    const initial=[id,...without];
    if(state.shuffle){state.shuffleBackup=[...initial];playTrack(id,shuffleQueue(initial,id));}
    else playTrack(id,initial);
    return;
  }
  const at=without.indexOf(state.currentId);without.splice(at<0?0:at+1,0,id);
  state.playbackQueue=without;
  if(state.shuffle){
    const backup=state.shuffleBackup.filter(trackId=>trackId!==id&&state.tracks.some(track=>track.id===trackId));
    const backupAt=backup.indexOf(state.currentId);
    backup.splice(backupAt<0?0:backupAt+1,0,id);
    state.shuffleBackup=backup;
  }
  state.playbackIndex=state.playbackQueue.indexOf(state.currentId);render();toast('Трек добавлен следующим в очередь.');
}
function removeQueuedTrack(id){
  if(id===state.currentId){toast('Текущий трек нельзя убрать из очереди до остановки.');return;}
  state.playbackQueue=state.playbackQueue.filter(trackId=>trackId!==id);
  state.shuffleBackup=state.shuffleBackup.filter(trackId=>trackId!==id);
  state.playbackIndex=state.playbackQueue.indexOf(state.currentId);render();
}
function clearPlaybackQueue(){
  state.playbackQueue=state.currentId?[state.currentId]:[];state.shuffleBackup=[];state.playbackIndex=state.currentId?0:-1;render();toast('Очередь очищена. Текущий трек оставлен.');
}
function toggleFavorite(id) {
  state.favorites = state.favorites.includes(id) ? state.favorites.filter(value => value !== id) : [...state.favorites, id].slice(0,5000);
  writeLocal('favorites', state.favorites); persistCloud('favorites', state.favorites); render();
}
function createPlaylist() {
  const name = prompt('Название плейлиста:'); if (!name) return;
  const clean = name.trim().slice(0,60); if (!clean) return;
  if (state.playlists.length >= 300) { toast('Достигнут лимит в 300 плейлистов.'); return; }
  const playlist = { id: uid(), name: clean, description: '', trackIds: [] };
  state.playlists.push(playlist); writeLocal('playlists', state.playlists); persistCloud('playlists', state.playlists); render(); toast('Плейлист создан.');
}
function renamePlaylist(id) {
  const playlist=state.playlists.find(item=>item.id===id);if(!playlist)return;
  const name=prompt('Новое название плейлиста:',playlist.name);if(name===null)return;
  const clean=name.trim().slice(0,60);if(!clean){toast('Название не может быть пустым.');return;}
  playlist.name=clean;writeLocal('playlists',state.playlists);persistCloud('playlists',state.playlists);render();toast('Плейлист переименован.');
}
function deletePlaylist(id) {
  const playlist=state.playlists.find(item=>item.id===id);if(!playlist)return;
  if(!confirm(`Удалить плейлист «${playlist.name}»? Аудиофайлы останутся в медиатеке.`))return;
  state.playlists=state.playlists.filter(item=>item.id!==id);if(state.activePlaylist===id)state.activePlaylist=null;
  writeLocal('playlists',state.playlists);persistCloud('playlists',state.playlists);render();toast('Плейлист удалён.');
}
function addTrackToPlaylist(trackId) {
  if(!state.playlists.length){toast('Сначала создай плейлист.');return;}
  const options=state.playlists.map((item,index)=>`${index+1}. ${item.name}`).join('\n');
  const answer=prompt(`В какой плейлист добавить трек? Введи номер:\n${options}`);if(answer===null)return;
  const index=Number(answer)-1;const playlist=Number.isInteger(index)?state.playlists[index]:null;
  if(!playlist){toast('Номер плейлиста не распознан.');return;}
  if(!playlist.trackIds.includes(trackId))playlist.trackIds.push(trackId);
  writeLocal('playlists',state.playlists);persistCloud('playlists',state.playlists);render();toast('Трек добавлен в плейлист.');
}
function removeTrackFromPlaylist(trackId) {
  const playlist=state.playlists.find(item=>item.id===state.activePlaylist);if(!playlist)return;
  playlist.trackIds=playlist.trackIds.filter(id=>id!==trackId);writeLocal('playlists',state.playlists);persistCloud('playlists',state.playlists);render();toast('Трек убран из плейлиста.');
}

async function deleteLibraryTrack(id) {
  const track = state.tracks.find(item => item.id === id);
  if (!track || !desktopRuntime) return;
  if (!confirm(`Удалить «${track.title}» из медиатеки? Файл будет удалён из локального хранилища.`)) return;
  try {
    await libraryStore.remove(id);
    if (state.currentId === id) stopPlayback();
    state.tracks = state.tracks.filter(item => item.id !== id);
    state.favorites = state.favorites.filter(item => item !== id);
    state.playlists = state.playlists.map(playlist => ({ ...playlist, trackIds: playlist.trackIds.filter(trackId => trackId !== id) }));
    state.playbackQueue = state.playbackQueue.filter(trackId => trackId !== id);
    state.playHistory = state.playHistory.filter(entry => entry.trackId !== id);
    state.shuffleBackup = state.shuffleBackup.filter(trackId => trackId !== id);
    state.playbackIndex = state.playbackQueue.indexOf(state.currentId);
    writeLocal('favorites', state.favorites);
    writeLocal('playlists', state.playlists);
    writeLocal('play-history', state.playHistory);
    render();
    toast(`Трек «${track.title}» удалён. Место в медиатеке освобождено.`);
  } catch (error) {
    toast(`Не удалось удалить трек: ${error?.message || error}`);
  }
}

function editTrack(id){
  const track=state.tracks.find(item=>item.id===id);if(!track)return;
  $('#track-id').value=track.id;$('#track-title').value=track.title||'';$('#track-artist').value=track.artist||'';$('#track-album').value=track.album||'';$('#track-lyrics').value=track.lyrics||'';$('#lyrics-file').value='';$('#track-error').textContent='';$('#track-dialog').showModal();
}
async function saveTrackMetadata(event){
  event.preventDefault();const id=$('#track-id').value,track=state.tracks.find(item=>item.id===id);
  if(!track){$('#track-error').textContent='Трек больше не найден в медиатеке.';return;}
  const title=$('#track-title').value.trim().slice(0,160),artist=$('#track-artist').value.trim().slice(0,120),album=$('#track-album').value.trim().slice(0,120),lyrics=normalizeLyrics($('#track-lyrics').value);
  if(!title){$('#track-error').textContent='Укажи название композиции.';return;}
  const previous={title:track.title,artist:track.artist,album:track.album,lyrics:track.lyrics||''};Object.assign(track,{title,artist,album,lyrics});
  try{if(desktopRuntime)await libraryStore.updateMetadata(track);$('#track-dialog').close();render();toast(desktopRuntime?'Метаданные сохранены в локальной медиатеке.':'Метаданные изменены до закрытия вкладки.');}
  catch(error){Object.assign(track,previous);$('#track-error').textContent=error.message||'Не удалось сохранить метаданные.';}
}

function openLinkDialog(){
  $('#link-url').value='';$('#link-title').value='';$('#link-artist').value='';
  $('#link-result').textContent='Вставь HTTPS-ссылку на аудиофайл или музыкальный сайт.';
  $('#link-dialog').showModal();
}
function previewMusicLink(){
  const result=classifyMusicUrl($('#link-url').value);
  const node=$('#link-result');
  if(!node)return;
  node.textContent=result.ok?(result.kind==='direct-audio'?'Распознана прямая аудиоссылка ('+result.extension.toUpperCase()+'). Можно добавить поток в библиотеку.':'Распознан музыкальный сайт '+result.hostname+'. Сохраним ссылку-закладку; скачивание не выполняется.'):(result.reason||'Введите ссылку.');
}
async function addMusicLink(){
  const classified=classifyMusicUrl($('#link-url').value);
  if(!classified.ok){$('#link-result').textContent=classified.reason;return;}
  if(state.tracks.length>=5000){toast('Достигнут лимит 5000 записей.');return;}
  const title=$('#link-title').value.trim().slice(0,160)||titleFromMusicUrl(classified.url);
  const artist=$('#link-artist').value.trim().slice(0,120)||'Неизвестный исполнитель';
  const id='link-'+uid();
  const track={id,name:title,title,artist,album:'Добавлено по ссылке',lyrics:'',size:0,lastModified:0,duration:0,addedAt:Date.now()};
  if(classified.kind==='direct-audio')track.url=classified.url;
  else track.externalUrl=classified.url;
  try{
    if(desktopRuntime)await libraryStore.putLink(track);
    state.tracks.push(track);
    $('#link-dialog').close();render();
    toast(classified.kind==='direct-audio'?'Ссылка добавлена в медиатеку. Доступность потока зависит от сайта.':'Музыкальная ссылка сохранена в медиатеке как закладка.');
  }catch(error){$('#link-result').textContent='Не удалось сохранить ссылку: '+(error.message||error);}
}
function showPlusDemo(){
  const query=$('#plus-demo-query')?.value.trim();
  const node=$('#plus-demo-result');
  if(!node)return;
  node.textContent=query?('QWEMU PLUS — DEMO: демонстрационный поиск по запросу «'+query.slice(0,120)+'». Реальный каталог не подключён; добавляй музыку через проверенную ссылку или локальный файл.'):'Введите запрос, чтобы показать демонстрационный экран поиска.';
}
function openMusicSource(url){
  const classified=classifyMusicUrl(url);
  if(!classified.ok||classified.kind!=='music-site'){toast('Ссылка не прошла проверку.');return;}
  const opened=window.open(classified.url,'_blank','noopener,noreferrer');
  if(!opened){navigator.clipboard?.writeText(classified.url).then(()=>toast('Ссылка скопирована в буфер обмена.')).catch(()=>toast('Открытие заблокировано; ссылка сохранена в записи.'));}
}
async function importLyricsFile(file){
  if(!(file instanceof File)||file.size>100000){toast('Текст песни должен быть TXT/LRC и не превышать 100 КБ.');return;}
  try{$('#track-lyrics').value=normalizeLyrics(await file.text());toast('Текст загружен в редактор. Нажми «Сохранить» для прикрепления.');}
  catch(error){toast('Не удалось прочитать текст: '+(error.message||error));}
}
function renderLyricsPanel(){
  const panel=$('#lyrics-panel');if(!panel)return;
  panel.hidden=!state.lyricsOpen;
  if(!state.lyricsOpen)return;
  const track=state.tracks.find(item=>item.id===(state.lyricsTrackId||state.currentId));
  $('#lyrics-title').textContent=track?.title||'Текст песни';
  $('#lyrics-artist').textContent=track?.artist||'';
  const body=$('#lyrics-content');
  if(!track?.lyrics){body.innerHTML='<div class="lyrics-empty">Текст ещё не прикреплён.<br><button class="secondary-button" data-action="lyrics-open-track" data-id="'+escapeHtml(track?.id||'')+'">Добавить текст</button></div>';return;}
  state.activeLyric=-1;
  const parsed=parseLyrics(track.lyrics);
  if(!parsed.lines.length){body.textContent='Текст пуст.';return;}
  body.innerHTML=parsed.lines.map((line,index)=>{
    const seconds=line.time===null?'':' data-seconds="'+line.time+'"';
    const clickable=line.time===null?'':' data-action="seek-lyrics"';
    return '<div class="lyric-line '+(index===state.activeLyric?'active':'')+'" data-lyric-index="'+index+'"><button type="button"'+clickable+seconds+'>'+escapeHtml(line.text)+'</button></div>';
  }).join('');
  syncLyricsHighlight(state.lyricsTrackId===state.currentId?audio.getStatus().position:0);
}
function syncLyricsHighlight(position){
  if(!state.lyricsOpen)return;
  const track=state.tracks.find(item=>item.id===(state.lyricsTrackId||state.currentId));
  const parsed=parseLyrics(track?.lyrics||'');
  if(!parsed.synced)return;
  const active=activeLyricIndex(parsed.lines,position);
  if(active===state.activeLyric)return;
  state.activeLyric=active;
  const content=$('#lyrics-content');
  content?.querySelectorAll('[data-lyric-index]').forEach(node=>node.classList.toggle('active',Number(node.dataset.lyricIndex)===active));
  const current=content?.querySelector('[data-lyric-index="'+active+'"]');
  if(current&&typeof current.scrollIntoView==='function')current.scrollIntoView({block:'center',behavior:state.settings.reducedMotion?'auto':'smooth'});
}
function updateMediaSession(track){
  if(!('mediaSession' in navigator))return;
  try{
    if(track&&'MediaMetadata' in window)navigator.mediaSession.metadata=new MediaMetadata({title:track.title||'QWEMU MUSIC',artist:track.artist||'',album:track.album||'QWEMU MUSIC',artwork:[{src:'./assets/logo.svg',sizes:'512x512',type:'image/svg+xml'}]});
    navigator.mediaSession.playbackState=audio.getStatus().playing?'playing':'paused';
    const status=audio.getStatus();
    if(status.duration>0&&Number.isFinite(status.position))navigator.mediaSession.setPositionState({duration:status.duration,position:Math.min(status.duration,status.position),playbackRate:$('#audio').playbackRate||1});
  }catch{}
}
function installMediaSessionHandlers(){
  if(!('mediaSession' in navigator))return;
  const handlers={
    play:()=>{if(state.currentId)audio.resume().catch(error=>toast(error.message));else{const queue=getPlaybackQueue();if(queue.length)playTrack(queue[0],queue);}},
    pause:()=>audio.pause(),
    nexttrack:()=>advance(1),
    previoustrack:()=>previousTrack(),
    seekto:details=>{if(Number.isFinite(details.seekTime))audio.seek(details.seekTime);},
    seekbackward:details=>audio.seek(Math.max(0,audio.getStatus().position-(details.seekOffset||10))),
    seekforward:details=>audio.seek(Math.min(audio.getStatus().duration,audio.getStatus().position+(details.seekOffset||10)))
  };
  for(const [action,handler] of Object.entries(handlers))try{navigator.mediaSession.setActionHandler(action,handler);}catch{}
}
function compareVersions(left,right){
  const a=String(left).match(/\d+(?:\.\d+){1,3}/)?.[0].split('.').map(Number)||[0];
  const b=String(right).match(/\d+(?:\.\d+){1,3}/)?.[0].split('.').map(Number)||[0];
  for(let i=0;i<Math.max(a.length,b.length);i++){const diff=(a[i]||0)-(b[i]||0);if(diff)return Math.sign(diff);}
  return 0;
}
function parseRemoteVersion(value){
  const version=String(value||'').replace(/^v/i,'');
  if(!/^\d+(?:\.\d+){1,3}$/.test(version))throw new Error('Некорректный номер версии');
  return version;
}
async function fetchUpdateDocument(url){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),6500);
  try{
    const response=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('HTTP '+response.status);
    return await response.json();
  }finally{clearTimeout(timeout);}
}
function showUpdateNotice(version){
  let notice=$('#update-notice');
  if(!notice){
    notice=document.createElement('aside');notice.id='update-notice';notice.className='update-notice';notice.setAttribute('role','status');
    const copy=document.createElement('div');copy.className='update-notice-copy';
    const title=document.createElement('strong');title.className='update-notice-title';
    const description=document.createElement('span');description.className='update-notice-description';
    copy.append(title,description);
    const actions=document.createElement('div');actions.className='update-notice-actions';
    const download=document.createElement('a');download.className='update-notice-download';download.href=RELEASES_URL;download.target='_blank';download.rel='noopener noreferrer';download.textContent='Скачать';
    const dismiss=document.createElement('button');dismiss.className='update-notice-dismiss';dismiss.type='button';dismiss.dataset.action='dismiss-update';dismiss.setAttribute('aria-label','Скрыть уведомление об обновлении');dismiss.textContent='×';
    actions.append(download,dismiss);notice.append(copy,actions);document.body.append(notice);
  }
  notice.querySelector('.update-notice-title').textContent='Доступно обновление '+version;
  notice.querySelector('.update-notice-description').textContent='Новая версия QWEMU MUSIC Desktop опубликована на GitHub.';
}
async function checkForUpdates(options={}){
  const status=$('#update-status');
  if(status)status.textContent='Проверяем опубликованную версию…';
  state.updateStatus='Проверяем опубликованную версию…';
  try{
    const checks=await Promise.allSettled([
      fetchUpdateDocument(UPDATE_MANIFEST_URL+'?cache='+Date.now()).then(data=>({version:parseRemoteVersion(data.version),source:'резервный манифест'})),
      fetchUpdateDocument('https://api.github.com/repos/dimasupercell947-hub/qwemu/releases/latest').then(data=>({version:parseRemoteVersion(data.tag_name),source:'GitHub Releases'}))
    ]);
    const candidates=checks.filter(result=>result.status==='fulfilled').map(result=>result.value);
    if(!candidates.length){
      const details=checks.map(result=>result.status==='rejected'?(result.reason?.message||'ошибка сети'):'').filter(Boolean).join('; ');
      throw new Error('GitHub не ответил через основной и резервный каналы. '+details);
    }
    candidates.sort((a,b)=>compareVersions(b.version,a.version));
    const latest=candidates[0],comparison=compareVersions(latest.version,APP_VERSION);
    if(comparison>0){
      state.updateStatus='Доступно обновление '+latest.version+'. Нажми «Скачать», чтобы открыть установщики на GitHub.';
      showUpdateNotice(latest.version);
    }else{
      $('#update-notice')?.remove();
      state.updateStatus=comparison===0?'Установлена актуальная версия '+APP_VERSION+'. Проверено: '+latest.source+'.':'Установлена версия '+APP_VERSION+', новее опубликованной '+latest.version+'.';
    }
    if(status)status.textContent=state.updateStatus;
    return {available:comparison>0,version:latest.version};
  }catch(error){
    state.updateStatus='Не удалось проверить обновления: '+(error?.message||error);
    if(status)status.textContent=state.updateStatus;
    return {available:false,error};
  }
}
function exportPlaylist(id){
  const playlist=state.playlists.find(item=>item.id===id);if(!playlist)return;
  try{
    const blob=new Blob([exportPlaylistM3u(playlist,state.tracks)],{type:'audio/x-mpegurl;charset=utf-8'});
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');
    const safe=playlist.name.replace(/[<>:"\/\\|?*\x00-\x1F]/g,'-').replace(/\s+/g,' ').trim().slice(0,60)||'QWEMU-Playlist';
    anchor.href=url;anchor.download=safe+'.m3u8';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('Плейлист экспортирован в M3U8. Аудиофайлы в экспорт не входят.');
  }catch(error){toast('Не удалось экспортировать плейлист: '+(error.message||error));}
}
async function importPlaylistFile(file){
  if(!(file instanceof File)||file.size>2*1024*1024){toast('Файл плейлиста пуст или превышает лимит 2 МиБ.');return;}
  if(state.playlists.length>=300){toast('Достигнут лимит в 300 плейлистов.');return;}
  try{
    const parsed=parsePlaylistM3u(await file.text(),state.tracks);
    if(!parsed.trackIds.length){toast('В плейлисте не найдено композиций из текущей медиатеки. Сначала добавь исходные аудиофайлы.');return;}
    const fallback=file.name.replace(/\.(m3u8?)$/i,'').trim();
    state.playlists.push({id:uid(),name:(parsed.name||fallback||'Импортированный плейлист').slice(0,60),description:'Импортировано из M3U8',trackIds:parsed.trackIds});
    writeLocal('playlists',state.playlists);persistCloud('playlists',state.playlists);state.page='playlists';state.activePlaylist=null;render();
    toast('Импортировано треков: '+parsed.trackIds.length+(parsed.unmatched?'. Не найдено в медиатеке: '+parsed.unmatched:'')+'.');
  }catch(error){toast('Не удалось импортировать M3U8: '+(error.message||error));}
}
function clearHistory(){
  if(!state.playHistory.length){toast('История уже пуста.');return;}
  if(!confirm('Очистить историю прослушивания? Медиатека и плейлисты не изменятся.'))return;
  state.playHistory=[];writeLocal('play-history',state.playHistory);render();toast('История прослушивания очищена.');
}
async function submitAuth(event) {
  event.preventDefault(); const errorNode = $('#auth-error'); errorNode.textContent = '';
  const username = $('#auth-username').value.trim(); const password = $('#auth-password').value;
  try {
    const localBootstrap={favorites:[...state.favorites],playlists:JSON.parse(JSON.stringify(state.playlists)),settings:{...state.settings}};
    if (state.authMode === 'register') {
      const displayName = $('#auth-display').value.trim(); const email = $('#auth-email').value.trim();
      state.user = await auth.register({ username, displayName, email, password });
      state.bootstrapData=localBootstrap;
    } else {
      state.user = await auth.login(username, password);
      state.bootstrapData=null;
    }
    state.cloudLoadId += 1;
    loadScopedLocal(); applyTheme();
    $('#auth-dialog').close(); $('#auth-form').reset(); render(); await loadCloud(); toast(`Добро пожаловать, ${state.user.displayName}.`);
  } catch (error) { errorNode.textContent = error.message; }
}
function setAuthMode(mode) {
  state.authMode = mode; const register = mode === 'register';
  $('#auth-heading').textContent = register ? 'Создание аккаунта' : 'Вход в QWEMU';
  $('#display-label').classList.toggle('hidden', !register); $('#email-label').classList.toggle('hidden', !register);
  $('#auth-display').required = register; $('#auth-password').autocomplete = register ? 'new-password' : 'current-password';
  $('#auth-submit').textContent = register ? 'Создать аккаунт' : 'Войти';
  $('#auth-switch').textContent = register ? 'Уже есть аккаунт? Войти' : 'Создать аккаунт';
  $('#auth-switch').dataset.action = register ? 'switch-login' : 'switch-register';
  $('#auth-error').textContent = '';
}
function openAuth() { setAuthMode('login'); $('#auth-dialog').showModal(); }

document.addEventListener('click', async event => {
  const page = event.target.closest('[data-page]'); if (page) { setPage(page.dataset.page); return; }
  const action = event.target.closest('[data-action]'); if (!action) return;
  const { action: name, id, key } = action.dataset;
  if (name === 'play-track') await playTrack(id);
  else if (name === 'open-link-dialog') openLinkDialog();
  else if (name === 'close-link') $('#link-dialog').close();
  else if (name === 'plus-demo-link') { const q=$('#plus-link-query').value.trim();$('#plus-link-result').textContent=q?'QWEMU PLUS DEMO: демонстрационный запрос «'+q.slice(0,120)+'»; реальный каталог не подключён.':'Введите запрос.'; }
  else if (name === 'link-preview') previewMusicLink();
  else if (name === 'add-link') await addMusicLink();
  else if (name === 'plus-demo') showPlusDemo();
  else if (name === 'check-updates') await checkForUpdates();
  else if (name === 'dismiss-update') $('#update-notice')?.remove();
  else if (name === 'lyrics') { state.lyricsOpen=!state.lyricsOpen;state.lyricsTrackId=state.currentId;renderLyricsPanel(); }
  else if (name === 'lyrics-open-track') { const track=state.tracks.find(item=>item.id===id);if(track){state.lyricsTrackId=id;state.lyricsOpen=true;renderLyricsPanel();} }
  else if (name === 'lyrics-close') { state.lyricsOpen=false;state.lyricsTrackId=null;state.activeLyric=-1;renderLyricsPanel(); }
  else if (name === 'seek-lyrics') { const seconds=Number(action.dataset.seconds);if(Number.isFinite(seconds))audio.seek(seconds); }
  else if (name === 'open-source') { const track=state.tracks.find(item=>item.id===id);if(track?.externalUrl)openMusicSource(track.externalUrl); }
  else if (name === 'queue-next') queueTrackNext(id);
  else if (name === 'queue-remove') removeQueuedTrack(id);
  else if (name === 'edit-track') editTrack(id);
  else if (name === 'export-playlist') exportPlaylist(id);
  else if (name === 'toggle-shuffle') toggleShuffle();
  else if (name === 'clear-queue') clearPlaybackQueue();
  else if (name === 'clear-history') clearHistory();
  else if (name === 'close-track') $('#track-dialog').close();
  else if (name === 'delete-track') await deleteLibraryTrack(id);
  else if (name === 'favorite') toggleFavorite(id);
  else if (name === 'create-playlist') createPlaylist();
  else if (name === 'rename-playlist') renamePlaylist(id);
  else if (name === 'delete-playlist') deletePlaylist(id);
  else if (name === 'add-playlist-track') addTrackToPlaylist(id);
  else if (name === 'remove-playlist-track') removeTrackFromPlaylist(id);
  else if (name === 'open-playlist') { state.activePlaylist = id; render(); }
  else if (name === 'back-playlists') { state.activePlaylist = null; render(); }
  else if (name === 'open-auth') openAuth();
  else if (name === 'close-auth') $('#auth-dialog').close();
  else if (name === 'switch-register') setAuthMode('register');
  else if (name === 'switch-login') setAuthMode('login');
  else if (name === 'logout') {
    state.authTransition = true;
    state.cloudLoadId += 1;
    try {
      await cloudWrites.drain();
      await auth.logout();
      state.user = null; state.cloudReady = false; loadScopedLocal(); applyTheme(); render(); toast('Выход выполнен.');
    } catch (error) { toast(error.message); }
    finally { state.authTransition = false; }
  }
  else if (name === 'sync') { await loadCloud(); toast(state.cloudReady ? 'Проверка синхронизации завершена.' : 'Синхронизация пока недоступна.'); }
  else if (name === 'resolve-cloud-local') resolveCloudConflict(key,'local');
  else if (name === 'resolve-cloud-remote') resolveCloudConflict(key,'remote');
  else if (name === 'repeat') toggleRepeat();
});
document.addEventListener('change', event => {
  if (event.target.id === 'm3u-import') { const file=event.target.files?.[0]; if(file)importPlaylistFile(file); event.target.value=''; return; }
  if (event.target.id === 'sort-select') { state.sortMode=Object.hasOwn(TRACK_SORT_MODES,event.target.value)?event.target.value:'added-desc';writeLocal('sort-mode',state.sortMode);render();return; }
  if (event.target.id === 'lyrics-file') { importLyricsFile(event.target.files?.[0]); event.target.value=''; return; }
  if (event.target.matches('input[type="file"]')) { addFiles(event.target.files); event.target.value = ''; }
  if (event.target.id === 'theme-select') { state.settingsRevision += 1; state.settings.theme = validThemes.includes(event.target.value)?event.target.value:'dark-red'; applyTheme(); saveLocal(); persistCloud('settings', state.settings); }
  if (event.target.id === 'volume-setting') { state.settingsRevision += 1; state.settings.volume = Number(event.target.value); $('#volume').value = String(state.settings.volume); audio.setVolume(state.settings.volume); saveLocal(); persistCloud('settings', state.settings); }
  if (event.target.id === 'reduced-motion-setting') { state.settingsRevision += 1; state.settings.reducedMotion = event.target.checked; applyTheme(); saveLocal(); persistCloud('settings', state.settings); }
  if (event.target.id === 'background-playback-setting') { state.settingsRevision += 1; state.settings.backgroundPlayback = event.target.checked; saveLocal(); persistCloud('settings', state.settings); toast(event.target.checked?'Фоновое воспроизведение включено.':'При скрытии окна музыка будет ставиться на паузу.'); }
});
$('#auth-form').addEventListener('submit', submitAuth);
$('#track-form').addEventListener('submit', saveTrackMetadata);
$('#link-form').addEventListener('submit',async event=>{event.preventDefault();await addMusicLink();});
$('#link-url').addEventListener('input',previewMusicLink);
document.addEventListener('submit', async event => {
  if(event.target.id!=='profile-edit-form')return;event.preventDefault();
  const form=new FormData(event.target);try{state.user=await auth.updateProfile({displayName:String(form.get('displayName')||'').trim(),email:String(form.get('email')||'').trim()});render();toast('Профиль сохранён.');}
  catch(error){toast(`Не удалось сохранить профиль: ${error.message}`);}
});
$('#account-button').addEventListener('click', () => {
  if (desktopRuntime) return;
  setPage(state.user ? 'profile' : (openAuth(), state.page));
});
$('#search').addEventListener('input', event => { state.search = event.target.value; render(); const input=$('#search'); input.focus(); input.setSelectionRange(input.value.length,input.value.length); });
$('#lyrics-toggle').addEventListener('click',()=>{state.lyricsOpen=!state.lyricsOpen;state.lyricsTrackId=state.currentId;renderLyricsPanel();});
$('#repeat').addEventListener('click', toggleRepeat);
$('#shuffle').addEventListener('click', toggleShuffle);
$('#play').addEventListener('click', async () => { if (!state.currentId) { const queue=getPlaybackQueue(); if (queue.length) await playTrack(queue[0],queue); return; } if (audio.getStatus().playing) audio.pause(); else await audio.resume().catch(error=>toast(error.message)); render(); });
$('#prev').addEventListener('click', previousTrack); $('#next').addEventListener('click', () => advance(1));
$('#seek').addEventListener('input', event => { const duration=audio.getStatus().duration; if(duration>0)audio.seek(duration*Number(event.target.value)/1000); });
$('#volume').value=String(state.settings.volume); audio.setVolume($('#volume').value);
$('#volume').addEventListener('input', event => { audio.setVolume(event.target.value); state.settings.volume=Number(event.target.value); state.settingsRevision += 1; saveLocal(); });
$('#volume').addEventListener('change', () => persistCloud('settings', state.settings));
$('#mute').addEventListener('click', () => { const muted=!$('#audio').muted; $('#audio').muted=muted; $('#mute').innerHTML=muted?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4zM17 9l4 6m0-6-4 6"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4zM16 9a5 5 0 0 1 0 6M19 6a9 9 0 0 1 0 12"/></svg>'; $('#mute').setAttribute('aria-label',muted?'Включить звук':'Отключить звук'); });
audio.on('timeupdate', () => { const status=audio.getStatus(); $('#seek').value=String(status.duration?status.position/status.duration*1000:0); $('#elapsed').textContent=formatTime(status.position); $('#duration').textContent=formatTime(status.duration);syncLyricsHighlight(status.position);updateMediaSession(state.tracks.find(track=>track.id===state.currentId)); });
audio.on('loadedmetadata', () => { const track=state.tracks.find(item=>item.id===state.currentId); if(track)track.duration=audio.getStatus().duration; render(); });
audio.on('play', render); audio.on('pause', render);
audio.on('ended', () => { if (state.repeatMode !== 'one') advance(1); });
audio.on('error', () => toast('Браузер не смог декодировать этот файл. Попробуй другой формат.'));
document.addEventListener('keydown', event => {
  const target=event.target;
  const editing=target instanceof HTMLElement&&(target.isContentEditable||target.matches('input,textarea,select')||Boolean(target.closest('dialog[open],button,a,[role="button"],[role="link"]')));
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('#search').focus();return;}
  if(event.key==='Escape'){if($('#auth-dialog').open)$('#auth-dialog').close();if($('#track-dialog').open)$('#track-dialog').close();return;}
  if(editing||event.altKey)return;
  if(event.code==='Space'){
    event.preventDefault();
    if(!state.currentId){const q=getPlaybackQueue();if(q.length)playTrack(q[0],q);}
    else if(audio.getStatus().playing){audio.pause();render();}
    else audio.resume().then(render).catch(error=>toast(error.message));
    return;
  }
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();
    if(event.ctrlKey||event.metaKey){if(event.key==='ArrowLeft')previousTrack();else advance(1);}
    else if(state.currentId){const status=audio.getStatus();audio.seek(status.position+(event.key==='ArrowLeft'?-5:5));}
  }
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&!state.settings.backgroundPlayback){audio.pause();render();}
  if(!document.hidden&&audio.getStatus().playing)document.dispatchEvent(new Event('qwemu-foreground'));
});
installMediaSessionHandlers();
window.addEventListener('pagehide', () => { state.playRequestId += 1; audio.destroy(); }, { once: true });

applyTheme(); render();
const versionLabel=$('#app-version-label');if(versionLabel)versionLabel.textContent=APP_VERSION;
void checkForUpdates({silent:true});
if (desktopRuntime) {
  libraryRestorePromise = restoreDesktopLibrary()
    .catch(error => { toast('Не удалось восстановить медиатеку: ' + (error?.message || error)); })
    .finally(() => { libraryReady = true; render(); });
} else {
  const initialAuthGeneration = state.cloudLoadId;
  auth.restore().then(async user => {
    if (initialAuthGeneration !== state.cloudLoadId || state.authTransition) return;
    state.user=user; if(user)loadScopedLocal(); applyTheme(); render(); if(user)await loadCloud();
  }).catch(error => {
    if (initialAuthGeneration === state.cloudLoadId && !state.authTransition) toast(`Облачный сервис недоступен. Локальный режим продолжает работать: ${error.message}`);
  });
}
