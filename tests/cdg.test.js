import {test} from 'node:test';import assert from 'node:assert/strict';import {CDGDecoder} from '../js/cdg.js';
test('CDG skips unchanged frames, reuses pixels and redraws correctly after seeking backwards',()=>{
 const packets=new Uint8Array(48);packets[0]=9;packets[1]=1;packets[4]=2;packets[24]=9;packets[25]=1;packets[28]=3;
 const decoder=new CDGDecoder(packets.buffer);decoder.palette[2]=[20,30,40];decoder.palette[3]=[50,60,70];
 let allocated=0,draws=0,last;
 const context={createImageData:(w,h)=>{allocated++;return {data:new Uint8ClampedArray(w*h*4)};},putImageData:image=>{draws++;last=image.data.slice(0,4);}};
 decoder.seek(1/300);decoder.render(context);assert.deepEqual([...last],[20,30,40,255]);
 for(let i=0;i<100;i++){decoder.seek(1/300);decoder.render(context);}assert.equal(draws,1);assert.equal(allocated,1);
 decoder.seek(2/300);decoder.render(context);assert.deepEqual([...last],[50,60,70,255]);assert.equal(allocated,1);
 decoder.seek(0);decoder.render(context);assert.deepEqual([...last],[0,0,0,255]);assert.equal(draws,3);
});
