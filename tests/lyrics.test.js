import test from 'node:test';
import assert from 'node:assert/strict';
import {lyricPresentation,lyricFill,lyricIndex} from '../js/lyrics.js';
import {readMidi} from '../js/midi-loader.js';
const lines=[{time:10,text:'One',words:[{time:10,text:'O'},{time:11,text:'ne'}]},{time:13,text:'Two'},{time:16,text:'Three'}];
test('intro and countdown follow first lyric timing; seek restores correct lyric page',()=>{
 assert.equal(lyricPresentation(lines,4).countdown,0);
 assert.equal(lyricPresentation(lines,5).countdown,5);
 assert.equal(lyricPresentation(lines,9.1).countdown,1);
 assert.equal(lyricPresentation(lines,10).intro,false);
 assert.equal(lyricPresentation(lines,14).start,0);
 assert.equal(lyricPresentation(lines,17).start,2);
 assert.equal(lyricPresentation(lines,6).start,0);
 assert.equal(lyricIndex(lines,13),1);
 assert.equal(lyricPresentation([{time:0}],-5).countdown,5);
});
test('syllables sweep progressively and final syllables finish before long breaks',()=>{
 assert.equal(lyricFill(lines[0],0,9,13,30),0);
 assert.equal(lyricFill(lines[0],0,10.5,13,30),.5);
 assert.equal(lyricFill(lines[0],0,11,13,30),1);
 assert.equal(lyricFill(lines[0],1,15,40,50),1);
 assert.equal(lyricFill(lines[1],0,14.5,16,30),.5);
});
test('MIDI reader times out stuck files and cancels stale selections',async()=>{
 await assert.rejects(readMidi({arrayBuffer:()=>new Promise(()=>{})},{},{timeout:5}),/too long/);
 const controller=new AbortController();let terminated=0;
 const promise=readMidi({arrayBuffer:async()=>new ArrayBuffer(2)},{},{signal:controller.signal,workerFactory:()=>({postMessage(){},terminate(){terminated++;}})});
 await Promise.resolve();controller.abort();await assert.rejects(promise,{name:'AbortError'});assert.equal(terminated,1);
});
test('MIDI reader returns worker results and releases the worker',async()=>{
 let worker,terminated=0;
 const result=readMidi({arrayBuffer:async()=>new ArrayBuffer(2)},{},{workerFactory:()=>worker={postMessage(){queueMicrotask(()=>worker.onmessage({data:{song:{duration:5}}}));},terminate(){terminated++;}}});
 assert.equal((await result).duration,5);assert.equal(terminated,1);
});
