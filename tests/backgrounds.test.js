import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseBackground,folderBackgrounds,backgroundFolders} from '../js/backgrounds.js';
test('random backgrounds avoid immediate repeats while manual and empty selections stay predictable',()=>{
 const items=[{id:'a'},{id:'b'},{id:'c'}];
 assert.equal(chooseBackground(items,'none','a'),null);
 assert.equal(chooseBackground(items,'b','a'),items[1]);
 assert.equal(chooseBackground(items,'missing','a'),null);
 assert.equal(chooseBackground(items,'random','a',()=>0),items[1]);
 assert.equal(chooseBackground(items,'random','a',()=>.99),items[2]);
 assert.equal(chooseBackground([items[0]],'random','a'),items[0]);
 assert.equal(chooseBackground([],'random',null),null);
});
test('folder collections include descendants and never shuffle outside the selected folder',()=>{
 const items=[{id:'a',path:'bgv/Nature/a.mp4'},{id:'b',path:'bgv/Nature/nested/b.mp4'},{id:'c',path:'bgv/Motion/c.mp4'},{id:'d',path:'bgv/Nature Extra/d.mp4'}];
 assert.deepEqual(folderBackgrounds(items,'bgv/Nature').map(item=>item.id),['a','b']);
 assert.equal(chooseBackground(items,'random','a',()=>.99,'bgv/Nature').id,'b');
 assert.equal(chooseBackground(items,'a','b',()=>0,'bgv/Nature').id,'a');
 assert.equal(chooseBackground(items,'c','b',()=>0,'bgv/Nature'),null);
 assert.equal(chooseBackground(items,'random','a',()=>0,'missing'),null);
 assert.equal(folderBackgrounds(items,'all'),items);
 assert.deepEqual(backgroundFolders(items).find(folder=>folder.path==='bgv/Nature'),{path:'bgv/Nature',count:2});
 assert.equal(backgroundFolders(items).find(folder=>folder.path==='bgv').count,4);
});
test('folder paths handle case and Windows separators without grouping unrelated names',()=>{
 const items=[{id:'a',path:'bgv\\Nature\\a.mp4'},{id:'b',path:'BGV/nature/b.mp4'},{id:'c',path:'single.mp4'}];
 assert.equal(folderBackgrounds(items,'BGV/NATURE').length,2);
 assert.equal(backgroundFolders(items).find(folder=>folder.path.toLowerCase()==='bgv/nature').count,2);
 assert.equal(backgroundFolders(items).length,2);
});
