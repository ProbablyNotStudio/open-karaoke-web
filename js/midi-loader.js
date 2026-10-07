export function readMidi(file,options,{signal,timeout=20000,workerFactory=()=>new Worker(new URL('./midi-worker.js?v=29',import.meta.url),{type:'module'})}={}){
 return new Promise((resolve,reject)=>{
  let worker,settled=false;
  const finish=(error,song)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker?.terminate();error?reject(error):resolve(song);};
  const abort=()=>finish(new DOMException('Song loading canceled.','AbortError'));
  const timer=setTimeout(()=>finish(Error('Reading this MIDI took too long. Try adding a fresh copy.')),timeout);
  if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
  file.arrayBuffer().then(buffer=>{
   if(settled)return;
   try{worker=workerFactory();worker.onmessage=({data})=>finish(data.error?Error(data.error):null,data.song);worker.onerror=()=>finish(Error('Could not read this MIDI. Try adding it again.'));worker.postMessage({buffer,options},[buffer]);}
   catch(error){finish(error);}
  },error=>finish(error));
 });
}
