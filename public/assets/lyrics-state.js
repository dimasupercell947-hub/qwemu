export const LYRICS_MAX_LENGTH = 100_000;
export const LYRICS_MAX_LINES = 3_000;
export function normalizeLyrics(value){return String(value??'').replace(/\r\n?/g,'\n').slice(0,LYRICS_MAX_LENGTH);}
export function parseLyrics(value){
 const source=normalizeLyrics(value),rawLines=source.split('\n').slice(0,LYRICS_MAX_LINES),lines=[];let order=0;
 const timestamp=/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;
 for(const raw of rawLines){const line=raw.trim();if(!line||/^\[(?:ar|al|ti|by|re|ve|offset|length|la|tool):/i.test(line))continue;
  const stamps=[...line.matchAll(timestamp)];
  if(stamps.length){const text=line.replace(timestamp,'').trim();for(const stamp of stamps){const minutes=Number(stamp[1]),seconds=Number(stamp[2]),fraction=stamp[3]?Number('0.'+stamp[3]):0;if(seconds>=60||!Number.isFinite(minutes)||!Number.isFinite(seconds))continue;lines.push({time:minutes*60+seconds+fraction,text,order:order++});}}
  else if(!line.startsWith('['))lines.push({time:null,text:raw.trim(),order:order++});
 }
 const synced=lines.some(line=>line.time!==null);if(synced)lines.sort((a,b)=>(a.time??Infinity)-(b.time??Infinity)||a.order-b.order);
 return {lines:lines.map(({time,text})=>({time,text})),synced};
}
export function activeLyricIndex(lines,position){if(!Array.isArray(lines)||!Number.isFinite(position)||position<0)return -1;let active=-1;for(let i=0;i<lines.length;i++){if(lines[i]?.time===null||!Number.isFinite(lines[i]?.time))continue;if(lines[i].time>position)break;active=i;}return active;}
