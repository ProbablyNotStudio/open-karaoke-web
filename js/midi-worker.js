import {parseMidi} from './formats.js?v=33';
self.onmessage=({data})=>{
 try{const song=parseMidi(data.buffer,data.options);self.postMessage({song},[song.buffer]);}
 catch(error){self.postMessage({error:error.message});}
};
