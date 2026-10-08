import {extractSongReport} from './zip-core.js?v=39';
self.onmessage=event=>{
  try{const {entries,issues}=extractSongReport(event.data);self.postMessage({entries,issues},entries.map(e=>e.bytes.buffer));}
  catch(error){self.postMessage({error:'Cannot import ZIP: '+error.message});}
};
