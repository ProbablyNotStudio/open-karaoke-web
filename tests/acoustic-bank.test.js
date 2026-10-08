import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AcousticBank,CACHE_BYTES,TEXTURE_RATE,generateTexture,textureSpec} from '../js/acoustic-bank.js';
const rms=(data,start,end)=>{let energy=0;for(let i=start;i<end;i++)energy+=data[i]**2;return Math.sqrt(energy/(end-start));};
test('all GM acoustic textures are finite, bounded and have usable energy',()=>{
 for(let program=0;program<128;program++){
  const texture=generateTexture(textureSpec(program,60,110));let peak=0;
  for(const value of texture.data){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));}
  assert.ok(peak>.1&&peak<=.821);assert.ok(texture.frequency>0);
 }
});
test('piano and plucked-string bodies lose energy naturally after their attack',()=>{
 for(const program of [0,4,24,25,32,33]){
  const {data}=generateTexture(textureSpec(program,60,110));
  assert.ok(rms(data,1000,5000)>rms(data,50000,60000)*2,`program ${program} must decay`);
  assert.equal(Math.abs(data[0]),0);assert.equal(Math.abs(data.at(-1)),0);
 }
});
test('very high MIDI notes keep an audible base texture for pitch-correct resampling',()=>{
 for(const program of [0,24,48,73]){
  const spec=textureSpec(program,127),t=generateTexture(spec);
  assert.ok(spec.root<=108);assert.ok(rms(t.data,0,5000)>.001);
 }
 assert.equal(textureSpec(0,27,100,true).root,27);
 assert.equal(textureSpec(0,90,100,true).root,90);
});
test('sustained textures loop without a large amplitude discontinuity and plucks retain pitch',()=>{
 for(const program of [16,48,52,56,65,73,88]){
  const t=generateTexture(textureSpec(program,60));assert.equal(t.loop,true);
  assert.ok(Math.abs(t.data[0]-t.data.at(-1))<.15);
 }
 for(const pitch of [36,48,60,72]){
  const spec=textureSpec(24,pitch),t=generateTexture(spec),expected=440*2**((spec.root-69)/12);
  assert.ok(Math.abs(12*Math.log2(t.frequency/expected))<.25);
 }
});
test('GM drum hits have independent natural tails and hats differ from snares and kicks',()=>{
 for(let pitch=35;pitch<=81;pitch++){
  const t=generateTexture(textureSpec(0,pitch,110,true));assert.equal(t.loop,false);
  assert.ok(t.data.every(Number.isFinite));assert.equal(Math.abs(t.data[0]),0);assert.equal(Math.abs(t.data.at(-1)),0);
 }
 const kick=generateTexture(textureSpec(0,36,110,true)),snare=generateTexture(textureSpec(0,38,110,true));
 const closed=generateTexture(textureSpec(0,42,110,true)),open=generateTexture(textureSpec(0,46,110,true));
 assert.ok(open.seconds>closed.seconds*3);assert.notDeepEqual(kick.data.subarray(0,100),snare.data.subarray(0,100));
});
test('sound cache reuses buffers and evicts old entries within 8 MiB',()=>{
 const ctx={createBuffer:(_,length)=>{const data=new Float32Array(length);return {getChannelData:()=>data};}};
 const bank=new AcousticBank(ctx),first=textureSpec(0,60,110);assert.equal(bank.get(first),bank.get(first));
 for(let program=0;program<60;program++)bank.get(textureSpec(program,48,110));
 assert.ok(bank.bytes<=CACHE_BYTES);assert.ok(bank.entries.size<60);assert.equal(TEXTURE_RATE,22050);
});

function bandEnergy(texture,hz){
 const data=texture.data,start=2000,count=Math.min(8192,data.length-start);let real=0,imag=0;
 for(let i=0;i<count;i++){const phase=2*Math.PI*hz*i/TEXTURE_RATE;real+=data[start+i]*Math.cos(phase);imag+=data[start+i]*Math.sin(phase);}
 return (real*real+imag*imag)/(count*count);
}
test('soft and hard piano layers change brightness rather than only loudness',()=>{
 const soft=generateTexture(textureSpec(0,60,35)),hard=generateTexture(textureSpec(0,60,120));
 const brightness=t=>bandEnergy(t,t.frequency*3)/bandEnergy(t,t.frequency);
 assert.ok(brightness(hard)>brightness(soft)*2);
 assert.notEqual(textureSpec(0,60,35).key,textureSpec(0,60,80).key);assert.notEqual(textureSpec(0,60,80).key,textureSpec(0,60,120).key);
});
test('muted guitars decay quickly, distortion changes harmonics, and synth bass sustains',()=>{
 const clean=generateTexture(textureSpec(27,48,110)),muted=generateTexture(textureSpec(28,48,110)),driven=generateTexture(textureSpec(30,48,110));
 const tail=t=>rms(t.data,20000,25000)/rms(t.data,1000,5000);
 assert.ok(tail(muted)<tail(clean)*.3);const upperRatio=t=>(bandEnergy(t,t.frequency*3)+bandEnergy(t,t.frequency*5))/bandEnergy(t,t.frequency);
 assert.ok(upperRatio(driven)>upperRatio(clean)*3);
 for(const program of [38,39])assert.equal(generateTexture(textureSpec(program,36,110)).loop,true);
});
test('clarinet favors odd harmonics while saxophone retains its even body',()=>{
 const clarinet=generateTexture(textureSpec(71,60,100)),sax=generateTexture(textureSpec(65,60,100));
 const evenRatio=t=>bandEnergy(t,t.frequency*2)/bandEnergy(t,t.frequency);
 assert.ok(evenRatio(sax)>evenRatio(clarinet)*10);
});
test('open triangle rings longer than muted triangle and maracas have a noisy body',()=>{
 const open=generateTexture(textureSpec(0,81,110,true)),muted=generateTexture(textureSpec(0,80,110,true)),maracas=generateTexture(textureSpec(0,70,110,true));
 assert.ok(open.seconds>muted.seconds*5);assert.ok(rms(open.data,10000,15000)>.01);assert.ok(rms(maracas.data,100,1000)>.05);
});

test('marimba and glockenspiel have different resonance modes and ringing time',()=>{
 const marimba=generateTexture(textureSpec(12,60,110)),glock=generateTexture(textureSpec(9,60,110));
 assert.ok(bandEnergy(glock,glock.frequency*2.76)>bandEnergy(marimba,marimba.frequency*2.76)*10);
 assert.ok(rms(glock.data,20000,25000)>rms(marimba.data,20000,25000)*2);
});
