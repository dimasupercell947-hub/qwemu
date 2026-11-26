import test from "node:test";
import assert from "node:assert/strict";
import { TRACK_SORT_MODES, sortTracks } from "../public/assets/track-sort.js";
const tracks=[{id:"b",title:"Beta",artist:"Zed",duration:100,addedAt:20},{id:"a",title:"Alpha 10",artist:"Mia",duration:240,addedAt:10},{id:"c",title:"Alpha 2",artist:"Adam",duration:160,addedAt:30}];
test("sorts by date, title, artist and duration without mutating source",()=>{
 const original=tracks.map(t=>t.id);
 assert.deepEqual(sortTracks(tracks).map(t=>t.id),["c","b","a"]);
 assert.deepEqual(sortTracks(tracks,"title-asc").map(t=>t.id),["c","a","b"]);
 assert.deepEqual(sortTracks(tracks,"artist-asc").map(t=>t.id),["c","a","b"]);
 assert.deepEqual(sortTracks(tracks,"duration-desc").map(t=>t.id),["a","c","b"]);
 assert.deepEqual(tracks.map(t=>t.id),original);
});
test("invalid modes fall back to recent-first",()=>{
 assert.deepEqual(sortTracks(tracks,"bad").map(t=>t.id),["c","b","a"]);
 assert.deepEqual(Object.keys(TRACK_SORT_MODES),["added-desc","title-asc","artist-asc","duration-desc"]);
});
