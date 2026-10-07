import test from 'node:test';
import assert from 'node:assert/strict';
import {storedMidiFile,fileDigest} from '../js/import-memory.js';
test('saved MIDI descriptors read only the selected song and report missing storage',async()=>{
 let reads=0;
 const file=new File(['abc'],'song.mid');
 const lazy=storedMidiFile({id:'one',file},async(store,id)=>{reads++;assert.equal(store,'songs');assert.equal(id,'one');return {file};});
 assert.equal(reads,0);assert.equal(lazy.size,3);assert.equal(lazy.name,'song.mid');
 assert.equal(new TextDecoder().decode(await lazy.arrayBuffer()),'abc');assert.equal(reads,1);
 await assert.rejects(storedMidiFile({id:'gone',file},async()=>null).arrayBuffer(),/Add this file again/);
});
test('duplicate fingerprints depend on contents rather than filename or archive',async()=>{
 assert.equal(await fileDigest(new File(['abc'],'a.mid')),await fileDigest(new File(['abc'],'b.kar')));
 assert.notEqual(await fileDigest(new File(['abc'],'a.mid')),await fileDigest(new File(['abd'],'a.mid')));
});
