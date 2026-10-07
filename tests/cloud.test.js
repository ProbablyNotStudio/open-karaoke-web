import {test} from 'node:test';import assert from 'node:assert/strict';
import {deflateSync,strToU8} from '../js/vendor/fflate.js';
import {archiveInfo,readArchiveSong,crc32} from '../js/cloud.js';
import {safePath,catalogEntries,CATALOG_LIMIT} from '../js/library.js';
import {libraryPage,searchText} from '../js/search.js';
import {decodeMidiText} from '../js/formats.js';
const data=strToU8('sample song data'),compressed=deflateSync(data);
const info={path:'packs/songs-000.zip',offset:44,length:compressed.length,bytes:data.length,crc32:crc32(data)};
const response=()=>new Response(compressed,{status:206,headers:{'Content-Range':`bytes 44-${44+compressed.length-1}/1000`}});
test('CRC32 matches a standard checksum vector',()=>assert.equal(crc32(strToU8('123456789')),0xcbf43926));
test('archive validates safe paths and bounded integer offsets',()=>{
 assert.deepEqual(archiveInfo(info,safePath),info);
 for(const invalid of [{path:'../a.zip'},{path:'https://outside.test/a.zip'},{offset:-1},{bytes:0},{length:128*1024*1024},{crc32:-1},{offset:1.5}])assert.throws(()=>archiveInfo({...info,...invalid},safePath));
});
test('cloud song fetches only its exact byte range and verifies decompressed data',async()=>{
 let calls=0;const buffer=await readArchiveSong(info,'https://media.example/',async(url,options)=>{calls++;assert.equal(url,'https://media.example/packs/songs-000.zip');assert.equal(options.headers.Range,`bytes=44-${44+compressed.length-1}`);return response();});
 assert.deepEqual(new Uint8Array(buffer),data);assert.equal(calls,1);
});
test('host ignoring Range can return a bounded complete archive',async()=>{
 const whole=new Uint8Array(info.offset+info.length+10);whole.set(compressed,info.offset);
 assert.deepEqual(new Uint8Array(await readArchiveSong(info,'https://media.example/',async()=>new Response(whole))),data);
});
test('cloud rejects wrong ranges, corrupt data, oversized and missing responses',async()=>{
 await assert.rejects(readArchiveSong(info,'https://media.example/',async()=>new Response(compressed,{status:206})),/range/);
 await assert.rejects(readArchiveSong({...info,crc32:0},'https://media.example/',async()=>response()),/integrity/);
 await assert.rejects(readArchiveSong(info,'https://media.example/',async()=>new Response(compressed,{headers:{'Content-Length':200000000}})),/larger/);
 await assert.rejects(readArchiveSong(info,'https://media.example/',async()=>new Response('Not found',{status:404})),/404/);
});
test('large catalog remains lazy and has a limit independent of local ZIP uploads',()=>{
 const files=Array.from({length:42756},(_,i)=>({path:`midi/${i}.mid`,number:String(i),title:`Song ${i}`,artist:'Singer',zip:info}));
 const entries=catalogEntries({files},'https://media.example/',()=>{throw Error('Fetched eagerly');});assert.equal(entries.length,42756);assert.equal(entries[42000].details.title,'Song 42000');
 assert.throws(()=>catalogEntries({files:Array(CATALOG_LIMIT+1).fill('song.mid')},'https://media.example/'));
 assert.throws(()=>catalogEntries({files:[{path:'song.mp3',zip:info}]},'https://media.example/'),/MIDI/);
});
test('search paginates 42k songs and finds late entries by title artist or number',()=>{
 const songs=Array.from({length:42756},(_,i)=>({id:String(i),number:String(i).padStart(5,'0'),title:`Song ${i}`,artist:i===42000?'Café singer':'Artist',format:'MIDI'}));for(const song of songs)song.searchText=searchText(song);
 let page=libraryPage(songs);assert.equal(page.rows.length,50);assert.equal(page.total,42756);assert.equal(page.pages,856);
 page=libraryPage(songs,{page:9999});assert.equal(page.page,855);assert.equal(page.rows.length,6);
 page=libraryPage(songs,{query:'cafe singer'});assert.equal(page.total,1);assert.equal(page.rows[0].number,'42000');
 assert.equal(libraryPage(songs,{query:'Song 42755'}).rows[0].id,'42755');
 assert.equal(libraryPage(songs,{favoriteOnly:true,favorites:new Set(['42000']),page:800}).page,0);
 assert.equal(libraryPage(songs,{format:'CDG'}).total,0);
});
test('MIDI text keeps UTF-8 and supports legacy Western and explicit Asian encodings',()=>{
 assert.equal(decodeMidiText(strToU8('你好 café')),'你好 café');
 assert.equal(decodeMidiText(new Uint8Array([0x63,0x61,0x66,0xe9])),'café');
 assert.equal(decodeMidiText(new Uint8Array([0xc4,0xe3,0xba,0xc3]),'gbk'),'你好');
});
