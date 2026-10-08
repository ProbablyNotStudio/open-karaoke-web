import {MidiSynth} from './synth.js?v=44';
import {validateSoundFont} from './soundfonts.js?v=44';
import {loadingDeadline} from './loading.js?v=44';

const modules=new WeakMap();
async function createEngine(context){
  const {WorkletSynthesizer,Sequencer}=await loadingDeadline(import('./vendor/spessasynth.js'),30000,'Instrument player did not load. Check your connection and retry.');
  if(!modules.has(context))modules.set(context,context.audioWorklet.addModule(new URL('./vendor/spessasynth_processor.min.js',import.meta.url)));
  try{await loadingDeadline(modules.get(context),30000,'Audio engine took too long to start. Retry or choose the built-in synth.');}catch(error){modules.delete(context);throw error;}
  const synth=new WorkletSynthesizer(context);
  try{await loadingDeadline(synth.isReady,30000,'Audio engine stopped responding. Retry or choose the built-in synth.');synth.setLogLevel(false,false,false);return {synth,seq:new Sequencer(synth,{skipToFirstNoteOn:false}),destroy:()=>synth.destroy()};}
  catch(error){synth.destroy();throw error;}
}
function waitForSong(seq,buffer){
  return new Promise((resolve,reject)=>{
    const finish=error=>{clearTimeout(timer);seq.eventHandler.removeEvent('songChange','load');seq.eventHandler.removeEvent('midiError','load');error?reject(error):resolve();};
    const timer=setTimeout(()=>finish(Error('SoundFont MIDI loading timed out.')),30000);
    seq.eventHandler.addEvent('songChange','load',()=>finish());
    seq.eventHandler.addEvent('midiError','load',error=>finish(Error(error?.message||'This MIDI could not load in the SoundFont engine.')));
    try{seq.loadNewSongList([{binary:buffer.slice(0),fileName:'Karaoke song'}]);}catch(error){finish(error);}
  });
}
function loadBank(engine,buffer){
  return new Promise((resolve,reject)=>{
    const finish=error=>{clearTimeout(timer);engine.synth.eventHandler.removeEvent('soundBankError','load');error?reject(error):resolve();};
    const timer=setTimeout(()=>finish(Error('SoundFont preparation timed out. Try a smaller font.')),60000);
    engine.synth.eventHandler.addEvent('soundBankError','load',error=>finish(Error(String(error?.message||error||'Invalid SoundFont.'))));
    engine.synth.soundBankManager.addSoundBank(buffer,'selected').then(()=>finish(),finish);
  });
}
export class SoundFontSynth extends MidiSynth {
  constructor(engineFactory=createEngine){super();this.engineFactory=engineFactory;this.fontID='builtin';this.fontName='Built-in synth';this.engine=null;this.engineSong=null;this.loadChain=Promise.resolve();}
  get time(){return this.engine&&this.playing?Math.min(this.song?.duration||0,this.engine.seq.currentHighResolutionTime):super.time;}
  load(song){super.load(song);this.engineSong=null;}
  async setSoundFont(buffer,{id='builtin',name='Built-in synth'}={}){
    let candidate=null;
    if(buffer){validateSoundFont(buffer);await super.init();candidate=await this.engineFactory(this.context);
      try{await loadBank(candidate,buffer);candidate.seq.loopCount=0;}
      catch(error){candidate.destroy();throw error;}
    }
    const running=this.playing||this.playPending,position=this.time,previous=this.engine;
    this.pause();this.engine=candidate;this.engineSong=null;this.loadChain=Promise.resolve();this.position=position;this.fontID=id;this.fontName=name;
    previous?.destroy();this.setProfile(id);
    if(candidate){candidate.synth.connect(this.master);candidate.seq.eventHandler.addEvent('songEnded','karaoke',()=>{if(this.engine!==candidate||!this.playing)return;this.playing=false;this.position=this.song?.duration||0;this.onended?.();});this.applyFontControls();}
    if(running&&this.song)await this.play();
  }
  applyFontControls(){
    if(!this.engine)return;
    this.engine.seq.playbackRate=this.rate;
    this.engine.synth.midiChannels.forEach((channel,i)=>{channel.setSystemParameter('keyShift',i%16===9?0:this.key);channel.setSystemParameter('isMuted',i%16===this.mutedChannel);});
  }
  async prepareSong(){
    if(!this.engine||!this.song)return;
    const engine=this.engine,song=this.song;
    if(this.engineSong===song)return;
    const task=this.loadChain.catch(()=>{}).then(async()=>{if(engine!==this.engine||song!==this.song)return;await waitForSong(engine.seq,song.buffer);if(engine===this.engine&&song===this.song)this.engineSong=song;});
    this.loadChain=task;await task;
  }
  async play(){
    if(!this.engine)return super.play();if(!this.song)return;
    const generation=this.generation,engine=this.engine,song=this.song;this.playPending=true;
    try{
      await super.init();
      if(generation!==this.generation||engine!==this.engine)return;
      await this.prepareSong();
      if(generation!==this.generation||engine!==this.engine||song!==this.song)return;
      if(this.position>=song.duration)this.position=0;
      this.applyFontControls();engine.seq.currentTime=this.position;engine.seq.play();this.playing=true;
    }finally{if(generation===this.generation)this.playPending=false;}
  }
  pause(){
    if(!this.engine)return super.pause();
    this.generation++;this.playPending=false;if(this.playing)this.position=this.time;this.playing=false;
    this.engine.seq.pause();this.engine.synth.stopAll(true);
  }
  stop(){super.stop();if(this.engine&&this.engineSong)this.engine.seq.currentTime=0;}
  seek(time){
    if(!this.engine)return super.seek(time);
    this.position=Math.max(0,Math.min(this.song?.duration||0,time));if(this.engineSong)this.engine.seq.currentTime=this.position;
  }
  configure({rate=this.rate,key=this.key,mutedChannel=this.mutedChannel}={}){
    if(!this.engine)return super.configure({rate,key,mutedChannel});
    this.rate=rate;this.key=key;this.mutedChannel=mutedChannel;this.applyFontControls();
  }
}
