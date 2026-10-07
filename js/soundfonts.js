export const MAX_SOUNDFONT_BYTES=1024*1024*1024;
export function validateSoundFontHeader(buffer,size=buffer.byteLength){
  if(buffer.byteLength<12||size<12||size>MAX_SOUNDFONT_BYTES)throw Error('Choose a SoundFont up to 1 GB (1,024 MB).');
  const data=new DataView(buffer),bytes=new Uint8Array(buffer),tag=i=>String.fromCharCode(...bytes.subarray(i,i+4));
  if(tag(0)!=='RIFF'||tag(8)!=='sfbk'||data.getUint32(4,true)+8!==size)throw Error('This file is not a valid SF2 SoundFont.');
  return buffer;
}
export const validateSoundFont=buffer=>validateSoundFontHeader(buffer);
export async function downloadSoundFont(entry,{signal,onProgress=()=>{},fetcher=fetch}={}){
  if(!Number.isSafeInteger(entry.bytes)||entry.bytes<12||entry.bytes>MAX_SOUNDFONT_BYTES)throw Error('SoundFont exceeds the 1 GB limit.');
  const url=new URL(entry.url);if(url.protocol!=='https:')throw Error('SoundFonts must use HTTPS.');
  const response=await fetcher(url,{signal});if(!response.ok)throw Error(`SoundFont unavailable (${response.status}).`);
  // Content-Length can describe compressed transport bytes. Validate decoded
  // stream length and the SF2 RIFF header instead, retaining the hard byte cap.
  const reader=response.body.getReader(),buffer=new Uint8Array(entry.bytes);let offset=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;if(offset+value.length>buffer.length)throw Error('SoundFont download is larger than expected.');buffer.set(value,offset);offset+=value.length;onProgress(offset/buffer.length);}}
  catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}
  if(offset!==buffer.length)throw Error('SoundFont download was incomplete.');
  return validateSoundFont(buffer.buffer);
}
