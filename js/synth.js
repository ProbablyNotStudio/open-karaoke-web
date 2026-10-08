import {AcousticBank,textureSpec} from './acoustic-bank.js?v=41';
import {toneShape} from './enhanced-timbres.js?v=41';
// Original harmonic recipes in General MIDI family order. No sampled recordings.
const TIMBRES=[
 {h:[1,.38,.2,.12,.07],a:.004,d:.65,s:.08,r:.18,g:1}, // piano
 {h:[1,.08,.5,.02,.22,.01,.1],a:.002,d:.4,s:.015,r:.1,g:.8}, // mallets
 {h:[1,.5,.35,.2,.16,.1],a:.012,d:.15,s:.8,r:.06,g:.65}, // organ
 {h:[1,.55,.23,.16,.08,.05],a:.003,d:.3,s:.045,r:.1,g:.9}, // guitar
 {h:[1,.45,.18,.07],a:.005,d:.24,s:.25,r:.08,g:1.2}, // bass
 {h:[1,.48,.32,.22,.16,.12,.08],a:.09,d:.3,s:.7,r:.28,g:.6}, // strings
 {h:[1,.2,.14,.09,.04],a:.16,d:.3,s:.6,r:.35,g:.7}, // ensemble
 {h:[1,.62,.36,.24,.14,.09],a:.035,d:.18,s:.65,r:.12,g:.62}, // brass
 {h:[1,.12,.48,.07,.24,.03],a:.025,d:.2,s:.65,r:.1,g:.75}, // reeds
 {h:[1,.15,.07,.03],a:.025,d:.18,s:.75,r:.12,g:.9}, // pipes
 {h:[1,.45,.3,.2,.15,.1],a:.012,d:.2,s:.55,r:.12,g:.65}, // lead
 {h:[1,.3,.22,.12,.08],a:.22,d:.4,s:.65,r:.45,g:.65}, // pads
 {h:[1,.3,.6,.12,.24],a:.003,d:.4,s:.06,r:.22,g:.75}, // effects
 {h:[1,.5,.2,.1,.06],a:.003,d:.22,s:.035,r:.08,g:.85}, // ethnic
 {h:[1,.1,.45,.05,.2],a:.002,d:.16,s:.01,r:.06,g:.8}, // percussion
 {h:[1,.4,.18,.09],a:.008,d:.25,s:.12,r:.12,g:.7} // effects
];
export class MidiSynth {
  constructor(){this.profile='builtin';this.context=null;this.voices=new Set();this.position=0;this.rate=1;this.key=0;this.volume=.65;this.playing=false;this.song=null;this.mutedChannel=-1;this.generation=0;}
  async init(){
    if(!this.context){
      this.context=new AudioContext();this.master=this.context.createGain();
      const compressor=this.compressor=this.context.createDynamicsCompressor();
      this.output=this.context.createGain();this.limiter=this.context.createDynamicsCompressor();
      this.limiter.knee.value=0;this.limiter.attack.value=.001;this.limiter.release.value=.1;
      this.master.connect(compressor);compressor.connect(this.output);this.output.connect(this.limiter);this.limiter.connect(this.context.destination);
      this.configureOutput();
      // A quiet room echo gives sustained parts space without washing out drums.
      const delay=this.context.createDelay(.3),wet=this.context.createGain(),tone=this.context.createBiquadFilter();
      delay.delayTime.value=.085;wet.gain.value=.12;tone.type='lowpass';tone.frequency.value=3200;
      this.master.connect(delay);delay.connect(tone);tone.connect(wet);wet.connect(compressor);
      this.waves=TIMBRES.map(t=>this.context.createPeriodicWave(new Float32Array(t.h.length+1),new Float32Array([0,...t.h])));
      this.master.gain.value=this.volume;
      this.noise=this.context.createBuffer(1,this.context.sampleRate,this.context.sampleRate);
      const d=this.noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    }
    await this.context.resume();
  }
  setProfile(id){this.profile=id==='builtin-enhanced'?'builtin-enhanced':'builtin';this.configureOutput();}
  configureOutput(){
    if(!this.output)return;
    const enhanced=this.profile==='builtin-enhanced';
    // Makeup gain follows compression, with a final peak limiter. Keep the
    // user's volume setting independent of the selected instrument player.
    this.compressor.threshold.value=enhanced?-14:-18;this.compressor.ratio.value=enhanced?4:3;
    this.compressor.attack.value=enhanced?.003:.008;this.compressor.release.value=enhanced?.16:.2;
    this.limiter.threshold.value=enhanced?-2:0;this.limiter.ratio.value=enhanced?20:1;
    this.output.gain.setTargetAtTime(enhanced?1.7:1,this.context.currentTime,.025);
  }
  load(song){this.stop();this.song=song;}
  get time(){return this.playing?Math.min(this.song.duration,this.position+(this.context.currentTime-this.anchor)*this.rate):this.position;}
  async play(){if(!this.song)return;const generation=this.generation;this.playPending=true;try{await this.init();if(generation!==this.generation||this.playing)return;if(this.profile==='builtin-enhanced')await this.prepareAcoustic(generation);if(generation!==this.generation||this.playing)return;if(this.position>=this.song.duration)this.position=0;this.anchor=this.context.currentTime;this.playing=true;this.cursor=0;this.schedule();if(this.playing&&generation===this.generation)this.timer=setInterval(()=>this.schedule(),40);}finally{if(generation===this.generation)this.playPending=false;}}
  pause(){this.generation++;this.playPending=false;if(this.playing)this.position=this.time;this.playing=false;clearInterval(this.timer);this.silence();}
  stop(){this.pause();this.position=0;}
  seek(time){const running=this.playing||this.playPending;this.pause();this.position=Math.max(0,Math.min(this.song?.duration||0,time));if(running)void this.play();}
  configure({rate=this.rate,key=this.key,mutedChannel=this.mutedChannel}={}){const running=this.playing||this.playPending;this.pause();this.rate=rate;this.key=key;this.mutedChannel=mutedChannel;if(running)void this.play();}
  setVolume(v){this.volume=v;if(this.master)this.master.gain.setTargetAtTime(v,this.context.currentTime,.02);}
  silence(){for(const v of [...this.voices])v.stop();this.voices.clear();}
  schedule(){
    if(!this.playing)return;
    const now=this.time,horizon=now+.22*this.rate,notes=this.song.notes;
    while(this.cursor<notes.length&&notes[this.cursor].time<horizon){
      const n=notes[this.cursor++];if(n.end<=now||n.ch===this.mutedChannel)continue;
      const start=this.context.currentTime+Math.max(0,n.time-now)/this.rate;
      this.voice(n,start,Math.max(.02,(n.end-Math.max(now,n.time))/this.rate));
    }
    if(now>=this.song.duration){this.pause();this.position=this.song.duration;this.onended?.();}
  }
  acousticSpec(n){return textureSpec(n.program??0,n.pitch+(n.ch===9?0:this.key+(n.bend??0)),n.velocity??100,n.ch===9);}
  async prepareAcoustic(generation){
    if(!this.bank)this.bank=new AcousticBank(this.context);
    let count=0;const seen=new Set();
    for(const n of this.song.notes){
      if(n.time>this.position+2)break;
      if(n.end<=this.position||n.ch===this.mutedChannel)continue;
      const spec=this.acousticSpec(n);if(seen.has(spec.key))continue;seen.add(spec.key);this.bank.get(spec);
      if(++count%2===0)await new Promise(resolve=>setTimeout(resolve,0));
      if(generation!==this.generation||this.profile!=='builtin-enhanced'||count>=24)return;
    }
  }
  acousticVoice(n,start,duration){
    const ctx=this.context;if(!this.bank)this.bank=new AcousticBank(ctx);
    if(n.ch===9&&[42,44].includes(n.pitch))for(const voice of this.voices)if(voice.drumPitch===46&&voice.start<=start)voice.choke(start);
    const spec=this.acousticSpec(n),entry=this.bank.get(spec),source=ctx.createBufferSource(),gain=ctx.createGain(),pan=ctx.createStereoPanner(),filter=ctx.createBiquadFilter();
    const drum=n.ch===9,t=toneShape(n.program??0,n.velocity??100,n.pitch+this.key+(n.bend??0),ctx.sampleRate);
    const pitch=440*2**((n.pitch+this.key+(n.bend??0)-69)/12);
    source.buffer=entry.buffer;source.loop=entry.loop;source.playbackRate.value=drum?1:pitch/entry.frequency;
    filter.type='lowpass';filter.Q.value=.45;
    filter.frequency.setValueAtTime(drum?ctx.sampleRate*.44:t.attackCutoff,start);
    if(!drum)filter.frequency.exponentialRampToValueAtTime(t.cutoff,start+Math.min(duration,.2));
    pan.pan.value=Math.max(-1,Math.min(1,((n.pan??64)-64)/64));
    source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(this.master);
    const drumLevel=[42,44,46].includes(n.pitch)?.32:[49,51,52,53,55,57,59].includes(n.pitch)?.5:[35,36].includes(n.pitch)?1.2:1;
    const amp=Math.max(.0001,(n.velocity??100)/127*(n.volume??100)/127*(n.expression??127)/127*.2*(drum?drumLevel:t.g));
    const held=drum?entry.seconds:Math.max(.002,duration),attack=drum?.001:Math.min(entry.loop?t.a:.003,held*.5),release=drum?.015:t.r;
    const stopAt=start+held+release;
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(amp,start+attack);
    gain.gain.setValueAtTime(amp,start+held);gain.gain.exponentialRampToValueAtTime(.0001,stopAt);
    let cleaned=false;const cleanup=()=>{if(cleaned)return;cleaned=true;this.voices.delete(voice);for(const node of [source,filter,gain,pan])node.disconnect();};
    const voice={drumPitch:drum?n.pitch:null,start,choke:time=>{gain.gain.cancelScheduledValues(time);gain.gain.setTargetAtTime(.0001,time,.005);source.stop(time+.03);},stop:()=>{try{source.stop();}catch{}cleanup();}};this.voices.add(voice);
    source.onended=cleanup;source.start(start);source.stop(stopAt+.01);
  }
  voice(n,start,duration){
    if(this.voices.size>=96)return;
    if(this.profile==='builtin-enhanced')return this.acousticVoice(n,start,duration);
    const ctx=this.context,gain=ctx.createGain(),pan=ctx.createStereoPanner(),sources=[],nodes=[gain,pan];
    pan.pan.value=Math.max(-1,Math.min(1,((n.pan??64)-64)/64));gain.connect(pan);pan.connect(this.master);
    const amp=Math.max(.0001,(n.velocity??100)/127*(n.volume??100)/127*(n.expression??127)/127*.14);
    const connect=(source,filter)=>{sources.push(source);if(filter){nodes.push(filter);source.connect(filter);filter.connect(gain);}else source.connect(gain);return source;};
    let attack=.003,decay=.1,sustain=.01,release=.05,level=amp,stopAt;
    if(n.ch===9){
      const k=n.pitch;
      // Drum envelopes ring independently of short MIDI note-off events.
      duration=k===46?.32:[49,51,52,55,57,59].includes(k)?.75:k===42||k===44?.06:.18;
      if(k===35||k===36||[41,43,45,47,48,50,60,61,62,63,64].includes(k)){
        const osc=connect(ctx.createOscillator());const kick=k<=36;
        osc.frequency.setValueAtTime(kick?145:90*2**((k-41)/15),start);osc.frequency.exponentialRampToValueAtTime(kick?45:70*2**((k-41)/15),start+.1);
        duration=kick?.25:.22;level*=1.35;
      }else{
        const noise=ctx.createBufferSource();noise.buffer=this.noise;
        const filter=ctx.createBiquadFilter();filter.type=k>=42?'highpass':'bandpass';filter.frequency.value=k>=42?6500:1800;filter.Q.value=.7;connect(noise,filter);
        if([38,39,40].includes(k)){
          const body=connect(ctx.createOscillator());body.type='triangle';body.frequency.value=k===40?210:175;
          level*=.7;
        }else level*=k===42||k===44?.38:.55;
      }
      decay=duration;sustain=.001;stopAt=start+duration+release;
    }else{
      const program=Math.max(0,Math.min(127,Math.trunc(n.program??0))),family=program>>3;
      const t=TIMBRES[family];
      attack=t.a;decay=t.d;sustain=t.s;release=t.r;level*=t.g;
      const frequency=440*2**((n.pitch+this.key+(n.bend??0)-69)/12),osc=ctx.createOscillator(),filter=ctx.createBiquadFilter();
      osc.setPeriodicWave(this.waves[family]);osc.frequency.value=frequency;
      filter.type='lowpass';filter.frequency.value=Math.min(ctx.sampleRate*.45,frequency*(family===4?6:18)+1200);filter.Q.value=.5;connect(osc,filter);
      stopAt=start+duration+release;
    }
    // A note-off during the attack must never create out-of-order automation.
    const held=Math.max(.002,duration),peakAt=Math.min(attack,held*.5),decayAt=Math.min(peakAt+decay,held);
    const heldLevel=Math.max(.0001,level*(sustain+(1-sustain)*Math.exp(-(held-peakAt)/Math.max(.001,decay))));
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(level,start+peakAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001,level*(sustain+(1-sustain)*Math.exp(-(decayAt-peakAt)/Math.max(.001,decay)))),start+decayAt);
    gain.gain.exponentialRampToValueAtTime(heldLevel,start+held);gain.gain.exponentialRampToValueAtTime(.0001,stopAt);
    let remaining=sources.length,cleaned=false;
    const cleanup=()=>{if(cleaned)return;cleaned=true;this.voices.delete(v);for(const node of [...sources,...nodes])node.disconnect();};
    const v={stop:()=>{for(const source of sources){try{source.stop();}catch{}}cleanup();}};this.voices.add(v);
    for(const source of sources){source.onended=()=>{if(--remaining===0)cleanup();};source.start(start);source.stop(stopAt+.01);}
  }
}
