// Synthetic metadata only: does not read or modify a user's saved songs.
import {performance} from 'node:perf_hooks';
import {createSongOrder,libraryPage,searchText} from '../js/search.js';
const songs=Array.from({length:50000},(_,i)=>{const song={id:String(i),number:String(i),title:`Song ${i}`,artist:i%5?'Singer':'Summer Singer',format:'MIDI'};song.searchText=searchText(song);return song;});
const order=createSongOrder(()=>songs),ordered=order.get();
// Previous release's ordered pagination scanned and allocated on every page.
const beforePage=(query,page)=>{const term=query.toLocaleLowerCase().trim(),matches=ordered.filter(song=>!term||song.searchText.includes(term));const index=Math.min(Math.max(0,Math.ceil(matches.length/50)-1),page);return matches.slice(index*50,(index+1)*50);};
for(const query of ['', 'summer']){
 order.page({query});
 const run=page=>{const start=performance.now();for(let index=0;index<200;index++)page(index);return +(performance.now()-start).toFixed(3);};
 const beforeMs=run(page=>beforePage(query,page)),uncachedMs=run(page=>libraryPage(ordered,{query,page,ordered:true})),cachedMs=run(page=>order.page({query,page}));
 console.log(JSON.stringify({songs:songs.length,query,pages:200,beforeMs,uncachedMs,cachedMs}));
}
