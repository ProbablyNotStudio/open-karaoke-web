// Destructure immediately so the closure never retains the original Blob.
export function storedFile({id,file:{name,size,type,lastModified}},read,store='songs'){
 const blob=async()=>{
  const saved=await read(store,id);
  if(!saved?.file)throw Error('Saved song is unavailable. Add this file again.');
  return saved.file;
 };
 return {name,size,type,lastModified,blob,async arrayBuffer(){return (await blob()).arrayBuffer();},async text(){return (await blob()).text();}};
}
export const storedMidiFile=storedFile;
export const fileBlob=file=>typeof file.blob==='function'?file.blob():Promise.resolve(file);
export async function fileDigest(file,buffer){
 const bytes=buffer||await file.arrayBuffer();
 const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}
