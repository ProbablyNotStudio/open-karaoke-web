const CACHE='open-karaoke-v42';
const FILES=['./js/search-keyboard.js?v=42','./js/queue.js?v=42','./','./index.html','./catalog.json','./library-config.json','./style.css','./style.css?v=42','./icon.svg','./js/app.js','./js/app.js?v=42','./js/formats.js','./js/formats.js?v=42','./js/cdg.js','./js/acoustic-bank.js?v=42','./js/enhanced-timbres.js?v=42','./js/synth.js','./js/synth.js?v=42','./soundfonts.json','./soundfonts.json?v=42','./js/soundfont-synth.js','./js/soundfont-synth.js?v=42','./js/soundfonts.js','./js/soundfonts.js?v=42','./js/vendor/spessasynth.js','./js/vendor/spessasynth_processor.min.js','./js/library.js','./js/library.js?v=42','./js/cloud.js','./js/search.js','./js/search.js?v=42','./js/catalog.js?v=42','./js/import-batch.js?v=42','./js/import-memory.js?v=42','./js/device.js?v=42','./js/folder.js?v=42','./js/backgrounds.js?v=42','./js/font-cache.js?v=42','./js/midi-repair.js?v=42','./js/storage.js?v=42','./js/loading.js?v=42','./js/lyrics.js?v=42','./js/midi-loader.js?v=42','./js/midi-worker.js?v=42','./js/zip-core.js','./js/zip-core.js?v=42','./js/zip-worker.js','./js/zip-worker.js?v=42','./js/vendor/fflate.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('open-karaoke-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==location.origin||!url.href.startsWith(self.registration.scope))return;
  const cacheable=FILES.some(path=>new URL(path,self.registration.scope).href===url.href)||/\.(mid|midi|kar|mp3|wav|ogg|m4a|mp4|webm|cdg|lrc)$/i.test(url.pathname);
  // Range responses must remain intact for video/audio streaming.
  if(request.headers.has('range'))return;
  event.respondWith(fetch(request).then(response=>{if(response.ok&&cacheable){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}return response;}).catch(async()=>{const cached=await caches.match(request);return cached||new Response('Unavailable offline',{status:503});}));
});










