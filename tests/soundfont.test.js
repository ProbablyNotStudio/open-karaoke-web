import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateSoundFont,validateSoundFontHeader,downloadSoundFont,MAX_SOUNDFONT_BYTES} from '../js/soundfonts.js';
import {SoundFontSynth} from '../js/soundfont-synth.js';
const font=()=>{const buffer=new ArrayBuffer(12),bytes=new Uint8Array(buffer);bytes.set(new TextEncoder().encode('RIFF'));new DataView(buffer).setUint32(4,4,true);bytes.set(new TextEncoder().encode('sfbk'),8);return buffer;};
test('SoundFont validation rejects wrong format, mismatched size and oversized banks',()=>{
 assert.equal(validateSoundFont(font()).byteLength,12);
 assert.throws(()=>validateSoundFont(new ArrayBuffer(12)));assert.throws(()=>validateSoundFontHeader(font(),100));assert.throws(()=>validateSoundFontHeader(font(),MAX_SOUNDFONT_BYTES+1));
});
test('SoundFont header accepts the 1 GB boundary and rejects one byte above it',()=>{
 assert.equal(MAX_SOUNDFONT_BYTES,1024*1024*1024);
 const header=font();new DataView(header).setUint32(4,MAX_SOUNDFONT_BYTES-8,true);
 assert.equal(validateSoundFontHeader(header,MAX_SOUNDFONT_BYTES),header);
 assert.throws(()=>validateSoundFontHeader(header,MAX_SOUNDFONT_BYTES+1),/1 GB/);
});
test('SoundFont download reports progress and rejects missing, oversized or truncated data',async()=>{
 const entry={url:'https://fonts.example/a.sf2',bytes:12},progress=[];
 const buffer=await downloadSoundFont(entry,{fetcher:async()=>new Response(font()),onProgress:v=>progress.push(v)});assert.equal(buffer.byteLength,12);assert.deepEqual(progress,[1]);
 await assert.rejects(downloadSoundFont(entry,{fetcher:async()=>new Response('missing',{status:404})}));
 await assert.rejects(downloadSoundFont(entry,{fetcher:async()=>new Response(new Uint8Array(13))}));
 await assert.rejects(downloadSoundFont(entry,{fetcher:async()=>new Response(new Uint8Array(11))}));
 await assert.rejects(downloadSoundFont({...entry,url:'http://fonts.example/a.sf2'}));
});
const handler=()=>{const events=new Map();return {addEvent:(type,id,callback)=>events.set(type+id,callback),removeEvent:(type,id)=>events.delete(type+id),fire:(type,value)=>{for(const [key,callback] of [...events])if(key.startsWith(type))callback(value);}};};
function mockEngine({delayed=false,invalid=false}={}){
 const events=handler(),engine={destroyed:false,destroy(){this.destroyed=true;}};
 engine.synth={eventHandler:handler(),connect(){},stopAll(){},soundBankManager:{addSoundBank:async()=>{if(invalid)throw Error('Bad bank');}},midiChannels:Array.from({length:16},()=>({parameters:{},setSystemParameter(key,value){this.parameters[key]=value;}}))};
 engine.seq={eventHandler:events,currentHighResolutionTime:3,currentTime:0,plays:0,pause(){},play(){this.plays++;},loadNewSongList(){if(!delayed)queueMicrotask(()=>events.fire('songChange'));}};return engine;
}
const readyPlayer=engine=>{const player=new SoundFontSynth(async()=>engine);player.context={currentTime:10,resume:async()=>{}};player.master={};return player;};
test('switching from a sampled bank to enhanced synth destroys the bank and resumes at the same position',async()=>{
 const engine=mockEngine(),player=readyPlayer(engine);player.context.createPeriodicWave=()=>({});
 await player.setSoundFont(font(),{id:'sampled'});player.load({duration:10,buffer:font(),notes:[]});await player.play();
 await player.setSoundFont(null,{id:'builtin-enhanced',name:'Enhanced synth'});
 assert.equal(engine.destroyed,true);assert.equal(player.engine,null);assert.equal(player.profile,'builtin-enhanced');
 assert.equal(player.position,3);assert.equal(player.playing,true);player.stop();
});
test('SoundFont switch preserves playback position, transpose, tempo and melody mute',async()=>{
 const engine=mockEngine(),player=readyPlayer(engine);player.load({duration:10,notes:[],buffer:font()});player.position=3;player.rate=1.1;player.key=2;player.mutedChannel=4;await player.play();
 await player.setSoundFont(font(),{id:'sampled',name:'Sampled'});
 assert.equal(player.playing,true);assert.equal(engine.seq.currentTime,3);assert.equal(engine.seq.playbackRate,1.1);assert.equal(engine.synth.midiChannels[0].parameters.keyShift,2);assert.equal(engine.synth.midiChannels[9].parameters.keyShift,0);assert.equal(engine.synth.midiChannels[4].parameters.isMuted,true);
 player.seek(5);assert.equal(engine.seq.currentTime,5);player.pause();assert.equal(player.playing,false);await player.setSoundFont(null);assert.equal(engine.destroyed,true);assert.equal(player.fontID,'builtin');
});
test('failed SoundFont preparation keeps the current font and playback',async()=>{
 const engine=mockEngine(),player=readyPlayer(engine);await player.setSoundFont(font(),{id:'good',name:'Good'});player.load({duration:10,buffer:font(),notes:[]});await player.play();
 const bad=mockEngine({invalid:true});player.engineFactory=async()=>bad;
 await assert.rejects(player.setSoundFont(font(),{id:'bad'}));assert.equal(player.engine,engine);assert.equal(player.fontID,'good');assert.equal(player.playing,true);assert.equal(bad.destroyed,true);player.pause();
});
test('Stop cancels playback waiting for the SoundFont sequencer to load',async()=>{
 const engine=mockEngine({delayed:true}),player=readyPlayer(engine);await player.setSoundFont(font());player.load({duration:10,buffer:font(),notes:[]});const pending=player.play();await new Promise(resolve=>setImmediate(resolve));player.stop();engine.seq.eventHandler.fire('songChange');await pending;assert.equal(engine.seq.plays,0);assert.equal(player.playing,false);
});

test('SoundFont validates decoded bytes when transport Content-Length is compressed',async()=>{
 const entry={url:'https://fonts.example/a.sf2',bytes:12};
 const buffer=await downloadSoundFont(entry,{fetcher:async()=>new Response(font(),{headers:{'content-length':'8','content-encoding':'gzip'}})});
 assert.equal(buffer.byteLength,12);
 await assert.rejects(downloadSoundFont(entry,{fetcher:async()=>new Response(new Uint8Array(11),{headers:{'content-length':'12'}})}),/incomplete/);
});
