import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8'),version=/open-karaoke-v(\d+)/.exec(source)[1];
async function request(path,{cached=true,range=false,offline=false,cacheBlocked=false}={}){
 const handlers={},scope='https://example.com/karaoke/',calls={fetch:0,put:0};let response;const waits=[];
 runInNewContext(source,{URL,Response,location:{origin:'https://example.com'},self:{registration:{scope},addEventListener:(name,handler)=>handlers[name]=handler},caches:{open:async()=>{if(cacheBlocked)throw Error('blocked');return {match:async()=>cached?new Response('cached'):undefined,put:async()=>calls.put++};},match:async()=>cached?new Response('cached'):undefined},fetch:async()=>{calls.fetch++;if(offline)throw Error('offline');return new Response('network');}});
 handlers.fetch({request:{method:'GET',url:new URL(path,scope).href,headers:{has:()=>range}},respondWith:promise=>response=promise,waitUntil:promise=>waits.push(promise)});
 const result=response?await response:undefined;await Promise.all(waits);return {...calls,text:result?await result.text():undefined,status:result?.status};
}
test('cached versioned application assets require no network request',async()=>{assert.deepEqual(await request(`js/app.js?v=${version}`),{fetch:0,put:0,text:'cached',status:200});});
test('uncached versioned asset downloads once and is cached',async()=>{assert.deepEqual(await request(`js/search.js?v=${version}`,{cached:false}),{fetch:1,put:1,text:'network',status:200});});
test('HTML checks for new releases and remains available offline',async()=>{assert.equal((await request('index.html')).text,'network');assert.equal((await request('index.html',{offline:true})).text,'cached');});
test('previous version assets are not served from the current version cache',async()=>{assert.equal((await request('js/app.js?v=1')).text,'network');});
test('range requests bypass caching to preserve audio and video streaming',async()=>{assert.deepEqual(await request('song.mp4',{range:true}),{fetch:0,put:0,text:undefined,status:undefined});});

test('cache failures still permit online versioned assets to load',async()=>{assert.equal((await request(`js/app.js?v=${version}`,{cacheBlocked:true})).text,'network');});
