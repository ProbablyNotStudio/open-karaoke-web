import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSongOrder,libraryPage,searchText} from '../js/search.js';
const makeSongs=()=>Array.from({length:1000},(_,i)=>({id:String(i),number:String(i),title:`Song ${i}`,artist:i%2?'Singer':'Summer Singer',format:i%3?'MIDI':'AUDIO'}));
test('page navigation does not rescan cached results; longer queries narrow the prior results',()=>{
 let reads=0;const songs=makeSongs();for(const song of songs){const text=searchText(song);Object.defineProperty(song,'searchText',{get(){reads++;return text;}});}
 const order=createSongOrder(()=>songs);order.page({query:'summer',size:10});const scanned=reads;assert.equal(scanned,1000);
 for(let page=1;page<20;page++)order.page({query:'SUMMER',size:10,page});assert.equal(reads,scanned);
 order.page({query:'summer singer',size:10});assert.equal(reads-scanned,500);
});
test('cached search matches uncached results for filters, page bounds, accents and sort order',()=>{
 const songs=makeSongs();songs[2].title='Café';const order=createSongOrder(()=>songs),favorites=new Set(['2','4','6']);
 for(const options of [{},{query:'song'},{query:'song 2'},{query:'song',format:'MIDI'},{query:'cafe'},{favoriteOnly:true,favorites},{letter:'S',query:'summer'},{letter:'C'},{sort:'artist',query:'summer'},{sort:'number',query:'summer'}]){
  for(const page of [0,1,9,999])assert.deepEqual(order.page({...options,page,size:7}),libraryPage(songs,{...options,page,size:7}));
 }
});
test('favorites edits with unchanged count and metadata invalidation refresh cached matches',()=>{
 const songs=makeSongs(),order=createSongOrder(()=>songs),favorites=new Set(['2']);
 assert.equal(order.page({favoriteOnly:true,favorites}).rows[0].id,'2');favorites.delete('2');favorites.add('3');assert.equal(order.page({favoriteOnly:true,favorites}).rows[0].id,'3');
 order.page({query:'renamed'});songs[3].title='Renamed';songs[3].searchText=searchText(songs[3]);order.invalidate();assert.equal(order.page({query:'renamed'}).rows[0].id,'3');
 songs.splice(3,1);order.invalidate();assert.equal(order.page({query:'renamed'}).total,0);
});
test('bounded search cache releases old queries and does not mutate source order',()=>{
 let reads=0;const songs=makeSongs();for(const song of songs){const text=searchText(song);Object.defineProperty(song,'searchText',{get(){reads++;return text;}});}
 const original=songs.map(song=>song.id),order=createSongOrder(()=>songs);
 for(const query of ['summer','singer','song 1','song 2'])order.page({query});const before=reads;order.page({query:'summer'});assert.equal(reads-before,1000);assert.deepEqual(songs.map(song=>song.id),original);
});
