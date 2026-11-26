import test from "node:test";
import assert from "node:assert/strict";
import { exportPlaylistM3u, parsePlaylistM3u } from "../public/assets/playlist-io.js";
const tracks=[{id:"track-a",name:"one song.mp3",title:"One Song",artist:"Artist A",duration:125},{id:"track-b",name:"two.ogg",title:"Second",artist:"Artist B",duration:0}];
test("exports M3U8 with stable internal identifiers and unique tracks",()=>{
 const value=exportPlaylistM3u({name:"My Mix",trackIds:["track-a","missing","track-b","track-a"]},tracks);
 assert.match(value,/^#EXTM3U\r\n#PLAYLIST:My Mix/);
 assert.match(value,/#QWEMU-ID:track-a/);
 assert.match(value,/#EXTINF:125,Artist A - One Song/);
 assert.equal((value.match(/#QWEMU-ID:/g)||[]).length,2);
});
test("imports stable identifiers and matches existing local filenames",()=>{
 const value=parsePlaylistM3u("#EXTM3U\r\n#PLAYLIST:Imported Mix\r\n#EXTINF:125,Artist A - One Song\r\n#QWEMU-ID:track-a\r\none song.mp3\r\n#EXTINF:-1,Artist B - Second\r\ntwo.ogg\r\n",tracks);
 assert.equal(value.name,"Imported Mix");
 assert.deepEqual(value.trackIds,["track-a","track-b"]);
 assert.equal(value.unmatched,0);
});
test("unknown paths are ignored and duplicates do not duplicate track IDs",()=>{
 const value=parsePlaylistM3u("#EXTM3U\nC:/Music/private.mp3\none song.mp3\none song.mp3\n",tracks);
 assert.deepEqual(value.trackIds,["track-a"]);
 assert.equal(value.unmatched,1);
});
test("rejects malformed and oversized playlist input",()=>{
 assert.throws(()=>parsePlaylistM3u("not m3u",tracks),TypeError);
 assert.throws(()=>parsePlaylistM3u("x".repeat(2*1024*1024+1),tracks),RangeError);
 assert.throws(()=>exportPlaylistM3u(null,tracks),TypeError);
});
