import {test} from 'node:test';import assert from 'node:assert/strict';
import {zipSync,strToU8} from '../js/vendor/fflate.js';
import {catalogEntries,safePath,ARCHIVE_LIMITS,songFormat} from '../js/library.js';import {extractSongs,extractSongReport} from '../js/zip-core.js';
test('imported songs have a playback type before pairing finishes',()=>{
 for(const name of ['20554.mid','folder/Track.MIDI','Song.KAR'])assert.equal(songFormat(name),'MIDI');
 assert.equal(songFormat('Song.mid',true),'MIDI');assert.equal(songFormat('Song.mp3',true),'CDG');
 assert.equal(songFormat('Song.mp3'),'AUDIO');assert.equal(songFormat('Song.webm',true),'VIDEO');
});
test('ZIP extracts supported songs and preserves matching folder paths',()=>{
 const archive=zipSync({'songs/Track.MID':strToU8('midi'),'songs/Other.mp3':strToU8('audio'),'songs/Other.cdg':strToU8('graphics'),'songs/Other.lrc':strToU8('lyrics'),'readme.txt':strToU8('instructions'),'nested.zip':strToU8('archive')});
 const entries=extractSongs(archive);assert.deepEqual(entries.map(e=>e.path),['songs/Track.MID','songs/Other.mp3','songs/Other.cdg','songs/Other.lrc']);assert.equal(new TextDecoder().decode(entries[1].bytes),'audio');
});
test('stored and deflated ZIP files work',()=>{for(const level of [0,6])assert.equal(extractSongs(zipSync({'Song.mid':strToU8('notes')},{level}))[0].bytes.length,5);});
test('ZIP rejects traversal, ignores metadata and unsupported content',()=>{
 const archive=zipSync({'../Song.mid':strToU8('bad'),'__MACOSX/._Song.mid':strToU8('bad'),'folder/._Song.mid':strToU8('bad'),'good/Song.mid':strToU8('good'),'run.js':strToU8('bad')});
 assert.deepEqual(extractSongs(archive).map(e=>e.path),['good/Song.mid']);
});
test('ZIP rejects invalid data and archives with no playable formats',()=>{assert.throws(()=>extractSongs(new Uint8Array([1,2,3])),/Invalid/);assert.throws(()=>extractSongs(zipSync({'readme.txt':strToU8('notes')})),/No supported/);});
test('ZIP limits are enforced before extraction',()=>{
 const archive=zipSync({'a.mid':strToU8('123456'),'b.mid':strToU8('123456')});
 assert.throws(()=>extractSongs(archive,{...ARCHIVE_LIMITS,file:5}),/64 MB/);
 assert.throws(()=>extractSongs(archive,{...ARCHIVE_LIMITS,expanded:10}),/256 MB/);
 assert.throws(()=>extractSongs(archive,{...ARCHIVE_LIMITS,count:1}),/too many/);
 assert.throws(()=>extractSongs(archive,{...ARCHIVE_LIMITS,compressed:10}),/compressed/);
});
test('ZIP password flags and ambiguous filenames are rejected',()=>{
 const archive=zipSync({'Song.mid':strToU8('notes')});const view=new DataView(archive.buffer);let central=0;while(view.getUint32(central,true)!==0x02014b50)central++;view.setUint16(central+8,1,true);
 assert.throws(()=>extractSongs(archive),/Password/);assert.throws(()=>extractSongs(zipSync({'Song.mid':strToU8('a'),'song.MID':strToU8('b')})),/duplicate/);
});
test('default catalog preserves metadata and safely encodes repository paths',async()=>{
 const urls=[];const entries=catalogEntries({files:[{path:'songs/01 - Hello #1.mid',title:'Hello',artist:'Singer',number:'42'}]},'https://example.com/karaoke/',async url=>{urls.push(url);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};});
 assert.equal(entries[0].source,'default');assert.equal(entries[0].deferMidi,true);assert.equal(entries[0].details.number,'42');assert.equal(entries[0].file.name,'01 - Hello #1.mid');assert.equal(urls.length,0);await entries[0].file.arrayBuffer();assert.equal(urls[0],'https://example.com/karaoke/songs/01%20-%20Hello%20%231.mid');
});
test('catalog rejects outside paths, duplicates and unsupported formats',()=>{
 for(const path of ['../song.mid','https://example.com/song.mid','/song.mid','song.js'])assert.throws(()=>catalogEntries({files:[path]},'https://example.com/site/'));
 assert.throws(()=>catalogEntries({files:['Song.mid','song.mid']},'https://example.com/site/'),/Duplicate/);assert.equal(safePath('album\\Song.mid'),'album/Song.mid');
});

test('ZIP report preserves good songs and identifies skipped entries by archive path',()=>{
 const report=extractSongReport(zipSync({'good.mid':strToU8('midi'),'folder/nested.zip':strToU8('archive'),'other.sf2':strToU8('font'),'../unsafe.mid':strToU8('unsafe'),'README.txt':strToU8('notes')}));
 assert.deepEqual(report.entries.map(e=>e.path),['good.mid']);
 assert.deepEqual(report.issues.map(e=>e.path),['folder/nested.zip','other.sf2','../unsafe.mid']);
 assert.match(report.issues[0].reason,/Nested ZIP/);assert.equal(report.issues[1].status,'Skipped');
});
