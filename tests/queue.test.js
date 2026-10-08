import test from 'node:test';
import assert from 'node:assert/strict';
import {validQueue,moveQueueEntry,formatBytes} from '../js/queue.js';
test('refresh preserves repeated turns and their order, filtering missing songs',()=>{
 const saved=JSON.parse(JSON.stringify(['a','b','a','missing',null]));
 assert.deepEqual(validQueue(saved,new Map([['a',{}],['b',{}]])),['a','b','a']);
 assert.deepEqual(validQueue({}),[]);
});
test('moving one repeated entry keeps every other turn intact',()=>{
 const queue=['a','b','a','c'];
 assert.deepEqual(moveQueueEntry(queue,2,-1),['a','a','b','c']);
 assert.deepEqual(moveQueueEntry(queue,0,1),['b','a','a','c']);
 assert.deepEqual(queue,['a','b','a','c']);
 assert.equal(moveQueueEntry(queue,0,-1),queue);
 assert.equal(moveQueueEntry(queue,3,1),queue);
 assert.equal(moveQueueEntry(queue,-1,1),queue);
});
test('stored queue validation retains repeats even before files are available',()=>{
 assert.deepEqual(validQueue(['a',12,'a','b']),['a','a','b']);
});
test('storage sizes handle empty, large and unavailable values',()=>{
 assert.equal(formatBytes(0),'0 B');assert.equal(formatBytes(1024),'1 KB');
 assert.equal(formatBytes(1024**3),'1 GB');assert.equal(formatBytes(NaN),'Unavailable');
});
