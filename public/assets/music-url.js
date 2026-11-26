const MUSIC_HOSTS=['music.youtube.com','youtube.com','youtu.be','open.spotify.com','spotify.com','music.apple.com','soundcloud.com','bandcamp.com','deezer.com','tidal.com','audiomack.com','mixcloud.com','music.amazon.com','qobuz.com','last.fm'];
export const DIRECT_AUDIO_EXTENSIONS=new Set(['mp3','wav','flac','ogg','oga','m4a','aac','opus','webm','mp4','3gp','m4b']);
function isPublicHostname(host){const value=host.toLowerCase().replace(/^\[|\]$/g,'');if(!value||value==='localhost'||value.endsWith('.localhost')||value.endsWith('.local')||value.endsWith('.internal')||value.endsWith('.lan'))return false;if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)||value.includes(':'))return false;return value.includes('.');}
function isMusicHost(host){return MUSIC_HOSTS.some(domain=>host===domain||host.endsWith('.'+domain));}
export function classifyMusicUrl(input){let url;try{url=new URL(String(input??'').trim());}catch{return{ok:false,kind:'invalid',reason:'Некорректная ссылка.'};}
 if(url.protocol!=='https:')return{ok:false,kind:'invalid',reason:'Разрешены только HTTPS-ссылки.'};
 if(url.username||url.password||url.port&&url.port!=='443')return{ok:false,kind:'invalid',reason:'Ссылка содержит данные входа или нестандартный порт.'};
 if(!isPublicHostname(url.hostname))return{ok:false,kind:'invalid',reason:'Локальные адреса не принимаются.'};
 url.hash='';const ext=url.pathname.split('.').pop()?.toLowerCase()||'';
 if(DIRECT_AUDIO_EXTENSIONS.has(ext))return{ok:true,kind:'direct-audio',url:url.href,hostname:url.hostname,extension:ext};
 if(isMusicHost(url.hostname))return{ok:true,kind:'music-site',url:url.href,hostname:url.hostname,extension:''};
 return{ok:false,kind:'invalid',reason:'Это не распознанный музыкальный сайт и не прямой аудиофайл.'};
}
export function titleFromMusicUrl(value){try{const url=new URL(value);const tail=decodeURIComponent(url.pathname.split('/').filter(Boolean).pop()||'');const cleaned=tail.replace(/\.(mp3|wav|flac|ogg|oga|m4a|aac|opus|webm|mp4|3gp|m4b)$/i,'').replace(/[-_]+/g,' ').trim();return cleaned||url.hostname.replace(/^www\./,'');}catch{return'Музыка по ссылке';}}
