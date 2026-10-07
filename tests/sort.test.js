import {test} from 'node:test';import assert from 'node:assert/strict';
import {libraryPage} from '../js/search.js';
const songs=[{id:'a',title:'Song 10',artist:'Zulu',number:'10',format:'MIDI'},{id:'b',title:'song 2',artist:'Alpha',number:'2',format:'MIDI'},{id:'c',title:'Another',artist:'Beta',number:'1',format:'AUDIO'}];
test('catalog uses natural alphanumeric order before pagination without changing input',()=>{
 assert.deepEqual(libraryPage(songs,{size:2}).rows.map(s=>s.id),['c','b']);
 assert.deepEqual(libraryPage(songs,{size:2,page:1}).rows.map(s=>s.id),['a']);
 assert.deepEqual(songs.map(s=>s.id),['a','b','c']);
 assert.deepEqual(libraryPage(songs,{sort:'artist'}).rows.map(s=>s.id),['b','c','a']);
 assert.deepEqual(libraryPage(songs,{sort:'number'}).rows.map(s=>s.id),['c','b','a']);
 assert.deepEqual(libraryPage(songs,{format:'MIDI',sort:'title'}).rows.map(s=>s.id),['b','a']);
});
