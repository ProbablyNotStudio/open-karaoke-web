import {loadingDeadline} from './loading.js?v=32';
import {readMidi} from './midi-loader.js?v=32';
import {lyricPresentation,lyricFill} from './lyrics.js?v=32';
import {parseName,parseMidi,parseLRC} from './formats.js?v=32';
import {SoundFontSynth} from './soundfont-synth.js?v=32';
import {MAX_SOUNDFONT_BYTES,validateSoundFont,validateSoundFontHeader,downloadSoundFont} from './soundfonts.js?v=32';
import {CDGDecoder} from './cdg.js';
import {SUPPORTED,MIDI,unpackZip,songFormat} from './library.js?v=32';
import {libraryPage,searchText,createSongOrder} from './search.js?v=32';
import {saveLocalFiles,loadLocalFiles,getLocalFile,clearLocalLibrary} from './storage.js?v=32';
import {cachedSoundFont} from './font-cache.js?v=32';
import {runImportBatches,importQueue} from './import-batch.js?v=32';
import {songbookPage} from './catalog.js?v=32';
import {setupBackgrounds} from './backgrounds.js?v=32';
import {folderFiles,songFolderSelection} from './folder.js?v=32';
let bookPage=0,bookLetter='all';
let sessionEpoch=0,songAbort=null,leadIn=null;
function songPhase(message,token){if(token===loadToken)$('stageStatus').textContent=message;}
async function countIn(token){
 if(!currentLyrics.length)return;
 const seconds=Math.max(0,5-currentLyrics[0].time);if(!seconds)return;
 leadIn={start:performance.now(),seconds};updateControls();backgrounds.sync(true);
 while((performance.now()-leadIn.start)/1000<seconds){await new Promise(resolve=>setTimeout(resolve,40));if(token!==loadToken)return;}
 leadIn=null;
}
const $=id=>document.getElementById(id);
const synth=new SoundFontSynth(),media=$('video'),canvas=$('cdgCanvas'),context=canvas.getContext('2d');
const files=new Map(),songs=new Map();let queue=[],current=null,decoder=null,currentLyrics=[],favoriteOnly=false,key=0,rate=1,loadToken=0,loading=false;
const songOrder=createSongOrder(()=>songs.values());
const readJSON=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
let favorites=new Set(readJSON('open-karaoke-favorites',[]));
let preferences={lines:2,offset:0,melody:-1,auto:true,volume:65,textEncoding:'auto',soundfont:'karaoke-king',background:'none',backgroundFolder:'all',...readJSON('open-karaoke-settings',{})};
const fonts=new Map();let fontBusy=false,fontPromise=null,fontAbort=null;
let libraryIndex=0,searchTimer;
let stagePage=0,stageSearchTimer;
const recentMidi=new Map();
function updateMidiMetadata(song,midi){if(/^\d+$/.test(song.title)&&midi.metadata?.title)song.title=midi.metadata.title;if(song.artist==='Unknown artist'&&midi.metadata?.artist)song.artist=midi.metadata.artist;song.searchText=searchText(song);songOrder.invalidate();}
function rememberMidi(song,midi){updateMidiMetadata(song,midi);song.midi=midi;song.midiEncoding=preferences.textEncoding;recentMidi.delete(song.id);recentMidi.set(song.id,song);while(recentMidi.size>3){const [id,oldest]=recentMidi.entries().next().value;delete oldest.midi;recentMidi.delete(id);}}
function save(){try{localStorage.setItem('open-karaoke-favorites',JSON.stringify([...favorites]));localStorage.setItem('open-karaoke-settings',JSON.stringify(preferences));}catch{}}
const backgrounds=setupBackgrounds({getSelection:()=>preferences.background,setSelection:value=>{preferences.background=value;save();},getFolder:()=>preferences.backgroundFolder,setFolder:value=>{preferences.backgroundFolder=value;save();},report:(count,issues)=>showImportReport(count,issues,'backgrounds')});
let toastTimer;function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5200);}
const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
function button(label,title,action,cls=''){const b=node('button',cls,label);b.type='button';b.title=title;b.setAttribute('aria-label',title);b.onclick=action;return b;}
const clock=t=>{t=Math.max(0,Number.isFinite(t)?t:0);return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;};
function renderLibrary(){
  const result=libraryPage(songOrder.get(),{query:$('search').value,format:$('formatFilter').value,favoriteOnly,favorites,page:libraryIndex,sort:'title',ordered:true});
  libraryIndex=result.page;const list=result.rows;
  $('songCount').textContent=favoriteOnly?[...songs.keys()].filter(id=>favorites.has(id)).length:songs.size;$('libraryHeading').firstChild.textContent=favoriteOnly?'Favorites ':'Song library ';
  $('songList').replaceChildren();$('empty').hidden=songs.size>0;
  $('libraryPages').hidden=!songs.size;$('pageSummary').textContent=result.total?`${result.start.toLocaleString()}–${result.end.toLocaleString()} of ${result.total.toLocaleString()} songs`:'No matches';
  $('pagePrevious').disabled=result.page===0;$('pageNext').disabled=result.page===result.pages-1;
  if(!list.length&&songs.size){$('songList').append(node('p','empty','No matching songs. Try another search or format.'));}
  for(const song of list){
    const row=node('div','song-row'),details=button('','Play '+song.title,()=>playSong(song),'song-details');
    details.append(node('span','song-number',song.number));const text=node('span','song-text');text.append(node('strong','',song.title),node('small','',song.artist+' · '+'Your file'));details.append(text);
    const pill=node('span','format-pill '+(song.format==='CDG'?'cdg':''),song.format);
    const actions=node('div','song-actions');actions.append(button(favorites.has(song.id)?'♥':'♡','Favorite '+song.title,()=>{favorites.has(song.id)?favorites.delete(song.id):favorites.add(song.id);save();renderLibrary();},'favorite '+(favorites.has(song.id)?'selected':'')),button('▶','Play '+song.title,()=>playSong(song),'row-play'),button('+','Reserve '+song.title,()=>{queue.push(song.id);renderQueue();toast('Reserved: '+song.title);},'reserve'));
    row.append(details,pill,actions);$('songList').append(row);
  }
  if(!$('songbook').hidden)renderSongbook();
  if($('stageBrowser').open)renderStageSongs();
}
function renderStageSongs(){
 const result=libraryPage(songOrder.get(),{query:$('stageSearch').value,page:stagePage,size:20,ordered:true});stagePage=result.page;
 const list=$('stageResults');list.replaceChildren();list.scrollTop=0;
 $('stagePageSummary').textContent=result.total?`${result.start.toLocaleString()}–${result.end.toLocaleString()} of ${result.total.toLocaleString()}`:'No matches';
 $('stagePagePrevious').disabled=stagePage===0;$('stagePageNext').disabled=stagePage===result.pages-1;
 if(!result.rows.length)list.append(node('p','stage-browser-empty',songs.size?'No matches. Try another title, artist or song number.':'Add your songs to the library first, then find them here.'));
 for(const song of result.rows){
  const row=node('div','stage-song'),info=node('div','stage-song-info');info.append(node('span','song-number',song.number),node('strong','',song.title),node('small','',song.artist));
  const actions=node('div','stage-song-actions');
  actions.append(button('▶','Play '+song.title+' now',()=>{$('stageBrowser').close();void playSong(song);},'stage-song-play'),button('+ Queue','Add '+song.title+' to queue',()=>{queue.push(song.id);renderQueue();$('stageBrowserStatus').textContent=`Added ${song.title} to the queue. ${queue.length} song(s) reserved.`;},'stage-song-add'));
  row.append(info,actions);list.append(row);
 }
}
function renderStageQueue(){
 $('stageQueueCount').textContent=queue.length;const list=$('stageQueueList');list.replaceChildren();
 if(!queue.length)list.append(node('p','stage-browser-empty','No songs reserved yet.'));
 queue.forEach((id,index)=>{const song=songs.get(id);if(!song)return;const row=node('div','stage-queue-song');row.append(node('span','queue-index',String(index+1)),node('strong','',song.title),button('×','Remove '+song.title+' from queue',()=>{queue.splice(index,1);renderQueue();$('stageBrowserStatus').textContent=`Removed ${song.title} from the queue.`;}));list.append(row);});
}
function openStageBrowser(){
 if(!$('stageBrowser').open)$('stageBrowser').showModal();renderStageSongs();renderStageQueue();$('stageSearch').focus();
}
$('stageSongs').onclick=openStageBrowser;$('stageBrowserClose').onclick=()=>$('stageBrowser').close();
$('stageSearch').oninput=()=>{clearTimeout(stageSearchTimer);stageSearchTimer=setTimeout(()=>{stagePage=0;renderStageSongs();},100);};
for(const [id,delta] of [['stagePagePrevious',-1],['stagePageNext',1]])$(id).onclick=()=>{stagePage+=delta;renderStageSongs();};
function renderSongbook(){
 const result=songbookPage(songOrder.get(),{letter:bookLetter,query:$('bookSearch').value,page:bookPage,ordered:true});bookPage=result.page;
 $('bookCount').textContent=`${result.total.toLocaleString()} songs`;
 $('bookPageLabel').textContent=`Page ${bookPage+1} of ${result.pages}`;
 $('bookPrevious').disabled=bookPage===0;$('bookNext').disabled=bookPage===result.pages-1;
 $('bookJump').max=result.pages;$('bookJump').value=bookPage+1;
 $('bookEntries').replaceChildren();
 $('bookEmpty').hidden=result.total>0;
 $('bookEmpty').textContent=songs.size?'No songs match this letter or search.':'Your songbook is empty. Add songs to build your personal catalog.';
 for(const song of result.rows){
  const row=node('div','book-entry'),text=node('div','book-entry-text');
  text.append(node('strong','',song.title),node('small','',song.artist));
  const number=node('span','book-number',song.number),actions=node('div','book-entry-actions');
  actions.append(button('▶','Play '+song.title,()=>{nav(false);void playSong(song);},'book-play'),button('+','Reserve '+song.title,()=>{queue.push(song.id);renderQueue();toast('Reserved: '+song.title);},'book-reserve'));
  row.append(number,text,actions);$('bookEntries').append(row);
 }
 for(const tab of $('bookLetters').children)tab.setAttribute('aria-pressed',String(tab.dataset.letter===bookLetter));
}
function renderQueue(){
  $('queueCount').textContent=queue.length;$('queueEmpty').hidden=queue.length>0;$('queueList').replaceChildren();
  queue.forEach((id,index)=>{const s=songs.get(id);if(!s)return;const row=node('div','queue-item'),info=node('div','queue-info');info.append(node('strong','',s.title),node('small','',s.artist));
    row.append(node('span','queue-index',String(index+1).padStart(2,'0')),info);
    const up=button('↑','Move '+s.title+' to the front',()=>{queue.splice(index,1);queue.unshift(id);renderQueue();});up.disabled=index===0;
    row.append(up,button('×','Remove '+s.title,()=>{queue.splice(index,1);renderQueue();}));$('queueList').append(row);
  });$('nextSong').textContent=queue.length?'Next: '+songs.get(queue[0])?.title:'No song reserved';
  if($('stageBrowser').open)renderStageQueue();
}
function pair(song){const stem=song.id.replace(/\.[^.]+$/,'');song.cdg=files.get(stem+'.cdg');song.lrc=files.get(stem+'.lrc');song.format=songFormat(song.file.name,!!song.cdg);}
const queueImport=importQueue(performImport);
function importFiles(selected,options={}){return options.restore?performImport(Array.from(selected),options):queueImport(selected,options);}
async function performImport(selected,{silent=false,restore=false}={}){
  if(!restore)await localLibraryReady;
  const epoch=sessionEpoch,companions=[];let count=0,errors=[],saveFailed=false;
  const active=!silent;
  if(active){$('importProgress').hidden=false;for(const id of ['import','emptyImport','folderImport'])$(id).disabled=true;}
  try{
    await runImportBatches(selected,{
      expand:unpackZip,onIssue:issue=>errors.push(issue),
      onProgress:({name,input,inputs,processed,total})=>{if(active)$('importProgress').textContent=`Importing ${input} of ${inputs}: ${name}${total?` · ${processed.toLocaleString()} / ${total.toLocaleString()} files`:''} · ${count.toLocaleString()} songs added. Keep this tab open.`;},
      consume:async entries=>{
        if(epoch!==sessionEpoch)throw Error('Import canceled because the library was reset.');
        const records=[];
        songOrder.invalidate();
        for(const entry of entries){
          const {file,path,source,details={}}=entry;
          if(!SUPPORTED.test(file.name)){errors.push({path,reason:'Unsupported song format. Choose MIDI/KAR, audio, video, CDG or LRC files.',status:'Skipped'});continue;}
          const id=(source+':'+path).toLowerCase(),ext=file.name.split('.').pop().toLowerCase();
          const existing=songs.get(id),metadata={...parseName(file.name,existing?Number(existing.number):songs.size+1),...details,format:songFormat(file.name)};
          try{
            if(MIDI.test(file.name)){
              const midi=entry.deferMidi?null:parseMidi(entry.buffer||await file.arrayBuffer(),{textEncoding:preferences.textEncoding,metadataOnly:true});
              files.set(id,file);const song={id,file,path,source,...metadata};songs.set(id,song);if(midi)updateMidiMetadata(song,midi);count++;
              if(midi?.compatibility?.skippedEvents)errors.push({path,status:'Recovered',reason:`Added using MIDI compatibility mode. ${midi.compatibility.skippedEvents} invalid event(s) were skipped; some musical details may differ. You do not need to reimport this file.`});
            }else{files.set(id,file);if(!['cdg','lrc'].includes(ext)){songs.set(id,{id,file,path,source,...metadata});count++;}else companions.push({id,path,file});}
            if(source==='local')records.push({id,file,path,source,details:songs.has(id)?(({title,artist,number})=>({title,artist,number}))(songs.get(id)):details});
          }catch(error){errors.push({path,reason:error.message,status:'Failed'});}
        }
        if(epoch!==sessionEpoch)throw Error('Import canceled because the library was reset.');
        if(!restore&&records.length){try{await saveLocalFiles('songs',records);}catch{saveFailed=true;errors.push({path:`Saving files: ${records[0].path} … ${records.at(-1).path}`,reason:'Browser storage is full or unavailable. These files work this session, but may need importing again after reloading.',status:'Not saved'});}}
        // Give the browser time to paint progress and release temporary MIDI data.
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    });
    for(const song of songs.values()){pair(song);if(!song.searchText)song.searchText=searchText(song);}
    const paired=new Set([...songs.values()].flatMap(song=>[song.cdg,song.lrc]).filter(Boolean));
    for(const entry of companions)if(files.get(entry.id)===entry.file&&!paired.has(entry.file))errors.push({path:entry.path,status:'Needs audio',reason:'Added, but no matching audio file was found. Add the audio with the same filename stem in the same folder.'});
    renderLibrary();renderQueue();
    if(!restore)$('storageStatus').textContent=saveFailed?'Some files could not be saved. See the import results.':'Your songs and SoundFonts are saved in this browser.';
    if(active){$('importProgress').textContent=`Finished ${selected.length} selected file(s)/ZIP(s): ${count.toLocaleString()} songs added. Library total: ${songs.size.toLocaleString()}.${errors.length?` ${errors.length.toLocaleString()} items need attention.`:''}`;toast(`${count.toLocaleString()} song(s) added.${errors.length?' Some files need attention.':''}`);if(errors.length)showImportReport(count,errors);}
    return {count,errors};
  }catch(error){renderLibrary();renderQueue();if(active){$('importProgress').textContent=`Import stopped: ${error.message}`;errors.push({path:'Import batch',reason:error.message,status:'Failed'});showImportReport(count,errors);}return {count,errors};}
  finally{if(active)for(const id of ['import','emptyImport','folderImport'])$(id).disabled=false;}
}
function showImportReport(count,issues,kind='songs'){
  $('importSummary').textContent=`${count} ${kind==='backgrounds'?'background video(s)':'song(s)'} added. ${issues.length} item(s) need attention.`;
  $('importRetry').onclick=()=>{$('importReport').close();$(kind==='backgrounds'?'backgroundFiles':'files').click();};
  $('importIssues').replaceChildren();
  for(const issue of issues){const row=node('li','import-issue');row.append(node('strong','',issue.path.replace(/^zip\/([^/]+)\//,'$1 / ')),node('span','issue-status',issue.status||'Failed'),node('p','',issue.reason));$('importIssues').append(row);}
  if(!$('importReport').open)$('importReport').showModal();
}
$('importReportClose').onclick=()=>$('importReport').close();
function halt(){backgrounds.sync(false);synth.load(null);media.pause();media.removeAttribute('src');media.load();if(current?.url)URL.revokeObjectURL(current.url);}
async function playSong(song){
  pair(song);
  songAbort?.abort();songAbort=new AbortController();leadIn=null;const token=++loadToken;loading=true;halt();backgrounds.nextSong();current={...song};decoder=null;currentLyrics=[];lastLyricSignature='';
  media.hidden=true;canvas.hidden=true;$('stageContent').hidden=false;$('stageOrbit').hidden=true;$('stageLabel').textContent='NOW PLAYING';$('stageTitle').textContent=song.title;$('stageArtist').textContent=song.artist;$('stage').classList.add('playing');
  $('nowTitle').textContent=song.title;$('nowArtist').textContent=song.artist;$('formatTag').textContent=song.format+(song.format==='MIDI'?' · BUILT-IN SYNTH':'');$('stageStatus').textContent='Loading song…';$('lyrics').replaceChildren();$('stage').classList.remove('singing');for(const id of ['stageLabel','stageTitle','stageArtist'])$(id).hidden=false;$('lyricCountdown').hidden=true;
  updateControls();
  try{
    if(song.format==='MIDI'){
      songPhase('Reading MIDI notes and lyrics…',token);
      const parsing=(!song.midi||song.midiEncoding!==preferences.textEncoding)?readMidi(song.file,{textEncoding:preferences.textEncoding},{signal:songAbort.signal}).then(midi=>{if(token===loadToken)rememberMidi(song,midi);}):Promise.resolve();
      // Start the browser audio context while the click still grants permission.
      const instruments=(async()=>{await loadingDeadline(synth.init(),15000,'Audio output did not start. Press Play to retry.');await fontCatalogReady;if(token!==loadToken)return;songPhase('Preparing instruments…',token);await ensureSoundFont();})();
      await Promise.all([parsing,instruments]);if(token!==loadToken)return;
      const metadataChanged=current.title!==song.title||current.artist!==song.artist;
      current.title=song.title;current.artist=song.artist;$('stageTitle').textContent=song.title;$('stageArtist').textContent=song.artist;$('nowTitle').textContent=song.title;$('nowArtist').textContent=song.artist;if(metadataChanged)renderLibrary();renderQueue();
      current.midi=song.midi;synth.load(song.midi);currentLyrics=song.midi.lyrics;synth.configure({rate,key,mutedChannel:preferences.melody});
      songPhase('Preparing playback…',token);await synth.prepareSong();if(token!==loadToken)return;
      songPhase('Get ready…',token);await countIn(token);if(token!==loadToken)return;
      await loadingDeadline(synth.play(),15000,'Playback took too long to start. Press Play to retry.');$('formatTag').textContent='MIDI · '+synth.fontName;
    }else{
      if(song.cdg){const data=await song.cdg.arrayBuffer();if(token!==loadToken)return;decoder=new CDGDecoder(data);canvas.hidden=false;$('stageContent').hidden=true;}
      if(song.lrc){const text=await song.lrc.text();if(token!==loadToken)return;currentLyrics=parseLRC(text);}
      if(token!==loadToken)return;
      if(song.file.url)media.src=song.file.url;else {current.url=URL.createObjectURL(song.file);media.src=current.url;}media.playbackRate=rate;media.volume=preferences.volume/100;
      if(song.format==='VIDEO'){media.hidden=false;$('stageContent').hidden=true;}
      if(currentLyrics.length&&!decoder&&song.format!=='VIDEO'){songPhase('Get ready…',token);await countIn(token);if(token!==loadToken)return;}
      await loadingDeadline(media.play(),20000,'Audio/video did not start. Try a supported file or press Play to retry.');
    }
    if(token!==loadToken)return;loading=false;$('stageStatus').textContent='Playing';updateControls();
  }catch(e){if(token!==loadToken)return;leadIn=null;loading=false;synth.pause();media.pause();toast(e.name==='NotAllowedError'?'Press Play to enable audio in your browser.':`Cannot play this file: ${e.message}`);updateControls();$('stageStatus').textContent='Playback unavailable';}
}
async function toggle(){
  if(loading)return;
  if(!current){if(queue.length)next();else toast('Add your own songs, then choose one to play.');return;}
  if(current.format==='MIDI'&&(!current.midi||!synth.song)){await playSong(songs.get(current.id));return;}
  try{if(current.format==='MIDI'){if(synth.playing)synth.pause();else await synth.play();}else{if(media.paused){if(media.ended)media.currentTime=0;await media.play();}else media.pause();}updateControls();}catch(e){toast('Unable to start playback: '+e.message);}
}
function next(){if(queue.length){const id=queue.shift();renderQueue();void playSong(songs.get(id));}else{stop();toast('No songs reserved. Add a song to the queue.');}}
function stop(){songAbort?.abort();leadIn=null;if(loading){++loadToken;loading=false;}synth.stop();media.pause();if(media.src)media.currentTime=0;decoder?.seek(0);updateControls();$('stageStatus').textContent=current?'Stopped':'Ready to sing';}
function ended(){updateControls();$('stageStatus').textContent='Song finished';if(preferences.auto&&queue.length)next();}
synth.onended=ended;media.addEventListener('ended',ended);media.addEventListener('play',updateControls);media.addEventListener('pause',updateControls);
media.addEventListener('error',()=>{if(current&&media.getAttribute('src')){loading=false;toast('This audio/video codec is unavailable in your browser. Try MP3 audio or H.264 MP4.');updateControls();}});
function updateControls(){const midi=current?.format==='MIDI',playing=midi?synth.playing:!media.paused;
  $('stage').classList.toggle('loading',loading&&!leadIn);$('stageLabel').textContent=loading&&!leadIn?'LOADING SONG':'GET READY';
  backgrounds.sync(!!current&&((!loading&&playing)||!!leadIn),current?.format!=='VIDEO'&&!decoder);
  $('soundFont').disabled=loading||fontBusy;$('fontImport').disabled=loading||fontBusy;
  $('play').textContent=playing?'Ⅱ':'▶';$('play').disabled=loading||fontBusy;$('keyDown').disabled=!midi||key<=-12;$('keyUp').disabled=!midi||key>=12;
  $('tempoDown').disabled=rate<=.5;$('tempoUp').disabled=rate>=1.5;$('keyValue').textContent=key>0?'+'+key:key;$('tempoValue').textContent=Math.round(rate*100)+'%';
  if(current&&!loading)$('stageStatus').textContent=playing?'Playing':'Paused';
}
function changeKey(delta){key=Math.max(-12,Math.min(12,key+delta));synth.configure({key});updateControls();}
function changeTempo(delta){rate=Math.round(Math.max(.5,Math.min(1.5,rate+delta))*100)/100;synth.configure({rate});media.playbackRate=rate;updateControls();}
let lastLyricSignature='';
function fitLyrics(){
 const lyrics=$('lyrics');lyrics.style.setProperty('--lyric-scale',1);
 const rows=[...lyrics.querySelectorAll('.karaoke-line')];if(!rows.length||!lyrics.clientWidth)return;
 const widest=Math.max(...rows.map(row=>row.scrollWidth));
 lyrics.style.setProperty('--lyric-scale',Math.min(1,(lyrics.clientWidth-12)/widest));
}
new ResizeObserver(fitLyrics).observe($('stage'));
function renderLyrics(time){
  if(!current||(loading&&!leadIn)||decoder||current.format==='VIDEO')return;
  const adjusted=leadIn?Math.min(0,(performance.now()-leadIn.start)/1000-leadIn.seconds):time+preferences.offset;
  const duration=current.midi?.duration||media.duration||0;
  const view=lyricPresentation(currentLyrics,adjusted,duration,preferences.lines);
  for(const id of ['stageLabel','stageTitle','stageArtist'])$(id).hidden=!view.intro;
  $('stage').classList.toggle('singing',!view.intro&&!!currentLyrics.length);
  $('lyricCountdown').hidden=!view.countdown;$('lyricCountdown').textContent=view.countdown||'';
  const signature=`${current.id}:${view.start}:${preferences.lines}:${currentLyrics.length}`;
  if(signature!==lastLyricSignature){
    lastLyricSignature=signature;$('lyrics').replaceChildren();
    if(!currentLyrics.length){$('lyrics').append(node('p','lyric-note','No timed lyrics in this file. Add a matching .lrc or use a MIDI with lyrics.'));return;}
    for(const line of view.rows){
      const row=node('div','karaoke-line');
      for(const word of line.words?.length?line.words:[{text:line.text}]){
        const span=node('span','karaoke-word'),base=node('span','karaoke-base',word.text),fill=node('span','karaoke-fill',word.text);fill.setAttribute('aria-hidden','true');span.append(base,fill);row.append(span);
      }
      $('lyrics').append(row);
    }
    fitLyrics();
  }
  view.rows.forEach((line,rowIndex)=>{
    const row=$('lyrics').children[rowIndex];if(!row)return;
    row.classList.toggle('current',view.start+rowIndex===view.index);
    [...row.children].forEach((word,wordIndex)=>word.style.setProperty('--fill',`${lyricFill(line,wordIndex,adjusted,currentLyrics[view.start+rowIndex+1]?.time,duration)*100}%`));
  });
}
function frame(){
  const time=current?.format==='MIDI'?synth.time:media.currentTime||0,duration=current?.format==='MIDI'?synth.song?.duration||0:Number.isFinite(media.duration)?media.duration:0;
  $('elapsed').textContent=clock(time);$('duration').textContent=clock(duration);
  if(document.activeElement!==$('seek'))$('seek').value=duration?Math.min(1000,time/duration*1000):0;
  if(decoder){decoder.seek(time+preferences.offset);decoder.render(context);}renderLyrics(time);
  requestAnimationFrame(frame);
}
$('seek').addEventListener('input',()=>{const duration=current?.format==='MIDI'?synth.song?.duration:media.duration;if(!Number.isFinite(duration))return;const time=Number($('seek').value)/1000*duration;if(current?.format==='MIDI')synth.seek(time);else media.currentTime=time;});
$('volume').value=preferences.volume;synth.setVolume(preferences.volume/100);media.volume=preferences.volume/100;
$('volume').oninput=()=>{preferences.volume=Number($('volume').value);synth.setVolume(preferences.volume/100);media.volume=preferences.volume/100;save();};
$('play').onclick=toggle;$('stop').onclick=stop;$('next').onclick=next;$('keyDown').onclick=()=>changeKey(-1);$('keyUp').onclick=()=>changeKey(1);$('tempoDown').onclick=()=>changeTempo(-.05);$('tempoUp').onclick=()=>changeTempo(.05);
for(const id of ['import','emptyImport'])$(id).onclick=()=>$('files').click();
async function importSongFolder(selected){
 const selection=songFolderSelection(selected);
 if(!selection.files.length){$('importProgress').hidden=false;$('importProgress').textContent='No supported songs or ZIP files found. Select your songs folder, or a parent folder containing songs.';return;}
 await importFiles(selection.files);
 if(selection.restricted)$('importProgress').textContent+=' Imported only the songs folder; other folders were ignored.';
}
$('folderImport').onclick=async()=>{
 if('webkitdirectory' in $('folder')){$('folder').click();return;}
 if(typeof window.showDirectoryPicker==='function'){
  try{const directory=await window.showDirectoryPicker({mode:'read'});$('folderImport').disabled=true;await importSongFolder(await folderFiles(directory));}
  catch(error){if(error.name!=='AbortError'){$('importProgress').hidden=true;toast('Folder access was unavailable. Select files instead.');$('folderHelp').showModal();}}
  finally{$('folderImport').disabled=false;}
 }else $('folderHelp').showModal();
};
$('folderHelpClose').onclick=()=>$('folderHelp').close();
$('folderHelpFiles').onclick=()=>{$('folderHelp').close();$('files').click();};
$('folderHelpPicker').onclick=()=>{$('folderHelp').close();$('folder').click();};
$('files').onchange=async e=>{const selected=Array.from(e.target.files);e.target.value='';await importFiles(selected);};
$('folder').onchange=async e=>{const selected=Array.from(e.target.files);e.target.value='';if(selected.length)await importSongFolder(selected);};
document.addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('dragging');});document.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.body.classList.remove('dragging');});document.addEventListener('drop',e=>{e.preventDefault();document.body.classList.remove('dragging');void importFiles(e.dataTransfer.files);});
$('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{libraryIndex=0;renderLibrary();},100);};$('formatFilter').onchange=()=>{libraryIndex=0;renderLibrary();};
for(const [id,delta] of [['pagePrevious',-1],['pageNext',1]])$(id).onclick=()=>{libraryIndex+=delta;renderLibrary();$('libraryHeading').scrollIntoView({block:'start'});};
function nav(favorite){favoriteOnly=favorite;libraryIndex=0;$('songbook').hidden=true;$('playerWorkspace').hidden=false;$('catalogNav').classList.remove('active');$('favoriteNav').classList.toggle('active',favorite);$('libraryNav').classList.toggle('active',!favorite);history.replaceState(null,'',favorite?'#favorites':'#library');renderLibrary();}
function openSongbook(){
 $('playerWorkspace').hidden=true;$('songbook').hidden=false;$('catalogNav').classList.add('active');$('libraryNav').classList.remove('active');$('favoriteNav').classList.remove('active');history.replaceState(null,'','#catalog');renderSongbook();
}
$('catalogNav').onclick=openSongbook;
for(const letter of ['all','#',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']){const tab=button(letter==='all'?'All':letter,'Browse '+(letter==='all'?'all songs':letter),()=>{bookLetter=letter;bookPage=0;renderSongbook();},'book-letter');tab.dataset.letter=letter;$('bookLetters').append(tab);}
$('bookSearch').oninput=()=>{bookPage=0;renderSongbook();};
$('bookPrevious').onclick=()=>{bookPage--;renderSongbook();};$('bookNext').onclick=()=>{bookPage++;renderSongbook();};
const jumpBookPage=()=>{bookPage=Math.max(0,(Number($('bookJump').value)||1)-1);renderSongbook();};
$('bookJump').onchange=jumpBookPage;$('bookGo').onclick=jumpBookPage;
$('bookJump').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();jumpBookPage();}};
window.addEventListener('hashchange',()=>{if(location.hash==='#catalog')openSongbook();else nav(location.hash==='#favorites');});
$('libraryNav').onclick=()=>nav(false);$('favoriteNav').onclick=()=>nav(true);$('clearQueue').onclick=()=>{queue=[];renderQueue();};
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser.');}}
$('fullscreen').onclick=fullscreen;
$('settingsOpen').onclick=()=>$('settings').showModal();for(const id of ['helpOpen','formatsHelp'])$(id).onclick=()=>$('help').showModal();$('helpClose').onclick=()=>$('help').close();
function fontOptions(){
  const selected=$('soundFont').value;$('soundFont').replaceChildren(new Option('Built-in synth (no download)','builtin'));
  for(const [local,label] of [[false,'Included SoundFonts'],[true,'Your SoundFonts']]){
    const group=document.createElement('optgroup');group.label=label;
    for(const [id,font] of fonts)if(Boolean(font.file)===local)group.append(new Option(`${font.name} (${(font.bytes/1024/1024).toFixed(1)} MB)`,id));
    if(group.children.length)$('soundFont').append(group);
  }
  $('soundFont').value=fonts.has(selected)||selected==='builtin'?selected:'builtin';
}
async function loadFontCatalog(){
  try{
    const response=await fetch(new URL('../soundfonts.json?v=32',import.meta.url),{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('No included fonts');
    const catalog=await response.json();
    for(const font of catalog.fonts||[]){const url=new URL(font.url,new URL('../soundfonts.json',import.meta.url));if(typeof font.id==='string'&&typeof font.name==='string'&&Number.isSafeInteger(font.bytes)&&font.bytes>=12&&font.bytes<=MAX_SOUNDFONT_BYTES&&url.protocol==='https:')fonts.set(font.id,{...font,url:url.href});}
    if(fonts.has('karaoke-king')){
      if(['x2gs','standard'].includes(preferences.soundfont)||(!preferences.fontDefaultVersion&&preferences.soundfont==='builtin'))preferences.soundfont='karaoke-king';
      preferences.fontDefaultVersion=1;save();
    }
    fontOptions();
    if(fonts.has(preferences.soundfont)){$('soundFont').value=preferences.soundfont;$('fontStatus').textContent=`${fonts.get(preferences.soundfont).name} selected. Loads when you play MIDI.`;}
    else if(preferences.soundfont!=='builtin'){$('fontStatus').textContent='Add your personal SoundFont again to use it this session.';preferences.soundfont='builtin';save();}
  }catch{$('fontStatus').textContent='Included fonts could not load. You can still add your own SoundFont.';}
}
function ensureSoundFont(){
  if(fontPromise)return fontPromise;
  const id=$('soundFont').value,font=fonts.get(id);
  if(id===synth.fontID){preferences.soundfont=id;save();$('fontStatus').textContent=`Using ${synth.fontName}.`;return Promise.resolve();}
  fontBusy=true;fontAbort=new AbortController();$('soundFont').disabled=true;$('fontImport').disabled=true;$('fontCancel').hidden=!font?.url;$('fontCancel').disabled=false;updateControls();
  fontPromise=(async()=>{
    try{
      let buffer=null,reusedFont=false;
      if(font){
        $('fontStatus').textContent=`Loading ${font.name}…`;
        buffer=font.file?validateSoundFont(await font.file.arrayBuffer()):await cachedSoundFont(font,{
          read:id=>getLocalFile('fonts',id),write:record=>saveLocalFiles('fonts',[record]),
          download:()=>downloadSoundFont(font,{signal:AbortSignal.any([fontAbort.signal,AbortSignal.timeout(180000)]),onProgress:value=>{$('fontStatus').textContent=`Downloading ${font.name}: ${Math.round(value*100)}%`;if(loading)$('stageStatus').textContent=$('fontStatus').textContent;}}),
          onCached:()=>{reusedFont=true;$('fontCancel').hidden=true;$('fontStatus').textContent=`Loading saved ${font.name}…`;},
          onSaveFailure:()=>{$('storageStatus').textContent='Default SoundFont is kept for this session. Browser storage is full or unavailable, so a refresh may require another download.';}
        });
        $('fontStatus').textContent=`Preparing ${font.name} instruments…`;if(loading)$('stageStatus').textContent=$('fontStatus').textContent;$('fontCancel').disabled=true;
      }
      await synth.setSoundFont(buffer,{id,name:font?.name||'Built-in synth'});
      preferences.soundfont=id;save();$('fontStatus').textContent=`Using ${synth.fontName}.${reusedFont?' Reused the saved download.':''}`;
      if(current?.format==='MIDI')$('formatTag').textContent='MIDI · '+synth.fontName;
    }catch(error){
      // Keep the requested selection so a temporary failure does not become
      // the saved default. The previous engine stays available until retry.
      preferences.soundfont=id;save();$('fontStatus').textContent=error.name==='AbortError'?`Download canceled. Select again to retry.`:`Unable to load SoundFont: ${error.message}. Select again to retry.`;throw error;
    }finally{fontBusy=false;fontPromise=null;fontAbort=null;$('soundFont').disabled=false;$('fontImport').disabled=false;$('fontCancel').hidden=true;updateControls();}
  })();return fontPromise;
}
$('soundFont').onchange=()=>void ensureSoundFont().catch(error=>{if(error.name!=='AbortError')toast(error.message);});
$('fontCancel').onclick=()=>fontAbort?.abort();
$('fontImport').onclick=()=>$('fontFiles').click();
$('fontFiles').onchange=async event=>{
  await localLibraryReady;const epoch=sessionEpoch;
  const added=[],errors=[];
  for(const file of event.target.files){
    try{if(!/\.sf2$/i.test(file.name))throw Error('Choose an .sf2 file.');validateSoundFontHeader(await file.slice(0,12).arrayBuffer(),file.size);if(epoch!==sessionEpoch)return;const id=`local:${file.name}:${file.size}:${file.lastModified}`;fonts.set(id,{name:file.name,bytes:file.size,file});added.push(id);try{await saveLocalFiles('fonts',[{id,name:file.name,bytes:file.size,file}]);}catch{$('storageStatus').textContent='SoundFont works this session, but browser storage is full or unavailable.';}}
    catch(error){errors.push(`${file.name}: ${error.message}`);}
  }
  event.target.value='';fontOptions();
  if(added.length){$('soundFont').value=added[0];await ensureSoundFont().catch(error=>errors.push(error.message));}
  if(errors.length)toast(errors.slice(0,2).join(' · '));
};
for(let ch=0;ch<16;ch++)$('melodyChannel').append(new Option(`Channel ${ch+1}${ch===9?' (drums)':''}`,String(ch)));
$('lyricLines').value=preferences.lines;$('stage').dataset.lines=preferences.lines;$('lyricOffset').value=preferences.offset;$('melodyChannel').value=preferences.melody;$('autoAdvance').checked=preferences.auto;
$('lyricEncoding').value=preferences.textEncoding;
$('lyricEncoding').onchange=async()=>{
  preferences.textEncoding=$('lyricEncoding').value;save();
  if(current?.format!=='MIDI'||loading)return;
  const token=loadToken,id=current.id;
  try{const song=songs.get(id),midi=parseMidi(await song.file.arrayBuffer(),{textEncoding:preferences.textEncoding});if(token!==loadToken||current?.id!==id)return;rememberMidi(song,midi);current.midi=midi;currentLyrics=midi.lyrics;lastLyricSignature='';}catch(e){toast('Unable to update lyrics: '+e.message);}
};
for(const id of ['lyricLines','lyricOffset','melodyChannel','autoAdvance'])$(id).onchange=()=>{
  preferences.lines=Number($('lyricLines').value);$('stage').dataset.lines=preferences.lines;preferences.offset=Math.max(-10,Math.min(10,Number($('lyricOffset').value)||0));preferences.melody=Number($('melodyChannel').value);preferences.auto=$('autoAdvance').checked;synth.configure({mutedChannel:preferences.melody});lastLyricSignature='';save();
};
document.addEventListener('keydown',e=>{
  if(e.key==='F1'){e.preventDefault();if($('stageBrowser').open||document.fullscreenElement===$('stage'))openStageBrowser();else ($('songbook').hidden?$('search'):$('bookSearch')).focus();return;}if(e.key==='F9'){e.preventDefault();if(!$('settings').open)$('settings').showModal();return;}
  if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;
  if(e.code==='Space'){e.preventDefault();void toggle();}if(e.key==='F11'){e.preventDefault();void fullscreen();}
});
renderLibrary();renderQueue();updateControls();requestAnimationFrame(frame);if(location.hash==='#catalog')openSongbook();else if(location.hash==='#favorites')nav(true);
$('libraryInfo').textContent='Add your own MIDI, ZIP, audio + CDG, or video files. Songs stay on your device.';
async function restoreLocalLibrary(){
 try{
  const results=await Promise.allSettled([loadLocalFiles('songs',{onProgress:count=>{$('storageStatus').textContent=`Reading saved songs: ${count.toLocaleString()}…`;}}),loadLocalFiles('fonts')]);
  const savedSongs=results[0].status==='fulfilled'?results[0].value:[];
  const personalFonts=(results[1].status==='fulfilled'?results[1].value:[]).filter(font=>!font.hosted);
  for(const font of personalFonts)fonts.set(font.id,font);
  if(savedSongs.length){$('storageStatus').textContent=`Preparing ${savedSongs.length.toLocaleString()} saved songs…`;await importFiles(savedSongs.map(e=>({...e,deferMidi:true})),{silent:true,restore:true});}
  const failures=results.filter(result=>result.status==='rejected');
  $('storageStatus').textContent=`Restored ${songs.size.toLocaleString()} songs and ${personalFonts.length} personal SoundFonts from this browser.${failures.length?' '+(failures[0].reason?.message||'Some saved files could not be read.')+' Saved files have not been deleted. You can still add files for this session.':''}`;
  $('storageRetry').hidden=!failures.length;
 }catch(error){$('storageStatus').textContent=`${error.message||'Browser storage is unavailable.'} Saved files have not been deleted. You can still add files for this session.`;$('storageRetry').hidden=false;}
}
$('storageRetry').onclick=()=>location.reload();
const localLibraryReady=restoreLocalLibrary();
const fontCatalogReady=localLibraryReady.then(loadFontCatalog);
$('clearLibrary').onclick=async()=>{
 $('clearLibrary').disabled=true;++sessionEpoch;
 try{fontAbort?.abort();if(fontPromise)await fontPromise.catch(()=>{});await localLibraryReady;await clearLocalLibrary();preferences.soundfont='karaoke-king';favorites.clear();save();halt();location.reload();}
 catch{$('storageStatus').textContent='Could not clear browser storage. Please try again.';$('clearLibrary').disabled=false;}
};
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
