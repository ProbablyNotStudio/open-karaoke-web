// Normalize bounded legacy events for both the parser and the sampled engine.
// Never guess missing track bytes or missing initial channel status.
export function repairLegacyMidi(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let p=0,running=0,repairs=0,skipped=0,notes=0;
 const take=n=>{if(p+n>bytes.length)throw Error('Truncated MIDI file');const start=p;p+=n;return bytes.subarray(start,p);};
 const u8=()=>take(1)[0],u32=()=>{const start=p;take(4);return view.getUint32(start);};
 const tag=()=>String.fromCharCode(...take(4));
 const vlq=()=>{let value=0;for(let i=0;i<4;i++){const b=u8();value=value*128+(b&127);if(!(b&128))return value;}throw Error('Invalid MIDI variable length');};
 const encode=value=>{if(value>0x0fffffff)throw Error('Invalid MIDI delta time');const result=[value&127];while(value>>=7)result.unshift((value&127)|128);return result;};
 if(tag()!=='MThd')throw Error('This is not a standard MIDI file');const header=u32();if(header<6)throw Error('Invalid MIDI header');take(header);
 const tracks=view.getUint16(10),chunks=[bytes.slice(0,p)];
 for(let track=0;track<tracks;track++){
  if(tag()!=='MTrk')throw Error('Missing MIDI track');const size=u32(),end=p+size;if(end>bytes.length)throw Error('Truncated MIDI file');
  const output=[];let pending=0,ended=false;running=0;
  const emit=data=>{output.push(...encode(pending));pending=0;for(const value of data)output.push(value);};
  const bounded=n=>{if(p+n>end)throw Error('Truncated MIDI track');return take(n);};
  while(p<end){
   pending+=vlq();let status=u8();if(p>end)throw Error('Truncated MIDI track');
   if(status<128){if(!running)throw Error('Invalid MIDI running status');p--;status=running;}
   if(status===255){
    const type=u8(),length=vlq(),data=bounded(length);emit([255,type,...encode(length)]);for(const b of data)output.push(b);
    // A number of old KAR writers keep channel status across lyric metadata.
    if(running)repairs++;
    if(type===47){ended=true;p=end;break;}
   }else if(status===240||status===247){const length=vlq(),data=bounded(length);running=0;emit([status,...encode(length)]);for(const b of data)output.push(b);}
   else{
    if(status>=240)throw Error('Unsupported MIDI system message');running=status;
    const type=status>>4,a=bounded(1)[0],b=type===12||type===13?null:bounded(1)[0];
    if(a>127||(b!==null&&b>127)){
     // Recover only an unmistakable end-of-track marker at the track boundary.
     if(b===255&&p===end-2&&bytes[p]===47&&bytes[p+1]===0){emit([255,47,0]);p=end;ended=true;repairs++;break;}
     if(++skipped>1000)throw Error('Too many invalid MIDI events');repairs++;continue;
    }
    if(type===9&&b)notes++;emit(b===null?[status,a]:[status,a,b]);
   }
  }
  if(!ended)throw Error('Missing MIDI end-of-track event');
  const chunk=new Uint8Array(8+output.length);chunk.set([77,84,114,107]);new DataView(chunk.buffer).setUint32(4,output.length);chunk.set(output,8);chunks.push(chunk);
 }
 if(!repairs||!notes)throw Error('No supported MIDI compatibility repair');
 const result=new Uint8Array(chunks.reduce((sum,chunk)=>sum+chunk.length,0));let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}
 return {buffer:result.buffer,skipped};
}
