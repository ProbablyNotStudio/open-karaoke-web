import {inflateSync} from './vendor/fflate.js';

const MAX_ARCHIVE_BYTES=128*1024*1024;
const table=Uint32Array.from({length:256},(_,value)=>{
  for(let i=0;i<8;i++)value=(value&1)?0xedb88320^(value>>>1):value>>>1;
  return value>>>0;
});
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function archiveInfo(info,safePath){
  if(!info||typeof info!=='object')throw Error('Invalid song archive');
  const path=safePath(info.path);
  if(!path||!path.toLowerCase().endsWith('.zip'))throw Error('Invalid song archive path');
  for(const field of ['offset','length','bytes','crc32'])if(!Number.isSafeInteger(info[field]))throw Error('Invalid song archive offsets');
  if(info.offset<0||info.length<=0||info.bytes<=0||info.length>64*1024*1024||info.bytes>64*1024*1024||info.offset+info.length>MAX_ARCHIVE_BYTES||info.crc32<0||info.crc32>0xffffffff)throw Error('Song archive exceeds supported bounds');
  return {path,offset:info.offset,length:info.length,bytes:info.bytes,crc32:info.crc32};
}
async function readBounded(response,limit){
  const size=Number(response.headers.get('content-length'));
  if(size>limit)throw Error('Song response is larger than expected');
  const reader=response.body?.getReader();
  if(!reader){const buffer=await response.arrayBuffer();if(buffer.byteLength>limit)throw Error('Song response is larger than expected');return new Uint8Array(buffer);}
  const chunks=[];let length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit)throw Error('Song response is larger than expected');chunks.push(value);}}
  catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function readArchiveSong(info,baseURL,fetcher=fetch){
  const url=new URL(info.path.split('/').map(encodeURIComponent).join('/'),baseURL).href;
  const end=info.offset+info.length-1;
  const response=await fetcher(url,{headers:{Range:`bytes=${info.offset}-${end}`},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`Song archive unavailable (${response.status})`);
  let compressed;
  if(response.status===206){
    const range=response.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    if(!range||Number(range[1])!==info.offset||Number(range[2])!==end||Number(range[3])<=end||Number(range[3])>MAX_ARCHIVE_BYTES)throw Error('Invalid song range response');
    compressed=await readBounded(response,info.length);
    if(compressed.length!==info.length)throw Error('Truncated song range');
  }else if(response.status===200){
    // Some hosts ignore Range. Accept a bounded complete archive as a fallback.
    const archive=await readBounded(response,MAX_ARCHIVE_BYTES);
    if(archive.length<=end)throw Error('Truncated song archive');
    compressed=archive.subarray(info.offset,end+1);
  }else throw Error('Unsupported song response');
  const midi=inflateSync(compressed,{out:new Uint8Array(info.bytes)});
  if(midi.length!==info.bytes||crc32(midi)!==info.crc32)throw Error('Song integrity check failed');
  return midi.buffer.slice(midi.byteOffset,midi.byteOffset+midi.byteLength);
}
