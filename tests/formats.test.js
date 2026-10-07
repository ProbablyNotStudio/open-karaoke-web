import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {parseMidi,parseName,parseLRC} from '../js/formats.js';import {CDGDecoder} from '../js/cdg.js';
const buffer=bytes=>Uint8Array.from(bytes).buffer;
const midi=(track,division=480)=>buffer([...Buffer.from('MThd'),0,0,0,6,0,0,0,1,division>>8,division&255,...Buffer.from('MTrk'),0,0,0,track.length,...track]);
test('MIDI reads song headers without turning marker and track labels into lyrics',()=>{
 const text=Buffer.from('Original Song (Original Artist)');
 const song=parseMidi(midi([0,255,6,text.length,...text,0,255,3,6,...Buffer.from('Lyrics'),0,255,5,5,...Buffer.from('Hello'),0,255,47,0]));
 assert.deepEqual(song.metadata,{title:'Original Song',artist:'Original Artist'});assert.equal(song.lyrics[0].text,'Hello');
 const header=t=>[0,255,1,t.length,...Buffer.from(t)];
 assert.deepEqual(parseMidi(midi([...header('@TMy Song'),...header('@TMy Artist'),0,255,47,0])).metadata,{title:'My Song',artist:'My Artist'});
});
test('file numbering and artist parsing',()=>{assert.deepEqual(parseName('00123 - Title - Artist.mid'),{number:'00123',title:'Title',artist:'Artist'});assert.equal(parseName('Just a title.mp3',7).number,'00007');});
test('LRC multiple timestamps and offset',()=>{assert.deepEqual(parseLRC('[offset:500]\n[00:01.00][00:03.00]Hello'),[{time:1.5,text:'Hello'},{time:3.5,text:'Hello'}]);});
test('MIDI tempo changes, running status, note-off velocity zero',()=>{
 const song=parseMidi(midi([0,255,81,3,7,161,32,0,144,60,100,0x83,0x60,60,0,0,255,81,3,15,66,64,0,144,62,100,0x83,0x60,62,0,0,255,47,0]));
 assert.equal(song.notes.length,2);assert.equal(song.notes[0].end,.5);assert.equal(song.notes[1].time,.5);assert.equal(song.notes[1].end,1.5);assert.equal(song.duration,1.5);
});
test('MIDI timed syllables and line breaks',()=>{
 const song=parseMidi(midi([0,255,5,3,47,72,105,0,144,60,90,0x83,0x60,128,60,0,0,255,5,4,47,89,111,117,0,255,47,0]));
 assert.equal(song.lyrics.length,2);assert.equal(song.lyrics[0].text,'Hi');assert.equal(song.lyrics[1].time,.5);
});
test('standalone karaoke count markers are hidden without moving lyric timing',()=>{
 const lyric=(delta,text)=>[delta,255,5,text.length,...Buffer.from(text)];
 const song=parseMidi(midi([...lyric(0,'#'),...lyric(120,'#'),...lyric(120,'Hello'),...lyric(120,' #9'),0,255,47,0]));
 assert.equal(song.lyrics[0].text,'Hello #9');assert.equal(song.lyrics[0].time,.25);assert.equal(song.lyrics[0].words[0].time,.25);
});
test('MIDI sustain retains notes until pedal release',()=>{const s=parseMidi(midi([0,176,64,127,0,144,60,100,120,128,60,0,120,176,64,0,0,255,47,0]));assert.equal(s.notes[0].end,.25);});
test('malformed and unsupported MIDI rejected',()=>{assert.throws(()=>parseMidi(buffer([1,2])));assert.throws(()=>parseMidi(midi([0,144,60])));assert.throws(()=>parseMidi(midi([0,255,47,0],0x8001)),/SMPTE/);});
const packet=(op,data)=>[9,op,0,0,...data,...Array(16-data.length).fill(0),0,0,0,0];
test('CDG palette, tile drawing and XOR',()=>{
 const dec=new CDGDecoder(buffer([...packet(30,[0,0,63,63]),...packet(6,[0,1,1,1,...Array(12).fill(32)]),...packet(38,[0,1,1,1,...Array(12).fill(32)])]));
 dec.seek(2/300);assert.deepEqual(dec.palette[1],[255,255,255]);assert.equal(dec.pixels[12*300+6],1);assert.equal(dec.pixels[12*300+7],0);dec.seek(3/300);assert.equal(dec.pixels[12*300+6],0);
});
test('CDG rewind reconstructs state and respects memory repeat',()=>{const dec=new CDGDecoder(buffer([...packet(1,[3,0]),...packet(1,[5,1]),...packet(1,[4,0])]));dec.seek(3/300);assert.equal(dec.pixels[0],4);dec.seek(1/300);assert.equal(dec.pixels[0],3);});
test('CDG scroll copy wraps tiles and preset fills vacated region',()=>{const a=packet(6,[0,1,1,1,...Array(12).fill(63)]);const dec=new CDGDecoder(buffer([...a,...packet(24,[2,16,0]),...packet(20,[2,32,0])]));dec.seek(2/300);assert.equal(dec.pixels[12*300+12],1);dec.seek(3/300);assert.equal(dec.pixels[12*300+6],1);assert.equal(dec.pixels[12*300+299],2);});
test('CDG handles transparency and malformed tiles',()=>{const dec=new CDGDecoder(buffer([...packet(28,[2]),...packet(6,[0,1,31,63,...Array(12).fill(63)])]));dec.seek(1);assert.equal(dec.transparent,2);assert.equal(dec.pixels[0],0);assert.throws(()=>new CDGDecoder(buffer([1])),/24-byte/);});
test('original MIDI demo has usable notes and lyric timing',()=>{const b=fs.readFileSync(new URL('./fixtures/original-demo.mid',import.meta.url));const s=parseMidi(b);assert.equal(s.notes.length,28);assert.equal(s.lyrics.length,4);assert.equal(s.duration,9);});
test('fast import validation preserves MIDI metadata and rejects truncated or invalid events',()=>{
 const text=Buffer.from('Original Song (Original Artist)');
 const valid=midi([0,255,6,text.length,...text,0,144,60,100,20,128,60,0,0,255,47,0]);
 const quick=parseMidi(valid,{metadataOnly:true});assert.deepEqual(quick.metadata,parseMidi(valid).metadata);assert.equal(quick.notes,undefined);
 assert.throws(()=>parseMidi(valid.slice(0,-2),{metadataOnly:true}),/Truncated/);
 assert.throws(()=>parseMidi(midi([0,144,60,255]),{metadataOnly:true}),/Invalid MIDI event/);
});
test('legacy running status survives lyric metadata and normalized MIDI works in strict mode',()=>{
 const song=parseMidi(midi([0,144,60,100,0,255,5,2,72,105,120,60,0,0,255,47,0]));
 assert.equal(song.notes.length,1);assert.equal(song.notes[0].end,.125);assert.equal(song.lyrics[0].text,'Hi');
 assert.equal(parseMidi(song.buffer,{strict:true}).notes.length,1);
 assert.equal(parseMidi(song.buffer,{strict:true}).compatibility,undefined);
});
test('legacy karaoke sentinel is skipped without changing subsequent note timing',()=>{
 const song=parseMidi(midi([0,144,0,254,120,144,60,100,120,128,60,0,0,255,47,0]));
 assert.equal(song.compatibility.skippedEvents,1);assert.equal(song.notes[0].time,.125);assert.equal(song.notes[0].end,.25);
 assert.equal(parseMidi(song.buffer,{strict:true}).notes[0].time,.125);
 assert.throws(()=>parseMidi(midi([0,60,100,0,255,47,0])),/running status/);
});
