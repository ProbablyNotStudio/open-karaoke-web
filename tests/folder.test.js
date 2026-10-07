import test from 'node:test';
import assert from 'node:assert/strict';
import {folderFiles,songFolderSelection} from '../js/folder.js';
test('folder imports preserve nested paths and matching companions without reading bytes',async()=>{
 const file=name=>({kind:'file',name,getFile:async()=>({name,arrayBuffer(){throw Error('Must remain lazy');}})});
 const directory=(name,children)=>({kind:'directory',name,async *values(){yield* children;}});
 const result=await folderFiles(directory('Songs',[file('README.txt'),directory('Album',[file('Track.mid'),file('Track.cdg')]),file('pack.zip')]));
 assert.deepEqual(result.map(f=>f.webkitRelativePath),['Songs/Album/Track.mid','Songs/Album/Track.cdg','Songs/pack.zip']);
});
test('video folders with no top-level files include every nested category',async()=>{
 const file=name=>({kind:'file',name,getFile:async()=>({name})});
 const directory=(name,children)=>({kind:'directory',name,async *values(){yield* children;}});
 const result=await folderFiles(directory('bgv',[
  directory('3D',[file('sayaw1.mp4'),file('sayaw2.mp4')]),
  directory('Motion',[file('motion1.mp4'),directory('More',[file('motion2.webm')])]),
  directory('Nature',[file('Video1.mp4'),file('Video2.mp4')])
 ]));
 assert.deepEqual(result.map(f=>f.webkitRelativePath),['bgv/3D/sayaw1.mp4','bgv/3D/sayaw2.mp4','bgv/Motion/motion1.mp4','bgv/Motion/More/motion2.webm','bgv/Nature/Video1.mp4','bgv/Nature/Video2.mp4']);
});
test('parent folder imports only songs and excludes sibling backgrounds and fonts',()=>{
 const file=path=>({name:path.split('/').at(-1),webkitRelativePath:path});
 const selection=songFolderSelection(['open-karaoke/songs/songs-000.zip','open-karaoke/songs/More/Track.kar','open-karaoke/bgv/Nature/Video1.mp4','open-karaoke/sound/Bank.sf2','open-karaoke/other/Track.mid'].map(file));
 assert.equal(selection.restricted,true);assert.equal(selection.ignored,3);
 assert.deepEqual(selection.files.map(f=>f.name),['songs-000.zip','Track.kar']);
});
test('selecting songs directly or another song collection preserves its subfolders',()=>{
 const file=path=>({name:path.split('/').at(-1),webkitRelativePath:path});
 for(const paths of [['songs/a.zip','songs/Album/b.mid'],['My Music/Album/a.mid','My Music/Album/b.lrc']]){
  const selection=songFolderSelection(paths.map(file));assert.equal(selection.restricted,false);assert.equal(selection.files.length,2);
 }
 assert.equal(songFolderSelection([file('Root/SONGS/one.mid'),file('Root/bgv/bg.mp4')]).files.length,1);
});
