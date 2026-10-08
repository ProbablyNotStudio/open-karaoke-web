// Small, original PCM textures generated on device. No recorded SoundFont
// samples are bundled. Unlike a repeating oscillator, partials can decay at
// different rates and plucked strings lose brightness as they ring.
export const TEXTURE_RATE=22050,CACHE_BYTES=8*1024*1024;
const clamp=(v,low,high)=>Math.max(low,Math.min(high,v));
function random(seed){let state=seed|0;return ()=>{state=(Math.imul(state,1664525)+1013904223)|0;return (state>>>0)/2147483648-1;};}
function normalize(data){let peak=0;for(const v of data)peak=Math.max(peak,Math.abs(v));const scale=peak>0?.82/peak:0;for(let i=0;i<data.length;i++)data[i]*=scale;return data;}
export function textureSpec(program,pitch,velocity=100,drum=false){
 // Upper notes transpose a lower texture during playback, so its fundamental
 // stays below this compact buffer's Nyquist limit instead of becoming silent.
 const p=clamp(Math.trunc(program)||0,0,127),root=drum?clamp(Math.trunc(pitch),0,127):clamp(Math.round(pitch/3)*3,0,108);
 const layer=velocity>100?2:velocity>55?1:0;
 return {program:p,root,layer,drum,key:`${drum?'d':'t'}:${drum?0:p}:${root}:${layer}`};
}
function partial(data,frequency,amplitude,decay,phase=0){
 if(frequency>TEXTURE_RATE*.43)return;
 const angle=2*Math.PI*frequency/TEXTURE_RATE,rotation=2*Math.cos(angle),fall=decay?Math.exp(-1/(TEXTURE_RATE*decay)):1;
 let previous=Math.sin(phase-angle),current=Math.sin(phase),level=amplitude;
 for(let i=0;i<data.length;i++){data[i]+=current*level;const next=rotation*current-previous;previous=current;current=next;level*=fall;}
}
function pluck(data,frequency,program,layer,rng){
 const family=program>>3,bass=family===4,delay=Math.max(3,Math.round(TEXTURE_RATE/frequency-.5));
 const string=new Float32Array(delay);let last=0;const brightness=layer===2?.8:layer===1?.6:.4;
 // A pick excites many modes at once; the string gradually damps the highs.
 for(let i=0;i<delay;i++){last=(1-brightness)*last+brightness*rng();string[i]=last;}
 let cursor=0;const damping=bass?(program===32?.9978:.9991):program===28?.983:program===24?.996:.998;
 for(let i=0;i<data.length;i++){
  const next=(cursor+1)%delay,value=string[cursor];data[i]=value;
  string[cursor]=(value+string[next])*.5*damping;cursor=next;
  // Muted guitar loses its highs quickly; driven guitars saturate their body.
  if(program===29||program===30)data[i]=Math.tanh(data[i]*(program===30?5:2.5));
 }
 // Pickup position changes the string harmonics without shifting its pitch.
 if([25,26,27,31,34,36,37].includes(program)){
  const pickupDelay=Math.max(1,Math.round(delay*(program===31?.5:program===34?.12:.22))),copy=data.slice();
  for(let i=pickupDelay;i<data.length;i++)data[i]=copy[i]-(program===31?.92:.45)*copy[i-pickupDelay];
 }
 if([36,37].includes(program))for(let i=0;i<Math.min(600,data.length);i++)data[i]+=rng()*.2*Math.exp(-i/85);
 // Correct integer delay tuning at playback rather than shifting notes.
 return TEXTURE_RATE/(delay+.5);
}
export function generateTexture(spec){
 if(spec.drum)return generateDrum(spec);
 const {program,root,layer}=spec,family=program>>3,rng=random(181+program*971+root*37+layer*7);
 let frequency=440*2**((root-69)/12);
 const plucked=family===3||(family===4&&program<38)||[6,7,45,46,104,105,106,107].includes(program);
 const struck=family===0||family===1||family===12||family===14||family===15||program===47||program===108;
 const loop=!plucked&&!struck,length=loop?1:3;
 const data=new Float32Array(TEXTURE_RATE*length);
 if(plucked)frequency=pluck(data,frequency,program,layer,rng);
 else if(struck){
  const piano=family===0,metal=family===1;
  const modes=[[1,2,3,5],[1,2.76,5.4,8.93,13.34],[1,2,3.95,5.9],[1,4,10],[1,4,9.2],[1,3,6.1,9],[1,2,2.4,3,4.2,5.4,6.5],[1,2,3,4,5,6]];
  const ring=[1.8,1.8,1.2,2.2,.8,.4,2.7,1.4];
  for(let harmonic=1;harmonic<=18;harmonic++){
   const ratio=metal?modes[program%8][harmonic-1]:harmonic*Math.sqrt(1+.00012*harmonic*harmonic);
   if(!ratio)break;
   const electric=program===4||program===5;
   const brightness=layer===2?1.22:layer===1?1.5:1.95;
   const amplitude=(electric&&harmonic%2===0?.1:1)/harmonic**brightness;
   const decay=(piano?3.3:metal?ring[program%8]:.8)/(1+harmonic**1.3*.2)*2**((60-root)/36);
   partial(data,frequency*ratio,amplitude,decay,rng()*Math.PI);
   if(piano&&program<4&&harmonic<=8&&root>=36)partial(data,frequency*ratio*(1+(program===3?.0015:.00055)),amplitude*.24,decay*.85,rng()*Math.PI);
  }
  // Brief hammer / mallet contact, never a sustained noise layer.
  let noise=0;for(let i=0;i<Math.min(data.length,900);i++){noise=.65*noise+.35*rng();data[i]+=noise*(piano?.1:.045)*Math.exp(-i/150);}
 }else{
  // Integer periods give a seamless one-second loop. Slow beating and
  // different phases create a living body instead of one static waveform.
  frequency=Math.max(1,Math.round(frequency));
  const bowed=family===5||family===6||family===11,flute=family===9;
  const organ=[[1,.55,.7,.12,.2,.07,.08,.04],[1,.42,.8,.18,.35,.12],[1,.7,.7,.42,.4,.3,.18,.12],[1,.2,.65,.15,.35,.08,.16,.04],[1,.6,.42,.28,.17,.11],[1,.1,.7,.04,.32,.03],[1,.04,.5,.025,.24],[1,.15,.65,.08,.25]][program%8];
  for(let harmonic=1;harmonic<=(flute?8:24);harmonic++){
   let amplitude=1/harmonic**(flute?2.7:bowed?1.7:1.8);
   if(family===2)amplitude=organ[harmonic-1]||0;
   if(family===4)amplitude=program===38?1/harmonic**(layer===2?1.4:2):harmonic%2?1/harmonic**1.65:0;
   if(family===8){
    const clarinet=program===71;
    if(clarinet&&harmonic%2===0)amplitude*=.035;
    const formant=program<=67?[1800,1400,1050,800][program-64]:program===68?1550:program===69?1100:program===70?550:1800;
    amplitude*=.5+1.8*Math.exp(-(((harmonic*frequency-formant)/(formant*.45))**2));
   }
   if(family===7){
    const bell=[1700,1050,650,2300,900,1350,1800,1500][program%8];
    amplitude*=.65+(layer===2?2:1.3)*Math.exp(-(((harmonic*frequency-bell)/(bell*.5))**2));
    if(program===59)amplitude*=harmonic===1?.45:1;
   }
   if(family===6)amplitude*=.5+1.2*Math.exp(-(((harmonic*frequency-800)/230)**2))+Math.exp(-(((harmonic*frequency-1250)/300)**2));
   if(program===80&&harmonic%2===0)amplitude=0;
   if(program===81)amplitude=1/harmonic**1.4;
   if(family===5)amplitude*=.7+1.3*Math.exp(-(((harmonic*frequency-2200)/1100)**2));
   if(flute){
    if(program===73||program===74)amplitude*=harmonic>3?.25:1;
    if(program===72)amplitude*=harmonic===2?1.8:1;
   }
   const phase=rng()*Math.PI;
   partial(data,frequency*harmonic,amplitude,0,phase);
   if(bowed){partial(data,frequency*harmonic+1,amplitude*.28,0,phase+.8);partial(data,frequency*harmonic-1,amplitude*.23,0,phase-1.1);}
   else if(family===7||family===8||family===9){partial(data,frequency*harmonic+5,amplitude*.035,0,phase);partial(data,Math.max(1,frequency*harmonic-5),amplitude*.035,0,phase+Math.PI);}
  }
  if(flute||family===8){
   let breath=0;for(let i=0;i<data.length;i++){const air=rng();breath+=.3*(air-breath);data[i]+=(air-breath)*(flute?.012:.006)*(layer+1)*Math.min(1,i/256,(data.length-1-i)/256);}
  }
 }
 if(!loop){
  // Avoid abrupt buffer starts and finish the generated recording smoothly.
  for(let i=0;i<data.length;i++)data[i]*=Math.min(1,i/80,(data.length-1-i)/500);
 }
 normalize(data);
 return {data,frequency,loop,seconds:length};
}
function generateDrum({root:note,layer}){
 const rng=random(97+note*53+layer),kick=note===35||note===36,snare=[38,39,40].includes(note),hat=[42,44,46].includes(note);
 const cymbal=[49,51,52,53,55,57,59].includes(note),tom=[41,43,45,47,48,50,60,61,62,63,64].includes(note);
 const seconds=note===81?1.4:note===80?.18:note===54?.5:[56,67,68].includes(note)?.4:note===72?.65:note===74?.4:kick?.65:snare?.45:hat?(note===46?.7:note===44?.08:.12):cymbal?1.8:tom?.65:.28;
 const data=new Float32Array(Math.ceil(TEXTURE_RATE*seconds));let phase=0,low=0,body=0;
 const tomFrequency=({41:82,43:98,45:110,47:131,48:147,50:175,60:225,61:180,62:250,63:200,64:160})[note]||180;
 for(let i=0;i<data.length;i++){
  const t=i/TEXTURE_RATE,noise=rng();low+=.32*(noise-low);const high=noise-low;
  if(kick){
   phase+=2*Math.PI*((note===35?43:52)+110*Math.exp(-t*38))/TEXTURE_RATE;
   data[i]=Math.sin(phase)*Math.exp(-t*9)+high*(layer===2?.24:layer===1?.14:.06)*Math.exp(-t*100);
  }else if(snare){
   body+=.45*(noise-body);
   if(note===39){let burst=0;for(const delay of [0,.014,.029])if(t>=delay)burst+=Math.exp(-(t-delay)*65);data[i]=high*burst*.4+body*.15*Math.exp(-t*20);}
   else data[i]=high*.65*Math.exp(-t*17)+body*.25*Math.exp(-t*25)+Math.sin(2*Math.PI*(note===40?220:185)*t)*.45*Math.exp(-t*28)+Math.sin(2*Math.PI*330*t)*.18*Math.exp(-t*40);
  }else if(tom){
   phase+=2*Math.PI*tomFrequency*(1+.18*Math.exp(-t*25))/TEXTURE_RATE;
   data[i]=(Math.sin(phase)+.18*Math.sin(phase*1.59))*Math.exp(-t*10)+high*.06*Math.exp(-t*70);
  }else if(hat||cymbal){
   data[i]=high*.6*Math.exp(-t/(hat?(note===46?.15:.025):.42));
  }else if([54,69,70,73,74].includes(note)){
   const duration=note===74?.12:note===73?.045:note===54?.09:.045;
   const scrape=(note===73||note===74)?.35+.65*Math.max(0,Math.sin(t*2*Math.PI*95)):1;
   data[i]=high*scrape*Math.exp(-t/duration);
  }else if([71,72].includes(note)){
   data[i]=(Math.sin(2*Math.PI*2100*t+.09*Math.sin(2*Math.PI*7*t))+.035*high)*Math.exp(-t/(note===71?.04:.23));
  }else if([78,79].includes(note)){
   phase+=2*Math.PI*(note===78?720:500)*(1+.45*Math.exp(-t*18))/TEXTURE_RATE;data[i]=Math.sin(phase)*Math.exp(-t*18);
  }else{
   const frequency=({37:1600,56:540,67:900,68:1200,75:850,76:1100,77:820,80:1600,81:1900})[note]||400;
   data[i]=Math.sin(2*Math.PI*frequency*t)*Math.exp(-t*35)+high*.2*Math.exp(-t*40);
  }
 }
 if([37,54,56,65,66,67,68,75,76,77,80,81].includes(note)){
  // Inharmonic metal modes and hollow wood resonances replace generic bleeps.
  const metal=[54,56,65,66,67,68,80,81].includes(note);
  const base=({37:1750,54:3900,56:540,65:330,66:270,67:900,68:675,75:2500,76:1250,77:850,80:4300,81:4300})[note];
  const decay=note===81?.42:note===80?.035:note===54?.1:metal?.085:.025;
  for(let i=0;i<data.length;i++)data[i]*=.08;
  for(const [index,ratio] of (metal?[1,1.48,2.13,2.78]:[1,1.72,2.53]).entries())partial(data,base*ratio,1/(index+1),decay/(1+index*.2),note*.1);
 }
 if(hat||cymbal){
  for(const frequency of [3173,4219,5273,6347,7919,9437])partial(data,frequency,.075,hat?.05:.35,note*.1);
  if([51,53,59].includes(note))for(const ratio of [1,2.32,3.47])partial(data,740*ratio,note===53?.35:.16,.55,note*.1);
 }
 // A short contact fade prevents digital clicks without losing the hit.
 for(let i=0;i<data.length;i++)data[i]*=Math.min(1,i/12,(data.length-1-i)/300);
 normalize(data);return {data,frequency:1,loop:false,seconds};
}
export class AcousticBank {
 constructor(context){this.context=context;this.entries=new Map();this.bytes=0;}
 get(spec){
  let entry=this.entries.get(spec.key);
  if(entry){this.entries.delete(spec.key);this.entries.set(spec.key,entry);return entry;}
  const texture=generateTexture(spec),buffer=this.context.createBuffer(1,texture.data.length,TEXTURE_RATE);
  buffer.getChannelData(0).set(texture.data);entry={buffer,frequency:texture.frequency,loop:texture.loop,seconds:texture.seconds,bytes:texture.data.byteLength};
  while(this.bytes+entry.bytes>CACHE_BYTES&&this.entries.size){const [key,old]=this.entries.entries().next().value;this.entries.delete(key);this.bytes-=old.bytes;}
  this.entries.set(spec.key,entry);this.bytes+=entry.bytes;return entry;
 }
}
