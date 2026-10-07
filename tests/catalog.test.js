import {test} from 'node:test';import assert from 'node:assert/strict';import {catalogLetter,songbookPage} from '../js/catalog.js';
test('songbook letters handle accents, numbers and symbols',()=>{assert.equal(catalogLetter('Écho'),'E');assert.equal(catalogLetter('123 Go'),'#');assert.equal(catalogLetter('  apple'),'A');assert.equal(catalogLetter(''),'#');});
test('songbook filters titles by letter and paginates in natural title order',()=>{
 const songs=[{id:'1',title:'Apple 10',artist:'Singer',number:'10'},{id:'2',title:'Apple 2',artist:'Other',number:'2'},{id:'3',title:'Banana',artist:'Singer',number:'3'}];
 assert.deepEqual(songbookPage(songs,{letter:'A',size:1}).rows.map(s=>s.id),['2']);
 assert.deepEqual(songbookPage(songs,{letter:'A',size:1,page:1}).rows.map(s=>s.id),['1']);
 assert.equal(songbookPage(songs,{letter:'B',query:'Singer'}).total,1);assert.equal(songbookPage([]).pages,1);
});
