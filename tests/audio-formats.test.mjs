import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_FORMATS, AUDIO_EXTENSIONS, AUDIO_ACCEPT, audioFileExtension, supportsAudioFile, canPlayFormat } from '../public/assets/audio-formats.js';

test('whitelist includes new codecs and container extensions',()=>{
 for(const ext of ['mp3','wav','flac','ogg','oga','m4a','aac','opus','webm','mp4','3gp','m4b'])assert.ok(AUDIO_EXTENSIONS.includes(ext));
 assert.ok(AUDIO_ACCEPT.includes('.opus')&&AUDIO_ACCEPT.includes('.webm')&&AUDIO_ACCEPT.includes('.m4b'));
});
test('extension helper is case-insensitive and rejects unsupported files',()=>{
 assert.equal(audioFileExtension('Track.OPUS'),'opus');
 assert.equal(supportsAudioFile({name:'Track.OPUS'}),true);
 assert.equal(supportsAudioFile({name:'track.exe'}),false);
 assert.equal(supportsAudioFile(null),false);
});
test('codec support probe uses canPlayType without throwing',()=>{
 const audio={canPlayType:mime=>mime==='audio/mpeg'?'probably':''};
 assert.equal(canPlayFormat(audio,'mp3'),true);
 assert.equal(canPlayFormat(audio,'opus'),false);
 assert.equal(canPlayFormat(null,'mp3'),false);
 assert.equal(canPlayFormat(audio,'unsupported'),false);
 assert.ok(AUDIO_FORMATS.length>=10);
});
