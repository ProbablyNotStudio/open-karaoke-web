import {archiveInfo,readArchiveSong} from './cloud.js';
export const SUPPORTED=/\.(mid|midi|kar|mp3|wav|ogg|m4a|mp4|webm|cdg|lrc)$/i;
export const MIDI=/\.(mid|midi|kar)$/i;
export function songFormat(name,hasCDG=false){return MIDI.test(name)?'MIDI':/\.(mp4|webm)$/i.test(name)?'VIDEO':hasCDG?'CDG':'AUDIO';}
export const CATALOG_LIMIT=100000;
export const ARCHIVE_LIMITS={compressed:128*1024*1024,expanded:256*1024*1024,file:64*1024*1024,count:2000};
const types={mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4',mp4:'video/mp4',webm:'video/webm',mid:'audio/midi',midi:'audio/midi',kar:'audio/midi',lrc:'text/plain'};
export const mimeType=path=>types[path.split('.').pop().toLowerCase()]||'application/octet-stream';
export function safePath(path){
  if(typeof path!=='string'||!path||path.includes('\0'))return null;
  path=path.replace(/\\/g,'/');
  if(path.startsWith('/')||/^[a-z]+:/i.test(path))return null;
  const parts=path.split('/');
  if(parts.some(p=>p==='..'||p==='.'||!p)||parts.includes('__MACOSX')||parts.some(p=>p.startsWith('._')))return null;
  return path;
}
export function catalogEntries(catalog,baseURL,fetcher=fetch){
  if(!catalog||!Array.isArray(catalog.files)||catalog.files.length>CATALOG_LIMIT)throw Error('Invalid bundled song catalog');
  const seen=new Set();
  return catalog.files.map(item=>{
    const metadata=typeof item==='string'?{}:item,path=safePath(typeof item==='string'?item:item?.path);
    if(!path||!SUPPORTED.test(path))throw Error('Invalid bundled song path');
    if(seen.has(path.toLowerCase()))throw Error('Duplicate bundled song path');seen.add(path.toLowerCase());
    const url=new URL(path.split('/').map(encodeURIComponent).join('/'),baseURL).href;
    const get=async()=>{const r=await fetcher(url);if(!r.ok)throw Error(`Cannot load ${path} (${r.status})`);return r;};
    const archive=metadata.zip?archiveInfo(metadata.zip,safePath):null;
    if(archive&&!MIDI.test(path))throw Error('Archived catalog entries must be MIDI');
    const file=archive?{name:path.split('/').pop(),type:mimeType(path),arrayBuffer:()=>readArchiveSong(archive,baseURL,fetcher)}:{name:path.split('/').pop(),url,type:mimeType(path),arrayBuffer:async()=>(await get()).arrayBuffer(),text:async()=>(await get()).text()};
    const details={};for(const key of ['number','title','artist'])if(typeof metadata[key]==='string')details[key]=metadata[key];
    return {file,path,source:'default',deferMidi:true,details};
  });
}
export function unpackZip(file){
  if(file.size>ARCHIVE_LIMITS.compressed)return Promise.reject(Error('ZIP is larger than 128 MB. Split it into smaller archives.'));
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./zip-worker.js?v=29',import.meta.url),{type:'module'});
    let finished=false;
    const finish=(error,entries)=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();error?reject(error):resolve(entries);};
    const timer=setTimeout(()=>finish(Error('ZIP extraction took too long. Try a smaller archive.')),20000);
    worker.onerror=()=>finish(Error('ZIP extraction is unavailable. Try individual files or a folder.'));
    worker.onmessage=event=>{const {error,entries,issues=[]}=event.data;if(error){finish(Error(error));return;}
      const extracted=entries.map(({path,bytes})=>({file:new File([bytes],path.split('/').pop(),{type:mimeType(path)}),buffer:bytes.byteOffset===0&&bytes.byteLength===bytes.buffer.byteLength?bytes.buffer:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),path:`zip/${file.name}/${path}`,source:'local'}));
      extracted.issues=issues.map(issue=>({...issue,path:`${file.name} / ${issue.path}`}));finish(null,extracted);
    };
    file.arrayBuffer().then(buffer=>{if(!finished)worker.postMessage(buffer,[buffer]);}).catch(error=>finish(error));
  });
}
