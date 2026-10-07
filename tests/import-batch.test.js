import {test} from 'node:test';import assert from 'node:assert/strict';
import {runImportBatches,importQueue} from '../js/import-batch.js';
test('43 archives import all 42,756 files in bounded batches before opening the next ZIP',async()=>{
 let consumed=0,opened=0,previousEnd=0,maxBatch=0;const progress=[];
 const selected=Array.from({length:43},(_,i)=>({name:`songs-${i}.zip`,count:i===42?756:1000}));
 await runImportBatches(selected,{expand:async item=>{assert.equal(consumed,previousEnd);opened++;previousEnd+=item.count;return Array.from({length:item.count},(_,i)=>({id:`${opened}:${i}`}));},consume:async chunk=>{assert.ok(chunk.length<=100);maxBatch=Math.max(maxBatch,chunk.length);consumed+=chunk.length;},onProgress:p=>progress.push(p)});
 assert.equal(opened,43);assert.equal(consumed,42756);assert.equal(maxBatch,100);assert.equal(progress.at(-1).processed,756);
});
test('one failed ZIP does not discard valid archives before or after it',async()=>{
 const consumed=[],issues=[];
 await runImportBatches([{name:'a.zip'},{name:'bad.zip'},{name:'b.zip'}],{expand:async item=>{if(item.name==='bad.zip')throw Error('Incomplete ZIP');return [{id:item.name}];},consume:async chunk=>consumed.push(...chunk),onIssue:e=>issues.push(e)});
 assert.deepEqual(consumed.map(e=>e.id),['a.zip','b.zip']);assert.equal(issues[0].path,'bad.zip');
});
test('queued imports snapshot file selections and continue after a failed batch',async()=>{
 const seen=[];let release;const gate=new Promise(r=>release=r);
 const submit=importQueue(async files=>{await gate;seen.push(files.map(f=>f.name));if(files[0].name==='first')throw Error('fail');});
 const selected=[{name:'first'}];const first=submit(selected);selected.splice(0,1,{name:'changed'});const second=submit([{name:'second'}]);release();await assert.rejects(first);await second;
 assert.deepEqual(seen,[['first'],['second']]);
});
