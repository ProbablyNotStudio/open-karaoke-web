import test from 'node:test';
import assert from 'node:assert/strict';
import {storedMidiFile,storedFile,fileBlob,fileDigest} from '../js/import-memory.js';
test('saved MIDI descriptors read only the selected song and report missing storage',async()=>{
 let reads=0;
 const file=new File(['abc'],'song.mid');
 const lazy=storedMidiFile({id:'one',file},async(store,id)=>{reads++;assert.equal(store,'songs');assert.equal(id,'one');return {file};});
 assert.equal(reads,0);assert.equal(lazy.size,3);assert.equal(lazy.name,'song.mid');
 assert.equal(new TextDecoder().decode(await lazy.arrayBuffer()),'abc');assert.equal(reads,1);
 await assert.rejects(storedMidiFile({id:'gone',file},async()=>null).arrayBuffer(),/Add this file again/);
});
test('saved audio, companions and backgrounds stay lazy and preserve Blob playback',async()=>{
 let reads=0;const file=new File(['[00:01]Hello'],'song.lrc');
 const lazy=storedFile({id:'background:one',file},async(store,id)=>{reads++;assert.equal(store,'backgrounds');assert.equal(id,'background:one');return {file};},'backgrounds');
 assert.equal(reads,0);assert.equal(Object.values(lazy).some(value=>value instanceof Blob),false);
 assert.equal(await lazy.text(),'[00:01]Hello');assert.equal(reads,1);
 assert.equal(await fileBlob(lazy),file);assert.equal(reads,2);
 assert.equal(await fileBlob(file),file);assert.equal(reads,2);
});
test('duplicate fingerprints depend on contents rather than filename or archive',async()=>{
 assert.equal(await fileDigest(new File(['abc'],'a.mid')),await fileDigest(new File(['abc'],'b.kar')));
 assert.notEqual(await fileDigest(new File(['abc'],'a.mid')),await fileDigest(new File(['abd'],'a.mid')));
});
