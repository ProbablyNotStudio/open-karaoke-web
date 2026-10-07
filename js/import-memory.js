// Keep a small descriptor in the library; read saved MIDI bytes only on demand.
export function storedMidiFile(record,read){
 const {name,size,type,lastModified}=record.file,id=record.id;
 return {name,size,type,lastModified,async arrayBuffer(){
  const saved=await read('songs',id);
  if(!saved?.file)throw Error('Saved song is unavailable. Add this file again.');
  return saved.file.arrayBuffer();
 }};
}
export async function fileDigest(file,buffer){
 const bytes=buffer||await file.arrayBuffer();
 const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}
