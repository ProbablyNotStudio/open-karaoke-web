import {setupSearchKeyboard,indexSongNumbers,numberedMatches} from './search-keyboard.js?v=42';
import {validQueue,moveQueueEntry,formatBytes} from './queue.js?v=42';
import {loadingDeadline} from './loading.js?v=42';
import {readMidi} from './midi-loader.js?v=42';
import {lyricPresentation,lyricFill} from './lyrics.js?v=42';
import {parseName,parseMidi,parseLRC} from './formats.js?v=42';
import {SoundFontSynth} from './soundfont-synth.js?v=42';
import {MAX_SOUNDFONT_BYTES,validateSoundFont,validateSoundFontHeader,downloadSoundFont} from './soundfonts.js?v=42';
import {CDGDecoder} from './cdg.js';
import {SUPPORTED,MIDI,unpackZip,songFormat} from './library.js?v=42';
import {libraryPage,searchText,createSongOrder} from './search.js?v=42';
import {saveLocalFiles,loadLocalFiles,getLocalFile,clearLocalFiles,localStorageUsage} from './storage.js?v=42';
import {cachedSoundFont} from './font-cache.js?v=42';
import {runImportBatches,importQueue} from './import-batch.js?v=42';
import {songbookPage} from './catalog.js?v=42';
import {setupBackgrounds} from './backgrounds.js?v=42';
import {folderFiles,songFolderSelection} from './folder.js?v=42';
import {storedFile,fileBlob,fileDigest} from './import-memory.js?v=42';
import {defaultSoundFont,setupMobileViewport} from './device.js?v=42';
setupMobileViewport(document.getElementById('stageBrowser'));setupMobileViewport(document.getElementById('stage'));
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
const savedQueue=validQueue(readJSON('open-karaoke-queue',[]));
let favorites=new Set(readJSON('open-karaoke-favorites',[]));
let preferences={lines:2,offset:0,melody:-1,auto:true,volume:65,textEncoding:'auto',soundfont:defaultSoundFont(),background:'none',backgroundFolder:'all',...readJSON('open-karaoke-settings',{})};
// Restore generated instruments immediately, even while a large saved song
// library is still loading or the included-font catalog is unavailable.
if(['builtin','builtin-enhanced'].includes(preferences.soundfont)){
  $('soundFont').value=preferences.soundfont;
  $('fontStatus').textContent=`${preferences.soundfont==='builtin-enhanced'?'Enhanced synth':'Built-in synth'} selected. Ready when you play MIDI.`;
}
let restoringLibrary=true,lastRestorePaint=0,lastRestorePhase='';
const fonts=new Map();let fontBusy=false,fontPromise=null,fontAbort=null;
let libraryIndex=0,searchTimer;
let stagePage=0,stageSearchTimer,numberIndexSize=-1,numberIndex=new Map();
function numberedSongs(){
 if(numberIndexSize!==songs.size){numberIndex=indexSongNumbers(songs.values());numberIndexSize=songs.size;}
 return numberedMatches(numberIndex,$('stageSearch').value);
}
function updateNumberSelection(){const matches=numberedSongs();$('stageBrowser').classList.toggle('number-ambiguous',matches.length>1);const song=matches.length===1?matches[0]:null;$('stageNumberMatch').textContent=song?`${song.number} · ${song.title} — ${song.artist}`:restoringLibrary?'Your songs are loading…':matches.length>1?'More than one song uses this number. Choose from the list.':'Enter a song number. You can also use ABC to search by title.';$('stageNumberReserve').disabled=!song;$('stageNumberPlay').disabled=!song;return song;}
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
  $('songList').replaceChildren();$('empty').hidden=restoringLibrary||songs.size>0;
  $('libraryPages').hidden=!songs.size;$('pageSummary').textContent=result.total?`${result.start.toLocaleString()}–${result.end.toLocaleString()} of ${result.total.toLocaleString()} songs`:'No matches';
  $('pagePrevious').disabled=result.page===0;$('pageNext').disabled=result.page===result.pages-1;
  if(!list.length&&songs.size){$('songList').append(node('p','empty','No matching songs. Try another search or format.'));}
  for(const song of list){
    const row=node('div','song-row'),details=button('','Play '+song.title,()=>playSong(song),'song-details');
    details.append(node('span','song-number',song.number));const text=node('span','song-text');text.append(node('strong','',song.title),node('small','',song.artist+' · '+'Your file'));details.append(text);
    const pill=node('span','format-pill '+(song.format==='CDG'?'cdg':''),song.format);
    const actions=node('div','song-actions');actions.append(button(favorites.has(song.id)?'♥':'♡','Favorite '+song.title,()=>{favorites.has(song.id)?favorites.delete(song.id):favorites.add(song.id);save();renderLibrary();},'favorite '+(favorites.has(song.id)?'selected':'')),button('▶','Play '+song.title,()=>playSong(song),'row-play'),button('+','Reserve '+song.title,()=>{queue.push(song.id);persistQueue();renderQueue();toast('Reserved: '+song.title);},'reserve'));
    row.append(details,pill,actions);$('songList').append(row);
  }
  if(!$('songbook').hidden)renderSongbook();
  if($('stageBrowser').open)renderStageSongs();
}
function renderStageSongs(){
 const numbered=numberedSongs();
 const result=libraryPage(numbered.length?numbered:songOrder.get(),{query:numbered.length?'':$('stageSearch').value,page:stagePage,size:20,ordered:true});stagePage=result.page;updateNumberSelection();
 const list=$('stageResults');list.replaceChildren();list.scrollTop=0;
 $('stagePageSummary').textContent=result.total?`${result.start.toLocaleString()}–${result.end.toLocaleString()} of ${result.total.toLocaleString()}`:'No matches';
 $('stagePagePrevious').disabled=stagePage===0;$('stagePageNext').disabled=stagePage===result.pages-1;
 if(!result.rows.length)list.append(node('p','stage-browser-empty',restoringLibrary?'Your saved songs are loading. Please wait…':songs.size?'No matches. Try another title, artist or song number.':'Add your songs to the library first, then find them here.'));
 for(const song of result.rows){
  const row=node('div','stage-song'),info=node('div','stage-song-info');info.append(node('span','song-number',song.number),node('strong','',song.title),node('small','',song.artist));
  const actions=node('div','stage-song-actions');
  actions.append(button('▶','Play '+song.title+' now',()=>{if(!$('stage').classList.contains('mobile-controls'))$('stageBrowser').close();void playSong(song);},'stage-song-play'),button('+ Queue','Add '+song.title+' to queue',()=>{queue.push(song.id);persistQueue();renderQueue();$('stageBrowserStatus').textContent=`Added ${song.title} to the queue. ${queue.length} song(s) reserved.`;},'stage-song-add'));
  row.append(info,actions);list.append(row);
 }
}
function persistQueue(){
 try{localStorage.setItem('open-karaoke-queue',JSON.stringify(queue));$('queueSaveStatus').textContent='Queue saved in this browser. Repeated songs are welcome.';}
 catch{$('queueSaveStatus').textContent='Queue works this session, but this browser could not save it.';}
}
function queueActions(index,song){
 const actions=node('div','queue-actions');
 for(const [label,delta,description] of [['↑',-1,'up'],['↓',1,'down']]){
  const control=button(label,`Move ${song.title} ${description}`,()=>{queue=moveQueueEntry(queue,index,delta);persistQueue();renderQueue();$('stageBrowserStatus').textContent=`Moved ${song.title} ${description}.`;});
  control.disabled=index+delta<0||index+delta>=queue.length;actions.append(control);
 }
 actions.append(button('×',`Remove ${song.title} from queue`,()=>{queue.splice(index,1);persistQueue();renderQueue();$('stageBrowserStatus').textContent=`Removed ${song.title} from the queue.`;}));
 return actions;
}
function renderStageQueue(){
 $('stageQueueCount').textContent=queue.length;const list=$('stageQueueList');list.replaceChildren();
 if(!queue.length)list.append(node('p','stage-browser-empty','No songs reserved yet.'));
 queue.forEach((id,index)=>{const song=songs.get(id);if(!song)return;const row=node('div','stage-queue-song');row.append(node('span','queue-index',String(index+1)),node('strong','',song.title),queueActions(index,song));list.append(row);});
}
function isStageFullscreen(){return document.fullscreenElement===$('stage')||$('stage').classList.contains('stage-expanded');}
function openStageBrowser(){
 if(!isStageFullscreen())return;const docked=$('stage').classList.contains('mobile-controls');stageKeyboard.open({force:docked});
 if(!$('stageBrowser').open){if(docked)$('stageBrowser').show();else $('stageBrowser').showModal();}renderStageSongs();renderStageQueue();$('stageSearch').focus();
}
$('dockPause').onclick=()=>void toggle();$('dockNext').onclick=next;$('dockStop').onclick=stop;
$('stageSongs').onclick=openStageBrowser;$('stageBrowserClose').onclick=()=>$('stageBrowser').close();
function searchStage(){clearTimeout(stageSearchTimer);stageSearchTimer=setTimeout(()=>{stagePage=0;renderStageSongs();},100);}
$('stageSearch').oninput=searchStage;
const stageKeyboard=setupSearchKeyboard({input:$('stageSearch'),container:$('stageKeyboard'),wrapper:$('stageInputPad'),toggle:$('stageKeyboardToggle'),onChange:searchStage,onMode:numbers=>{$('stageNumberActions').hidden=!numbers;}});
$('stageNumberReserve').onclick=()=>{const song=updateNumberSelection();if(!song)return;queue.push(song.id);persistQueue();renderQueue();$('stageBrowserStatus').textContent=`Reserved ${song.title}. ${queue.length} songs up next.`;};
$('stageNumberPlay').onclick=()=>{const song=updateNumberSelection();if(song){if(!$('stage').classList.contains('mobile-controls'))$('stageBrowser').close();void playSong(song);}};
$('stageNumberQueue').onclick=()=>{document.querySelector('.stage-browser-queue').open=true;renderStageQueue();};
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
  actions.append(button('▶','Play '+song.title,()=>{nav(false);void playSong(song);},'book-play'),button('+','Reserve '+song.title,()=>{queue.push(song.id);persistQueue();renderQueue();toast('Reserved: '+song.title);},'book-reserve'));
  row.append(number,text,actions);$('bookEntries').append(row);
 }
 for(const tab of $('bookLetters').children)tab.setAttribute('aria-pressed',String(tab.dataset.letter===bookLetter));
}
function renderQueue(){
  $('queueCount').textContent=queue.length;$('queueEmpty').hidden=queue.length>0;$('queueList').replaceChildren();
  queue.forEach((id,index)=>{const s=songs.get(id);if(!s)return;const row=node('div','queue-item'),info=node('div','queue-info');info.append(node('strong','',s.title),node('small','',s.artist));
    row.append(node('span','queue-index',String(index+1).padStart(2,'0')),info);
    row.append(queueActions(index,s));$('queueList').append(row);
  });$('nextSong').textContent=queue.length?'Next: '+songs.get(queue[0])?.title:'No song reserved';
  if($('stageBrowser').open)renderStageQueue();
}
function pair(song){const stem=song.id.replace(/\.[^.]+$/,'');song.cdg=files.get(stem+'.cdg');song.lrc=files.get(stem+'.lrc');song.format=songFormat(song.file.name,!!song.cdg);}
const queueImport=importQueue(performImport);
function importFiles(selected,options={}){return options.restore?performImport(Array.from(selected),options):queueImport(selected,options);}
async function performImport(selected,{silent=false,restore=false,onRestoreProgress=()=>{}}={}){
  if(!restore)await localLibraryReady;
  const epoch=sessionEpoch,companions=[];let count=0,skipped=0,errors=[],saveFailed=false;
  const hashes=new Set([...songs.values()].map(song=>song.digest).filter(Boolean));
  const candidates=new Map();
  for(const file of files.values()){const key=file.name.toLowerCase()+':'+file.size;if(!candidates.has(key))candidates.set(key,[]);candidates.get(key).push(file);}
  const active=!silent;
  if(active){$('importProgress').hidden=false;for(const id of ['import','emptyImport','folderImport'])$(id).disabled=true;}
  try{
    await runImportBatches(selected,{
      size:25,expand:unpackZip,onIssue:issue=>errors.push(issue),
      onProgress:({name,input,inputs,processed,total})=>{if(restore)onRestoreProgress(input,inputs);if(active)$('importProgress').textContent=`Importing ${input} of ${inputs}: ${name}${total?` · ${processed.toLocaleString()} / ${total.toLocaleString()} files`:''} · ${count.toLocaleString()} songs added. Keep this tab open.`;},
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
            let digest=details.digest;
            if(!restore&&source==='local'&&!['cdg','lrc'].includes(ext)){
              digest=await fileDigest(file,entry.buffer);
              let duplicate=hashes.has(digest);
              if(!duplicate)for(const previous of candidates.get(file.name.toLowerCase()+':'+file.size)||[]){if(await fileDigest(previous)===digest){duplicate=true;break;}}
              if(duplicate){skipped++;continue;}
            }
            if(MIDI.test(file.name)){
              const midi=entry.deferMidi?null:parseMidi(entry.buffer||await file.arrayBuffer(),{textEncoding:preferences.textEncoding,metadataOnly:true});
              files.set(id,file);const song={id,file,path,source,...metadata};songs.set(id,song);song.digest=digest;if(midi)updateMidiMetadata(song,midi);count++;
              if(midi?.compatibility?.skippedEvents)errors.push({path,status:'Recovered',reason:`Added using MIDI compatibility mode. ${midi.compatibility.skippedEvents} invalid event(s) were skipped; some musical details may differ. You do not need to reimport this file.`});
            }else{files.set(id,file);if(!['cdg','lrc'].includes(ext)){songs.set(id,{id,file,path,source,...metadata,digest});count++;}else companions.push({id,path});}
            if(source==='local')records.push({id,file,path,source,details:songs.has(id)?(({title,artist,number,digest})=>({title,artist,number,digest}))(songs.get(id)):details});
            if(digest)hashes.add(digest);
          }catch(error){errors.push({path,reason:error.message,status:'Failed'});}
        }
        if(epoch!==sessionEpoch)throw Error('Import canceled because the library was reset.');
        if(!restore&&records.length){try{await saveLocalFiles('songs',records);for(const record of records){const lazy=storedFile(record,getLocalFile);files.set(record.id,lazy);const song=songs.get(record.id);if(song)song.file=lazy;}}catch{saveFailed=true;errors.push({path:`Saving files: ${records[0].path} … ${records.at(-1).path}`,reason:'Browser storage is full or unavailable. These files work this session, but may need importing again after reloading.',status:'Not saved'});}}
        // Give the browser time to paint progress and release temporary MIDI data.
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    });
    for(const song of songs.values()){pair(song);if(!song.searchText)song.searchText=searchText(song);}
    const paired=new Set([...songs.values()].flatMap(song=>[song.cdg,song.lrc]).filter(Boolean));
    for(const entry of companions)if(!paired.has(files.get(entry.id)))errors.push({path:entry.path,status:'Needs audio',reason:'Added, but no matching audio file was found. Add the audio with the same filename stem in the same folder.'});
    renderLibrary();renderQueue();
    if(!restore)$('storageStatus').textContent=saveFailed?'Some files could not be saved. See the import results.':'Your songs and SoundFonts are saved in this browser.';
    if(active){$('importProgress').textContent=`Finished ${selected.length} selected file(s)/ZIP(s): ${count.toLocaleString()} songs added. ${skipped.toLocaleString()} duplicate files skipped. Library total: ${songs.size.toLocaleString()}.${errors.length?` ${errors.length.toLocaleString()} items need attention.`:''}`;toast(`${count.toLocaleString()} song(s) added.${errors.length?' Some files need attention.':''}`);if(errors.length)showImportReport(count,errors);}
    return {count,errors};
  }catch(error){renderLibrary();renderQueue();errors.push({path:'Import batch',reason:error.message,status:'Failed'});if(active){$('importProgress').textContent=`Import stopped: ${error.message}`;showImportReport(count,errors);}return {count,errors};}
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
      if(song.file.url)media.src=song.file.url;else {const blob=await fileBlob(song.file);if(token!==loadToken)return;current.url=URL.createObjectURL(blob);media.src=current.url;}media.playbackRate=rate;media.volume=preferences.volume/100;
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
function next(){if(queue.length){const id=queue.shift();persistQueue();renderQueue();const song=songs.get(id);if(song)void playSong(song);else next();}else{stop();toast('No songs reserved. Add a song to the queue.');}}
function stop(){songAbort?.abort();leadIn=null;if(loading){++loadToken;loading=false;}synth.stop();media.pause();if(media.src)media.currentTime=0;decoder?.seek(0);updateControls();$('stageStatus').textContent=current?'Stopped':'Ready to sing';}
function ended(){updateControls();$('stageStatus').textContent='Song finished';if(preferences.auto&&queue.length)next();}
synth.onended=ended;media.addEventListener('ended',ended);media.addEventListener('play',updateControls);media.addEventListener('pause',updateControls);
media.addEventListener('error',()=>{if(current&&media.getAttribute('src')){loading=false;toast('This audio/video codec is unavailable in your browser. Try MP3 audio or H.264 MP4.');updateControls();}});
function updateControls(){const midi=current?.format==='MIDI',playing=midi?synth.playing:!media.paused;
  $('stage').classList.toggle('loading',loading&&!leadIn);$('stageLabel').textContent=loading&&!leadIn?'LOADING SONG':'GET READY';
  backgrounds.sync(!!current&&((!loading&&playing)||!!leadIn),current?.format!=='VIDEO'&&!decoder);
  $('soundFont').disabled=loading||fontBusy;$('fontImport').disabled=loading||fontBusy;$('fontLight').disabled=loading||fontBusy;
  $('dockPause').disabled=loading||fontBusy;$('dockPause').textContent=playing?'Ⅱ':'▶';$('play').textContent=playing?'Ⅱ':'▶';$('play').disabled=loading||fontBusy;$('keyDown').disabled=!midi||key<=-12;$('keyUp').disabled=!midi||key>=12;
  $('tempoDown').disabled=rate<=.5;$('tempoUp').disabled=rate>=1.5;$('keyValue').textContent=key>0?'+'+key:key;$('tempoValue').textContent=Math.round(rate*100)+'%';
  if(current&&!loading)$('stageStatus').textContent=playing?'Playing':'Paused';
}
function changeKey(delta){key=Math.max(-12,Math.min(12,key+delta));synth.configure({key});updateControls();}
function changeTempo(delta){rate=Math.round(Math.max(.5,Math.min(1.5,rate+delta))*100)/100;synth.configure({rate});media.playbackRate=rate;updateControls();}
let lastLyricSignature='',lastLyricTime=null;
const lyricFills=new WeakMap();
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
  const renderKey=`${current.id}:${adjusted}:${preferences.lines}:${currentLyrics.length}`;
  if(lastLyricSignature&&renderKey===lastLyricTime)return;lastLyricTime=renderKey;
  const duration=current.midi?.duration||media.duration||0;
  const view=lyricPresentation(currentLyrics,adjusted,duration,preferences.lines);
  for(const id of ['stageLabel','stageTitle','stageArtist'])$(id).hidden=!view.intro;
  $('stage').classList.toggle('singing',!view.intro&&!!currentLyrics.length);
  $('lyricCountdown').hidden=!view.countdown;$('lyricCountdown').textContent=view.countdown||'';
  const signature=`${current.id}:${view.rowIndices.join(',')}:${preferences.lines}:${currentLyrics.length}`;
  if(signature!==lastLyricSignature){
    lastLyricSignature=signature;$('lyrics').replaceChildren();
    if(!currentLyrics.length){$('lyrics').append(node('p','lyric-note','No timed lyrics in this file. Add a matching .lrc or use a MIDI with lyrics.'));return;}
    for(const line of view.rows){
      const row=node('div','karaoke-line');
      if(!line){$('lyrics').append(row);continue;}
      for(const word of line.words?.length?line.words:[{text:line.text}]){
        const span=node('span','karaoke-word'),base=node('span','karaoke-base',word.text),fill=node('span','karaoke-fill',word.text);fill.setAttribute('aria-hidden','true');span.append(base,fill);row.append(span);
      }
      $('lyrics').append(row);
    }
    fitLyrics();
  }
  view.rows.forEach((line,rowIndex)=>{
    const row=$('lyrics').children[rowIndex];if(!row||!line)return;
    row.classList.toggle('current',view.rowIndices[rowIndex]===view.index);
    [...row.children].forEach((word,wordIndex)=>{
      const fill=Math.round(lyricFill(line,wordIndex,adjusted,currentLyrics[view.rowIndices[rowIndex]+1]?.time,duration)*1000)/10;
      if(lyricFills.get(word)!==fill){word.style.setProperty('--fill',`${fill}%`);lyricFills.set(word,fill);}
    });
  });
}
let lastFrame=0;
function frame(stamp){
  const moving=!!leadIn||(current?.format==='MIDI'?synth.playing:!media.paused);
  if(!moving&&stamp-lastFrame<250){requestAnimationFrame(frame);return;}lastFrame=stamp;
  const time=current?.format==='MIDI'?synth.time:media.currentTime||0,duration=current?.format==='MIDI'?synth.song?.duration||0:Number.isFinite(media.duration)?media.duration:0;
  if($('elapsed').textContent!==clock(time))$('elapsed').textContent=clock(time);if($('duration').textContent!==clock(duration))$('duration').textContent=clock(duration);
  const seekValue=duration?Math.round(Math.min(1000,time/duration*1000)):0;
  if(document.activeElement!==$('seek')&&Number($('seek').value)!==seekValue)$('seek').value=seekValue;
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
$('libraryNav').onclick=()=>nav(false);$('favoriteNav').onclick=()=>nav(true);$('clearQueue').onclick=()=>{queue=[];persistQueue();renderQueue();toast('Queue cleared. Your songs are still in the library.');};
function syncStageLayout(){
 const active=isStageFullscreen(),mobile=active&&(matchMedia('(pointer:coarse)').matches||window.innerWidth<=900),wasMobile=$('stage').classList.contains('mobile-controls');
 const wasOpen=$('stageBrowser').open;
 if(wasOpen&&(!active||mobile!==wasMobile))$('stageBrowser').close();
 $('stage').classList.toggle('mobile-controls',mobile);
 if(mobile&&!wasMobile){stageKeyboard.open({force:true,numeric:true});openStageBrowser();}
 else if(active&&wasOpen&&mobile!==wasMobile)openStageBrowser();
}
document.addEventListener('fullscreenchange',syncStageLayout);window.addEventListener('resize',syncStageLayout);
function expandedStage(value){
 if(!value&&$('stageBrowser').open)$('stageBrowser').close();
 $('stage').classList.toggle('stage-expanded',value);document.body.classList.toggle('stage-expanded-open',value);
 $('fullscreen').setAttribute('aria-label',value?'Exit expanded stage':'Fullscreen stage');syncStageLayout();
}
async function fullscreen(){
 if($('stage').classList.contains('stage-expanded')){expandedStage(false);return;}
 try{if(document.fullscreenElement)await document.exitFullscreen();else if($('stage').requestFullscreen)await $('stage').requestFullscreen();else expandedStage(true);}catch{expandedStage(true);}
}
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('stageBrowser').open)expandedStage(false);});
$('fullscreen').onclick=fullscreen;
function openSettings(){$('settings').showModal();void refreshStorageUsage();}
$('settingsOpen').onclick=openSettings;for(const id of ['helpOpen','formatsHelp'])$(id).onclick=()=>$('help').showModal();$('helpClose').onclick=()=>$('help').close();
function fontOptions(){
  const selected=$('soundFont').value;$('soundFont').replaceChildren(new Option('Built-in synth (no download)','builtin'),new Option('Enhanced synth (no download)','builtin-enhanced'));
  for(const [local,label] of [[false,'Included SoundFonts'],[true,'Your SoundFonts']]){
    const group=document.createElement('optgroup');group.label=label;
    for(const [id,font] of fonts)if(Boolean(font.file)===local)group.append(new Option(`${font.name} (${(font.bytes/1024/1024).toFixed(1)} MB)`,id));
    if(group.children.length)$('soundFont').append(group);
  }
  $('soundFont').value=fonts.has(selected)||['builtin','builtin-enhanced'].includes(selected)?selected:'builtin';
}
async function loadFontCatalog(){
  fontOptions();if(['builtin','builtin-enhanced'].includes(preferences.soundfont))$('soundFont').value=preferences.soundfont;
  try{
    const response=await fetch(new URL('../soundfonts.json?v=42',import.meta.url),{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('No included fonts');
    const catalog=await response.json();
    for(const font of catalog.fonts||[]){const url=new URL(font.url,new URL('../soundfonts.json',import.meta.url));if(typeof font.id==='string'&&typeof font.name==='string'&&Number.isSafeInteger(font.bytes)&&font.bytes>=12&&font.bytes<=MAX_SOUNDFONT_BYTES&&url.protocol==='https:')fonts.set(font.id,{...font,url:url.href});}
    if(fonts.has('karaoke-king')){
      if(['x2gs','standard'].includes(preferences.soundfont)||(!preferences.fontDefaultVersion&&preferences.soundfont==='builtin'&&defaultSoundFont()==='karaoke-king'))preferences.soundfont='karaoke-king';
      preferences.fontDefaultVersion=1;save();
    }
    fontOptions();
    if(fonts.has(preferences.soundfont)){$('soundFont').value=preferences.soundfont;$('fontStatus').textContent=`${fonts.get(preferences.soundfont).name} selected. Loads when you play MIDI.`;}
    else if(['builtin','builtin-enhanced'].includes(preferences.soundfont)){$('soundFont').value=preferences.soundfont;$('fontStatus').textContent='Selected synth is ready. No SoundFont download needed.';}
    else{$('fontStatus').textContent='Add your personal SoundFont again to use it this session.';preferences.soundfont='builtin';save();}
  }catch{$('fontStatus').textContent='Included fonts could not load. You can still add your own SoundFont.';}
}
function ensureSoundFont(){
  if(fontPromise)return fontPromise;
  const id=$('soundFont').value,font=fonts.get(id);
  if(id===synth.fontID){preferences.soundfont=id;save();$('fontStatus').textContent=`Using ${synth.fontName}.`;return Promise.resolve();}
  fontBusy=true;fontAbort=new AbortController();$('soundFont').disabled=true;$('fontImport').disabled=true;$('fontLight').disabled=true;$('fontCancel').hidden=!font?.url;$('fontCancel').disabled=false;updateControls();
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
      await synth.setSoundFont(buffer,{id,name:font?.name||(id==='builtin-enhanced'?'Enhanced synth':'Built-in synth')});
      preferences.soundfont=id;save();$('fontStatus').textContent=`Using ${synth.fontName}.${reusedFont?' Reused the saved download.':''}`;
      if(current?.format==='MIDI')$('formatTag').textContent='MIDI · '+synth.fontName;
    }catch(error){
      // Keep the requested selection so a temporary failure does not become
      // the saved default. The previous engine stays available until retry.
      preferences.soundfont=id;save();$('fontStatus').textContent=error.name==='AbortError'?`Download canceled. Select again to retry.`:`Unable to load SoundFont: ${error.message}. Select again to retry.`;throw error;
    }finally{fontBusy=false;fontPromise=null;fontAbort=null;$('soundFont').disabled=false;$('fontImport').disabled=false;$('fontLight').disabled=false;$('fontCancel').hidden=true;updateControls();}
  })();return fontPromise;
}
$('soundFont').onchange=()=>void ensureSoundFont().catch(error=>{if(error.name!=='AbortError')toast(error.message);});
$('fontCancel').onclick=()=>fontAbort?.abort();
$('fontLight').onclick=()=>{$('soundFont').value='builtin';void ensureSoundFont().catch(error=>toast(error.message));};
$('fontImport').onclick=()=>$('fontFiles').click();
$('fontFiles').onchange=async event=>{
  await localLibraryReady;const epoch=sessionEpoch;
  const added=[],errors=[];
  for(const file of event.target.files){
    try{if(!/\.sf2$/i.test(file.name))throw Error('Choose an .sf2 file.');validateSoundFontHeader(await file.slice(0,12).arrayBuffer(),file.size);if(epoch!==sessionEpoch)return;const id=`local:${file.name}:${file.size}:${file.lastModified}`;fonts.set(id,{name:file.name,bytes:file.size,file});added.push(id);try{await saveLocalFiles('fonts',[{id,name:file.name,bytes:file.size,file}]);fonts.get(id).file=storedFile({id,file},getLocalFile,'fonts');}catch{$('storageStatus').textContent='SoundFont works this session, but browser storage is full or unavailable.';}}
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
  if(e.key==='F1'){e.preventDefault();if($('stageBrowser').open||(document.fullscreenElement===$('stage')||$('stage').classList.contains('stage-expanded')))openStageBrowser();else ($('songbook').hidden?$('search'):$('bookSearch')).focus();return;}if(e.key==='F9'){e.preventDefault();if(!$('settings').open)openSettings();return;}
  if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;
  if(e.code==='Space'){e.preventDefault();void toggle();}if(e.key==='F11'){e.preventDefault();void fullscreen();}
});
$('clearQueue').disabled=true;renderLibrary();renderQueue();updateControls();requestAnimationFrame(frame);if(location.hash==='#catalog')openSongbook();else if(location.hash==='#favorites')nav(true);
$('libraryInfo').textContent='Add your own MIDI, ZIP, audio + CDG, or video files. Songs stay on your device.';
function showRestoreProgress(phase,count=0,total=0){
  const busy=phase==='reading'||phase==='preparing',now=performance.now();
  if(busy&&phase===lastRestorePhase&&now-lastRestorePaint<100&&count!==total)return;
  lastRestorePaint=now;lastRestorePhase=phase;
  $('libraryRestore').hidden=phase==='ready'&&!songs.size;
  $('libraryRestore').classList.toggle('is-ready',phase==='ready');$('libraryRestore').classList.toggle('is-error',phase==='error');
  $('restoreIcon').textContent=busy?'':phase==='error'?'!':'✓';
  $('restoreTitle').textContent=phase==='reading'?'Loading your saved songs…':phase==='preparing'?'Preparing your song library…':phase==='error'?'Some saved files couldn’t load':'Your saved songs are ready';
  $('restoreDetail').textContent=phase==='reading'?(count?`${count.toLocaleString()} saved files read. Please keep this tab open.`:'Checking the songs saved in this browser. Please keep this tab open.'):phase==='preparing'?`${count.toLocaleString()} of ${total.toLocaleString()} saved files prepared. Almost ready to sing.`:phase==='error'?$('storageStatus').textContent:`${songs.size.toLocaleString()} songs restored. Search for a song and add it to your queue.`;
  $('restoreProgress').hidden=!busy;
  if(phase==='preparing'&&total){$('restoreProgress').max=total;$('restoreProgress').value=count;}else $('restoreProgress').removeAttribute('value');
  $('restoreRetry').hidden=phase!=='error';$('restoreDismiss').hidden=busy||phase==='error';
}
function finishRestore(failed=false){
  $('clearQueue').disabled=false;queue=validQueue(savedQueue,songs);if(!failed)persistQueue();else $('queueSaveStatus').textContent='Saved queue kept for retry; some songs could not load.';renderQueue();
  restoringLibrary=false;showRestoreProgress(failed?'error':'ready');
  for(const id of ['import','emptyImport','folderImport'])$(id).disabled=false;
  document.querySelector('.library').setAttribute('aria-busy','false');renderLibrary();
}
$('restoreRetry').onclick=()=>location.reload();$('restoreDismiss').onclick=()=>$('libraryRestore').hidden=true;
async function restoreLocalLibrary(){
 showRestoreProgress('reading');
 for(const id of ['import','emptyImport','folderImport'])$(id).disabled=true;
 document.querySelector('.library').setAttribute('aria-busy','true');
 let failed=false;
 try{
  const results=await Promise.allSettled([loadLocalFiles('songs',{mapRecord:record=>({...record,file:storedFile(record,getLocalFile)}),onProgress:count=>{showRestoreProgress('reading',count);$('storageStatus').textContent=`Reading saved songs: ${count.toLocaleString()}…`;}}),loadLocalFiles('fonts',{mapRecord:record=>({...record,file:storedFile(record,getLocalFile,'fonts')})})]);
  const savedSongs=results[0].status==='fulfilled'?results[0].value:[];
  const personalFonts=(results[1].status==='fulfilled'?results[1].value:[]).filter(font=>!font.hosted);
  for(const font of personalFonts)fonts.set(font.id,font);
  if(savedSongs.length){$('storageStatus').textContent=`Preparing ${savedSongs.length.toLocaleString()} saved songs…`;showRestoreProgress('preparing',0,savedSongs.length);const restored=await importFiles(savedSongs.map(e=>({...e,deferMidi:true})),{silent:true,restore:true,onRestoreProgress:(count,total)=>showRestoreProgress('preparing',count,total)});if(restored.errors.some(issue=>issue.status==='Failed'))failed=true;}
  const failures=results.filter(result=>result.status==='rejected');failed=failed||Boolean(failures.length);
  $('storageStatus').textContent=`Restored ${songs.size.toLocaleString()} songs and ${personalFonts.length} personal SoundFonts from this browser.${failures.length?' '+(failures[0].reason?.message||'Some saved files could not be read.')+' Saved files have not been deleted. You can still add files for this session.':''}`;
  $('storageRetry').hidden=!failed;
 }catch(error){failed=true;$('storageStatus').textContent=`${error.message||'Browser storage is unavailable.'} Saved files have not been deleted. You can still add files for this session.`;$('storageRetry').hidden=false;}
 finally{finishRestore(failed);}
}
$('storageRetry').onclick=()=>location.reload();
const localLibraryReady=restoreLocalLibrary();
const fontCatalogReady=localLibraryReady.then(loadFontCatalog);
async function clearSavedFiles(store){
 $('clearSongs').disabled=true;$('clearFonts').disabled=true;
 if(store==='songs')++sessionEpoch;
 try{
  fontAbort?.abort();if(fontPromise)await fontPromise.catch(()=>{});await localLibraryReady;
  await clearLocalFiles(store);
  if(store==='songs'){favorites.clear();queue=[];persistQueue();}
  else {preferences.soundfont='builtin';preferences.fontDefaultVersion=1;}
  save();halt();location.reload();
 }catch{$('storageStatus').textContent=`Could not clear saved ${store==='songs'?'songs':'SoundFonts'}. Please try again.`;$('clearSongs').disabled=false;$('clearFonts').disabled=false;}
}
$('clearSongs').onclick=()=>clearSavedFiles('songs');
$('clearFonts').onclick=()=>clearSavedFiles('fonts');
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});

let usageBusy=false,usageDirty=false;
async function refreshStorageUsage(){
 if(usageBusy){usageDirty=true;return;}usageBusy=true;usageDirty=false;$('storageRefresh').disabled=true;
 $('storageUsageStatus').textContent='Measuring saved files…';
 try{
  await Promise.all([localLibraryReady,backgrounds.ready]);
  const totals=await localStorageUsage();
  for(const [store,label] of [['songs','song & lyric files'],['fonts','SoundFonts'],['backgrounds','videos']]){
   $(store+'StorageSize').textContent=formatBytes(totals[store].bytes);
   $(store+'StorageCount').textContent=`${totals[store].count.toLocaleString()} ${totals[store].count===1?({'songs':'song or lyric file','fonts':'SoundFont','backgrounds':'video'}[store]):label}`;
  }
  const bytes=Object.values(totals).reduce((sum,total)=>sum+total.bytes,0);
  $('storageUsageStatus').textContent=`${formatBytes(bytes)} in saved files. Original files are untouched by cleanup.`;
  const estimate=await navigator.storage?.estimate?.().catch(()=>null);
  $('storageMeter').hidden=!estimate?.quota;
  if(estimate?.quota){$('storageMeter').max=estimate.quota;$('storageMeter').value=Math.min(estimate.usage||0,estimate.quota);}
  $('storageEstimate').textContent=estimate?.quota?`Browser estimate: ${formatBytes(estimate.usage||0)} used of ${formatBytes(estimate.quota)} allowed for this website. Includes caches and database overhead; available space can change.`:'This browser does not report its storage allowance. Saved file sizes are shown above.';
 }catch(error){$('storageUsageStatus').textContent=`Unable to measure saved files. ${error.message||'Try Refresh usage.'}`;$('storageMeter').hidden=true;}
 finally{usageBusy=false;$('storageRefresh').disabled=false;if(usageDirty&&$('settings').open)void refreshStorageUsage();}
}
$('storageRefresh').onclick=()=>void refreshStorageUsage();
// Refresh after local saves only while Settings is visible, never on playback frames.
let usageTimer;window.addEventListener('local-files-changed',()=>{clearTimeout(usageTimer);usageTimer=setTimeout(()=>{if($('settings').open)void refreshStorageUsage();},600);});

$('storageClearVideos').onclick=async()=>{if($('backgroundClear').disabled)return;$('storageClearVideos').disabled=true;try{await $('backgroundClear').onclick();await refreshStorageUsage();}finally{$('storageClearVideos').disabled=false;}};
