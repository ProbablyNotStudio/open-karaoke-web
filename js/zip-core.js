import {unzipSync} from './vendor/fflate.js';
import {SUPPORTED,safePath,ARCHIVE_LIMITS} from './library.js';
function validateArchive(bytes,limits){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(view.getUint32(p,true)===0x06054b50&&p+22+view.getUint16(p+20,true)===bytes.length){end=p;break;}
  if(end<0)throw Error('Invalid or incomplete ZIP');
  if(view.getUint16(end+4,true)||view.getUint16(end+6,true))throw Error('Split ZIP archives are not supported');
  const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true),offset=view.getUint32(end+16,true);
  if(count===65535||size===0xffffffff||offset===0xffffffff)throw Error('ZIP64 archives are not supported. Use a smaller standard ZIP.');
  if(count>limits.count)throw Error('ZIP contains too many files (maximum 2,000)');
  if(offset+size>end)throw Error('Invalid ZIP directory');
  let p=offset;
  for(let i=0;i<count;i++){
    if(p+46>offset+size||view.getUint32(p,true)!==0x02014b50)throw Error('Invalid ZIP file entry');
    if(view.getUint16(p+8,true)&65)throw Error('Password-protected ZIPs are not supported. Use an unencrypted ZIP.');
    p+=46+view.getUint16(p+28,true)+view.getUint16(p+30,true)+view.getUint16(p+32,true);
    if(p>offset+size)throw Error('Invalid ZIP filename or metadata');
  }
}
export function extractSongReport(buffer,limits=ARCHIVE_LIMITS){
  const bytes=new Uint8Array(buffer);if(bytes.length>limits.compressed)throw Error('ZIP exceeds the compressed size limit');
  validateArchive(bytes,limits);let total=0,count=0;const seen=new Set(),issues=[];
  const unpacked=unzipSync(bytes,{filter:entry=>{
    if(++count>limits.count)throw Error('ZIP contains too many files (maximum 2,000)');
    if(entry.name.endsWith('/')||entry.name.includes('__MACOSX')||entry.name.split('/').pop().startsWith('._'))return false;
    const path=safePath(entry.name);
    if(!path){issues.push({path:entry.name,reason:'Unsafe file path. Repack this file without parent or absolute folders.',status:'Skipped'});return false;}
    if(!SUPPORTED.test(path)){
      if(!/(^|\/)(readme|license|licence)(\.[^/]*)?$/i.test(path))issues.push({path,reason:/\.zip$/i.test(path)?'Nested ZIPs are not opened. Extract this ZIP and add its files separately.':'Unsupported song format. Use MIDI/KAR, audio, video, CDG or LRC files.',status:'Skipped'});
      return false;
    }
    if(seen.has(path.toLowerCase()))throw Error('ZIP has duplicate song filenames in the same folder');seen.add(path.toLowerCase());
    if(!Number.isSafeInteger(entry.originalSize)||entry.originalSize>limits.file)throw Error('A song in this ZIP is larger than 64 MB. Import large media separately.');
    total+=entry.originalSize;if(total>limits.expanded)throw Error('ZIP expands beyond 256 MB. Split it into smaller archives.');
    return true;
  }});
  const entries=Object.entries(unpacked).map(([path,bytes])=>({path:safePath(path),bytes}));
  if(!entries.length)throw Error('No supported song files found in this ZIP');
  return {entries,issues};
}
export const extractSongs=(buffer,limits=ARCHIVE_LIMITS)=>extractSongReport(buffer,limits).entries;
