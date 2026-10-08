import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ENHANCED_TIMBRES,toneShape} from '../js/enhanced-timbres.js';
import {MidiSynth} from '../js/synth.js';
import {SoundFontSynth} from '../js/soundfont-synth.js';

test('enhanced mix raises output after compression, limits peaks, and keeps user volume',()=>{
 const synth=new MidiSynth(),targets=[];synth.context={currentTime:5};
 synth.output={gain:{setTargetAtTime:(...values)=>targets.push(values)}};
 synth.compressor={threshold:{},ratio:{},attack:{},release:{}};synth.limiter={threshold:{},ratio:{}};
 synth.volume=.4;synth.setProfile('builtin-enhanced');
 assert.deepEqual(targets.at(-1),[1.7,5,.025]);assert.equal(synth.volume,.4);
 assert.equal(synth.limiter.threshold.value,-2);assert.equal(synth.limiter.ratio.value,20);
 synth.setProfile('builtin');assert.equal(targets.at(-1)[0],1);assert.equal(synth.limiter.ratio.value,1);
});

test('all 128 enhanced programs have bounded envelopes and velocity-sensitive brightness',()=>{
 assert.equal(ENHANCED_TIMBRES.length,128);
 for(let program=0;program<128;program++){
  for(const pitch of [0,60,127]){
   const soft=toneShape(program,20,pitch,22050),loud=toneShape(program,127,pitch,22050);
   for(const value of [loud.a,loud.d,loud.s,loud.r,loud.cutoff,loud.attackCutoff,...loud.h])assert.ok(Number.isFinite(value)&&value>=0);
   assert.ok(loud.cutoff<=22050*.44);assert.ok(loud.attackCutoff<=22050*.44);
   assert.ok(loud.level>soft.level);assert.ok(loud.cutoff>=soft.cutoff);
  }
 }
 assert.notDeepEqual(toneShape(0).h,toneShape(1).h);
 assert.notDeepEqual(toneShape(80).h,toneShape(81).h);
});

function audio(){
 const events=[],sources=[],nodes=[];
 const param=()=>{let last=-Infinity;const record=(v,t)=>{assert.ok(t>=last);last=t;events.push([v,t]);};return {value:0,setValueAtTime:record,exponentialRampToValueAtTime:record,cancelScheduledValues(){last=-Infinity;},setTargetAtTime:record};};
 const node=()=>{const n={disconnected:false,connect(){},disconnect(){this.disconnected=true;}};nodes.push(n);return n;};
 const source=()=>{const s=Object.assign(node(),{frequency:param(),playbackRate:param(),detune:param(),setPeriodicWave(){},start(){},stop(){}});sources.push(s);return s;};
 return {events,sources,nodes,context:{sampleRate:22050,createBuffer:(_,length)=>{const data=new Float32Array(length);return {getChannelData:()=>data};},createGain:()=>Object.assign(node(),{gain:param()}),createStereoPanner:()=>Object.assign(node(),{pan:param()}),createOscillator:source,createBufferSource:source,createBiquadFilter:()=>Object.assign(node(),{frequency:param(),Q:param()})}};
}
test('short acoustic notes have ordered automation and release every node',()=>{
 const a=audio(),synth=new MidiSynth();synth.context=a.context;synth.master={};synth.enhancedWaves=Array(128).fill({});synth.setProfile('builtin-enhanced');
 synth.voice({ch:0,pitch:60,program:48,velocity:100},10,.002);
 assert.equal(a.sources.length,1);assert.equal(synth.voices.size,1);
 // Each AudioParam receives nondecreasing times even for a tiny note.
 assert.ok(a.events.every(([v,t])=>Number.isFinite(v)&&v>0&&t>=10));
 a.sources[0].onended();assert.equal(synth.voices.size,0);assert.ok(a.nodes.every(n=>n.disconnected));
});
test('dense acoustic arrangements use one source per note and Stop disconnects voices',()=>{
 const a=audio(),synth=new MidiSynth();synth.context=a.context;synth.master={};synth.enhancedWaves=Array(128).fill({});synth.setProfile('builtin-enhanced');
 for(let i=0;i<40;i++)synth.voice({ch:0,pitch:60,program:48},10,1);
 assert.equal(synth.voices.size,40);assert.equal(a.sources.length,40);
 synth.silence();assert.equal(synth.voices.size,0);assert.ok(a.nodes.every(n=>n.disconnected));
});
test('enhanced percussion accepts the GM drum range and ignores tiny note-off lengths',()=>{
 const a=audio(),synth=new MidiSynth();synth.context=a.context;synth.master={};synth.noise={};synth.setProfile('builtin-enhanced');
 for(let pitch=35;pitch<=81;pitch++)synth.voice({ch:9,pitch,velocity:90},10,.001);
 assert.equal(synth.voices.size,47);
 assert.ok(a.events.every(([value,time])=>Number.isFinite(value)&&value>0&&time>=10));
 synth.silence();assert.ok(a.nodes.every(node=>node.disconnected));
});
test('closed hi-hat chokes an open hi-hat at the scheduled hit time',()=>{
 const a=audio(),synth=new MidiSynth();synth.context=a.context;synth.master={};synth.setProfile('builtin-enhanced');
 synth.voice({ch:9,pitch:46},10,.02);let stopAt;
 a.sources[0].stop=time=>{stopAt=time;};
 synth.voice({ch:9,pitch:42},10.15,.02);
 assert.equal(stopAt,10.18);assert.equal(synth.voices.size,2);synth.silence();
});
test('Stop cancels acoustic preparation before it starts playback',async()=>{
 const a=audio(),synth=new MidiSynth();synth.context={...a.context,currentTime:10};synth.master={};synth.init=async()=>{};
 synth.setProfile('builtin-enhanced');synth.load({duration:10,notes:[{ch:0,program:0,pitch:60,time:0,end:1},{ch:0,program:24,pitch:64,time:0,end:1}]});
 const pending=synth.play();await Promise.resolve();synth.stop();await pending;
 assert.equal(synth.playing,false);assert.equal(synth.voices.size,0);assert.equal(synth.timer,undefined);
});
test('enhanced selection needs no bank or sample engine and switching preserves controls',async()=>{
 let bankLoads=0;
 const synth=new SoundFontSynth(async()=>{bankLoads++;throw Error('Should not create a sample engine');});
 synth.context={currentTime:10,resume:async()=>{},createPeriodicWave:()=>({})};synth.master={};
 synth.load({duration:10,notes:[]});synth.position=3;synth.rate=1.2;synth.key=2;synth.mutedChannel=4;await synth.play();
 await synth.setSoundFont(null,{id:'builtin-enhanced',name:'Enhanced synth'});
 assert.equal(bankLoads,0);assert.equal(synth.profile,'builtin-enhanced');assert.equal(synth.playing,true);
 assert.equal(synth.position,3);assert.equal(synth.rate,1.2);assert.equal(synth.key,2);assert.equal(synth.mutedChannel,4);
 await synth.setSoundFont(null);assert.equal(synth.profile,'builtin');synth.stop();
});
