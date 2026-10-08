const CACHE='open-karaoke-v43';
const FILES=['./js/search-keyboard.js?v=43','./js/queue.js?v=43','./','./index.html','./catalog.json','./library-config.json','./style.css','./style.css?v=43','./icon.svg','./js/app.js','./js/app.js?v=43','./js/formats.js','./js/formats.js?v=43','./js/cdg.js','./js/acoustic-bank.js?v=43','./js/enhanced-timbres.js?v=43','./js/synth.js','./js/synth.js?v=43','./soundfonts.json','./soundfonts.json?v=43','./js/soundfont-synth.js','./js/soundfont-synth.js?v=43','./js/soundfonts.js','./js/soundfonts.js?v=43','./js/vendor/spessasynth.js','./js/vendor/spessasynth_processor.min.js','./js/library.js','./js/library.js?v=43','./js/cloud.js','./js/search.js','./js/search.js?v=43','./js/catalog.js?v=43','./js/import-batch.js?v=43','./js/import-memory.js?v=43','./js/device.js?v=43','./js/folder.js?v=43','./js/backgrounds.js?v=43','./js/font-cache.js?v=43','./js/midi-repair.js?v=43','./js/storage.js?v=43','./js/loading.js?v=43','./js/lyrics.js?v=43','./js/midi-loader.js?v=43','./js/midi-worker.js?v=43','./js/zip-core.js','./js/zip-core.js?v=43','./js/zip-worker.js','./js/zip-worker.js?v=43','./js/vendor/fflate.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('open-karaoke-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==location.origin||!url.href.startsWith(self.registration.scope))return;
  const appAsset=FILES.some(path=>new URL(path,self.registration.scope).href===url.href);
  const cacheable=appAsset||/\.(mid|midi|kar|mp3|wav|ogg|m4a|mp4|webm|cdg|lrc)$/i.test(url.pathname);
  // Range responses must remain intact for video/audio streaming.
  if(request.headers.has('range'))return;
  // Versioned assets belong to this exact release. Reuse them immediately;
  // HTML still checks the network so new releases can be discovered.
  if(appAsset&&url.searchParams.get('v')===CACHE.split('-v').at(-1)){
    event.respondWith((async()=>{
      let cache;try{cache=await caches.open(CACHE);const cached=await cache.match(request);if(cached)return cached;}catch{}
      const response=await fetch(request);if(cache&&response.ok)event.waitUntil(cache.put(request,response.clone()).catch(()=>{}));return response;
    })().catch(()=>new Response('Unavailable offline',{status:503})));return;
  }
  event.respondWith(fetch(request).then(response=>{if(response.ok&&cacheable){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}return response;}).catch(async()=>{const cached=await caches.match(request);return cached||new Response('Unavailable offline',{status:503});}));
});










