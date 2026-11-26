import test from "node:test";
import assert from "node:assert/strict";
import { HISTORY_LIMIT, normalizePlayHistory, recordPlay, resolveHistoryTracks } from "../public/assets/history-state.js";
test("history drops invalid rows, de-duplicates IDs and keeps latest timestamp", () => {
  assert.deepEqual(normalizePlayHistory([{trackId:"a",playedAt:10},{trackId:"b",playedAt:30},{trackId:"a",playedAt:20},{trackId:"",playedAt:50},{trackId:"bad",playedAt:Infinity},null]), [{trackId:"b",playedAt:30},{trackId:"a",playedAt:20}]);
});
test("recordPlay moves an item to top and rejects invalid inputs", () => {
  const source=[{trackId:"a",playedAt:10},{trackId:"b",playedAt:5}];
  assert.deepEqual(recordPlay(source,"b",25),[{trackId:"b",playedAt:25},{trackId:"a",playedAt:10}]);
  assert.deepEqual(recordPlay(source,"",30),normalizePlayHistory(source));
  assert.deepEqual(recordPlay(source,"c",NaN),normalizePlayHistory(source));
});
test("history is capped and only resolves tracks still in the library", () => {
  const rows=Array.from({length:HISTORY_LIMIT+20},(_,i)=>({trackId:"t"+i,playedAt:i+1}));
  assert.equal(normalizePlayHistory(rows).length,HISTORY_LIMIT);
  const found=resolveHistoryTracks([{trackId:"gone",playedAt:20},{trackId:"ok",playedAt:10}],[{id:"ok",title:"Available"}]);
  assert.equal(found.length,1);
  assert.equal(found[0].track.title,"Available");
});
