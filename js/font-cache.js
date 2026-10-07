import {validateSoundFont} from './soundfonts.js?v=30';
// Keep a Blob rather than a worker-transferable ArrayBuffer. Each engine gets
// fresh bytes, while changing instruments can safely reuse the saved download.
export async function cachedSoundFont(font,{read,write,download,onCached=()=>{},onSaveFailure=()=>{}}){
 const id='hosted:'+font.id;
 let cached=font.cachedFile;
 if(!cached){try{const record=await read(id);if(record?.url===font.url&&record.bytes===font.bytes)cached=record.file;}catch{}}
 if(cached){
  try{const buffer=validateSoundFont(await cached.arrayBuffer());if(buffer.byteLength!==font.bytes)throw Error('Saved SoundFont size changed');font.cachedFile=cached;onCached();return buffer;}
  catch{delete font.cachedFile;}
 }
 const buffer=await download(font);
 validateSoundFont(buffer);if(buffer.byteLength!==font.bytes)throw Error('SoundFont size changed');
 const file=new Blob([buffer],{type:'application/octet-stream'});
 font.cachedFile=file;
 try{await write({id,hosted:true,url:font.url,bytes:font.bytes,file});}catch{onSaveFailure();}
 return buffer;
}
