import {repairLegacyMidi} from './midi-repair.js?v=33';
export function parseName(name, fallback=1) {
  const stem=name.replace(/\.[^.]+$/, '');
  const parts=stem.split(/\s+-\s+/);
  const number=/^\d+$/.test(parts[0]) ? parts.shift() : String(fallback).padStart(5,'0');
  return {number, title:parts.shift() || stem, artist:parts.join(' - ') || 'Unknown artist'};
}
export function parseLRC(text) {
  const offset=Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1]||0)/1000;
  return text.split(/\r?\n/).flatMap(line=>{
    const times=[...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const words=line.replace(/\[[^\]]*\]/g,'').trim();
    return times.map(m=>({time:Math.max(0,Number(m[1])*60+Number(m[2])+offset),text:words}));
  }).sort((a,b)=>a.time-b.time);
}
export function decodeMidiText(bytes,encoding='auto'){
  if(encoding!=='auto')return new TextDecoder(encoding).decode(bytes);
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('windows-1252').decode(bytes);}
}
function midiMetadata(events){
  const headers=events.filter(e=>e.tick===0);
  const titles=headers.filter(e=>e.type===1&&e.text.startsWith('@T')).map(e=>e.text.slice(2).trim()).filter(Boolean);
  const marker=headers.find(e=>e.type===6&&/^.+\s+\([^()]+\)\s*$/.test(e.text.trim()))?.text.trim();
  const match=marker?.match(/^(.+?)\s+\(([^()]+)\)\s*$/);
  return titles.length?{title:titles[0],...(titles[1]?{artist:titles[1]}:{})}:match?{title:match[1],artist:match[2]}:{};
}
export function parseMidi(buffer,options={}){
 try{return parseStandardMidi(buffer,options);}catch(error){
  if(options.strict||!/^Invalid MIDI (event|running status)$/.test(error.message))throw error;
  try{const repaired=repairLegacyMidi(buffer),song=parseStandardMidi(repaired.buffer,options);song.compatibility={skippedEvents:repaired.skipped};return song;}catch{throw error;}
 }
}
function parseStandardMidi(buffer,{textEncoding='auto',metadataOnly=false}={}) {
  const bytes=new Uint8Array(buffer), view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let p=0;
  const check=n=>{if(p+n>bytes.length)throw Error('Truncated MIDI file');};
  const u8=()=>{check(1);return bytes[p++];};
  const u16=()=>{check(2);const v=view.getUint16(p);p+=2;return v;};
  const u32=()=>{check(4);const v=view.getUint32(p);p+=4;return v;};
  const tag=()=>String.fromCharCode(u8(),u8(),u8(),u8());
  const vlq=()=>{let v=0;for(let i=0;i<4;i++){const b=u8();v=v*128+(b&127);if(!(b&128))return v;}throw Error('Invalid MIDI variable length');};
  if(tag()!=='MThd')throw Error('This is not a standard MIDI file');
  const header=u32();if(header<6)throw Error('Invalid MIDI header');
  const format=u16(),tracks=u16(),division=u16();
  if(format>1)throw Error('MIDI format 2 is not supported; export as format 0 or 1');
  if(!division||(division&0x8000))throw Error('SMPTE MIDI timing is not supported; export with musical tick timing');
  p+=header-6;check(0);
  const events=[];let order=0;
  for(let track=0;track<tracks;track++){
    if(tag()!=='MTrk')throw Error('Missing MIDI track');
    const size=u32(),end=p+size;check(size);let tick=0,running=0;
    while(p<end){
      tick+=vlq();let status=u8();
      if(status<128){if(!running)throw Error('Invalid MIDI running status');p--;status=running;}
      if(status===255){
        running=0;const type=u8(),length=vlq();if(p+length>end)throw Error('Invalid MIDI meta length');
        const data=bytes.slice(p,p+length);p+=length;
        if(!metadataOnly&&type===81&&length===3)events.push({tick,order:order++,kind:'tempo',tempo:data[0]*65536+data[1]*256+data[2]});
        if([1,3,5,6].includes(type)&&(!metadataOnly||tick===0))events.push({tick,order:order++,kind:'text',type,lyric:type===5,track,text:decodeMidiText(data,textEncoding)});
        if(type===47){if(!metadataOnly)events.push({tick,order:order++,kind:'end'});p=end;break;}
      }else if(status===240||status===247){running=0;const length=vlq();if(p+length>end)throw Error('Invalid MIDI SysEx length');p+=length;}
      else {
        if(status>=240)throw Error('Unsupported MIDI system message');
        running=status;const type=status>>4,ch=status&15,a=u8(),b=type===12||type===13?0:u8();
        if(a>127||b>127||p>end)throw Error('Invalid MIDI event');
        if(!metadataOnly)events.push({tick,order:order++,kind:'channel',type,ch,a,b});
      }
    }
  }
  if(metadataOnly)return {buffer,metadata:midiMetadata(events)};
  events.sort((a,b)=>a.tick-b.tick||a.order-b.order);
  let seconds=0,lastTick=0,tempo=500000;
  for(const e of events){seconds+=(e.tick-lastTick)*tempo/1e6/division;e.time=seconds;lastTick=e.tick;if(e.kind==='tempo'&&e.tempo>0)tempo=e.tempo;}
  const channels=Array.from({length:16},()=>({program:0,volume:100,expression:127,pan:64,bend:0,sustain:false}));
  const active=new Map(),notes=[];
  const endNote=(n,t)=>{n.end=Math.max(n.time+.01,t);notes.push(n);};
  for(const e of events){
    if(e.kind!=='channel')continue;
    const c=channels[e.ch],key=e.ch+':'+e.a;
    if(e.type===12)c.program=e.a;
    if(e.type===14)c.bend=((e.b*128+e.a)-8192)/8192*2;
    if(e.type===11){
      if(e.a===7)c.volume=e.b;if(e.a===10)c.pan=e.b;if(e.a===11)c.expression=e.b;
      if(e.a===64){c.sustain=e.b>=64;if(!c.sustain)for(const [k,n] of active)if(n.ch===e.ch&&n.released){endNote(n,e.time);active.delete(k);}}
      if(e.a===120||e.a===123)for(const [k,n] of active)if(n.ch===e.ch){endNote(n,e.time);active.delete(k);}
    }
    if(e.type===9&&e.b){
      if(active.has(key))endNote(active.get(key),e.time);
      active.set(key,{time:e.time,end:0,ch:e.ch,pitch:e.a,velocity:e.b,...c});
    }
    if(e.type===8||(e.type===9&&!e.b)){const n=active.get(key);if(n){if(c.sustain)n.released=true;else {endNote(n,e.time);active.delete(key);}}}
  }
  for(const n of active.values())endNote(n,seconds);
  notes.sort((a,b)=>a.time-b.time);
  const metadata=midiMetadata(events.filter(e=>e.kind==='text'));
  const texts=events.filter(e=>e.kind==='text'&&[1,5].includes(e.type));
  const lyricEvents=texts.some(e=>e.lyric)?texts.filter(e=>e.lyric):texts;
  const lyrics=[];let line=null;
  for(const e of lyricEvents){
    let text=e.text;if(!text||text.startsWith('@')||/^#+$/.test(text.trim()))continue;
    const segments=text.split(/([\/\\\r\n])/);
    for(const s of segments){
      if(/^[\/\\\r\n]$/.test(s)){line=null;continue;}
      if(!s)continue;
      if(!line){line={time:e.time,text:'',words:[]};lyrics.push(line);}
      line.words.push({time:e.time,text:s});line.text+=s;
    }
  }
  const duration=notes.reduce((max,n)=>Math.max(max,n.end),Math.max(seconds,.1));
  return {format,tracks,division,notes,lyrics,duration,buffer,metadata};
}
