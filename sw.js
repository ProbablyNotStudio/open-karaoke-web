const CACHE='open-karaoke-v30';
const FILES=['./','./index.html','./catalog.json','./library-config.json','./style.css','./style.css?v=30','./icon.svg','./js/app.js','./js/app.js?v=30','./js/formats.js','./js/formats.js?v=30','./js/cdg.js','./js/synth.js','./js/synth.js?v=30','./soundfonts.json','./soundfonts.json?v=30','./js/soundfont-synth.js','./js/soundfont-synth.js?v=30','./js/soundfonts.js','./js/soundfonts.js?v=30','./js/vendor/spessasynth.js','./js/vendor/spessasynth_processor.min.js','./js/library.js','./js/library.js?v=30','./js/cloud.js','./js/search.js','./js/search.js?v=30','./js/catalog.js?v=30','./js/import-batch.js?v=30','./js/folder.js?v=30','./js/backgrounds.js?v=30','./js/font-cache.js?v=30','./js/midi-repair.js?v=30','./js/storage.js?v=30','./js/loading.js?v=30','./js/lyrics.js?v=30','./js/midi-loader.js?v=30','./js/midi-worker.js?v=30','./js/zip-core.js','./js/zip-core.js?v=30','./js/zip-worker.js','./js/zip-worker.js?v=30','./js/vendor/fflate.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('open-karaoke-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==location.origin||!url.href.startsWith(self.registration.scope))return;
  const cacheable=FILES.some(path=>new URL(path,self.registration.scope).href===url.href)||/\.(mid|midi|kar|mp3|wav|ogg|m4a|mp4|webm|cdg|lrc)$/i.test(url.pathname);
  // Range responses must remain intact for video/audio streaming.
  if(request.headers.has('range'))return;
  event.respondWith(fetch(request).then(response=>{if(response.ok&&cacheable){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}return response;}).catch(async()=>{const cached=await caches.match(request);return cached||new Response('Unavailable offline',{status:503});}));
});










