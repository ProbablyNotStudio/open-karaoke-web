import test from 'node:test';
import assert from 'node:assert/strict';
import {cachedSoundFont} from '../js/font-cache.js';
const bytes=()=>{const result=new ArrayBuffer(12),view=new DataView(result);new Uint8Array(result).set([82,73,70,70,4,0,0,0,115,102,98,107]);return result;};
const font=()=>({id:'default',url:'https://example.com/default.sf2',bytes:12});
test('switching back and refreshing reuse a complete saved font even after worker transfer',async()=>{
 const records=new Map();let downloads=0;
 const deps={read:async id=>records.get(id),write:async record=>records.set(record.id,record),download:async()=>{downloads++;return bytes();}};
 const entry=font(),first=await cachedSoundFont(entry,deps);
 structuredClone(first,{transfer:[first]});assert.equal(first.byteLength,0);
 assert.equal((await cachedSoundFont(entry,deps)).byteLength,12);
 assert.equal((await cachedSoundFont(font(),deps)).byteLength,12);
 assert.equal(downloads,1);
 records.clear();await cachedSoundFont(font(),deps);assert.equal(downloads,2);
});
test('changed or corrupt saved fonts redownload; failed downloads never enter cache',async()=>{
 for(const record of [{url:'https://example.com/old.sf2',bytes:12,file:new Blob([bytes()])},{url:font().url,bytes:12,file:new Blob(['broken'])}]){
  let downloads=0;await cachedSoundFont(font(),{read:async()=>record,write:async()=>{},download:async()=>{downloads++;return bytes();}});assert.equal(downloads,1);
 }
 let saves=0;const entry=font();await assert.rejects(cachedSoundFont(entry,{read:async()=>null,write:async()=>{saves++;},download:async()=>{throw Error('Canceled');}}),/Canceled/);
 assert.equal(saves,0);assert.equal(entry.cachedFile,undefined);
});
test('full browser storage still reuses the download for the session',async()=>{
 let downloads=0,warning=0;const entry=font();const deps={read:async()=>{throw Error('Unavailable');},write:async()=>{throw Error('Full');},download:async()=>{downloads++;return bytes();},onSaveFailure:()=>warning++};
 await cachedSoundFont(entry,deps);await cachedSoundFont(entry,deps);assert.equal(downloads,1);assert.equal(warning,1);
});
