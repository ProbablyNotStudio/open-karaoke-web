import test from 'node:test';
import assert from 'node:assert/strict';
import {createLibraryStorage} from '../js/storage.js';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('blocked database rejects and a later successful request is closed; retry opens afresh',async()=>{
 let request,opens=0,closes=0;
 const storage=createLibraryStorage({database:()=>({open(){opens++;return request={};}}),openTimeout:100});
 const first=storage.openLibrary();request.onblocked();await assert.rejects(first,/another Open Karaoke tab/);
 request.result={close(){closes++;}};request.onsuccess();assert.equal(closes,1);
 const retry=storage.openLibrary();assert.equal(opens,2);request.result={close(){}};request.onsuccess();await retry;
});
test('unresponsive open times out and can retry',async()=>{
 let opens=0;
 const storage=createLibraryStorage({database:()=>({open(){opens++;return {};}}),openTimeout:5});
 await assert.rejects(storage.openLibrary(),/too long/);await assert.rejects(storage.openLibrary(),/too long/);assert.equal(opens,2);
});
function mockStorage(records,{stall=false}={}){
 let closes=0,aborts=0,transactions=0;
 const db={close(){closes++;},transaction(){transactions++;const tx={abort(){aborts++;},objectStore(){return {getAll(range,count){const request={};if(!stall)setTimeout(()=>{request.result=records.filter(r=>!range||r.id>range.after).slice(0,count);request.onsuccess();tx.oncomplete();},0);return request;}};}};return tx;}};
 const storage=createLibraryStorage({database:()=>({open(){const request={};setTimeout(()=>{request.result=db;request.onsuccess();},0);return request;}}),keyRange:()=>({lowerBound:after=>({after})}),operationTimeout:10});
 return {storage,stats:()=>({closes,aborts,transactions})};
}
test('saved files load in pages without missing boundary records and report progress',async()=>{
 const records=Array.from({length:7},(_,i)=>({id:String(i),file:'file'+i}));const {storage,stats}=mockStorage(records);const progress=[];
 assert.deepEqual(await storage.loadLocalFiles('songs',{batchSize:3,onProgress:n=>progress.push(n)}),records);
 assert.deepEqual(progress,[3,6,7]);assert.equal(stats().transactions,3);
});
test('stalled transaction times out, aborts and closes the stale connection',async()=>{
 const {storage,stats}=mockStorage([],{stall:true});await assert.rejects(storage.loadLocalFiles('songs'),/stopped responding/);assert.equal(stats().aborts,1);assert.equal(stats().closes,1);
});
