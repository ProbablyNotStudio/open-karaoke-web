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
