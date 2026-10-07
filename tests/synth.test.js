import {test} from 'node:test';import assert from 'node:assert/strict';import {MidiSynth} from '../js/synth.js';
test('rapid seeking and tempo changes preserve pending playback',async()=>{
 const synth=new MidiSynth();let resume;const waiting=new Promise(resolve=>resume=resolve);synth.init=()=>waiting;
 synth.context={currentTime:10};synth.load({duration:10,notes:[]});const playing=synth.play();
 synth.seek(2);synth.seek(4);synth.configure({rate:1.1});resume();await playing;await Promise.resolve();
 assert.equal(synth.playing,true);assert.equal(synth.position,4);assert.equal(synth.rate,1.1);synth.pause();
});
test('stop cancels a pending browser audio resume',async()=>{
 const synth=new MidiSynth();let resume;const waiting=new Promise(resolve=>resume=resolve);synth.init=()=>waiting;
 synth.context={currentTime:10};synth.load({duration:5,notes:[]});const playing=synth.play();synth.stop();resume();await playing;
 assert.equal(synth.playing,false);assert.equal(synth.position,0);assert.equal(synth.timer,undefined);
});
test('seek resumes notes still sounding but excludes finished notes',async()=>{
 const synth=new MidiSynth(),scheduled=[];synth.context={currentTime:10};synth.init=async()=>{};
 synth.voice=(note,start,duration)=>scheduled.push({pitch:note.pitch,start,duration});
 synth.load({duration:5,notes:[{time:0,end:1,pitch:60,ch:0},{time:1,end:3,pitch:64,ch:0},{time:2.1,end:3,pitch:67,ch:0}]});
 synth.seek(2);synth.rate=2;await synth.play();synth.pause();
 assert.equal(scheduled.length,2);assert.equal(scheduled[0].pitch,64);assert.equal(scheduled[0].start,10);assert.equal(scheduled[0].duration,.5);assert.equal(scheduled[1].start,10.05);
});
