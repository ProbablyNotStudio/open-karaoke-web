import {storedFile,fileBlob} from './import-memory.js?v=35';
import {saveLocalFiles,loadLocalFiles,getLocalFile,clearLocalFiles} from './storage.js?v=35';
export function backgroundPath(path){
 path=String(path||'').replace(/\\/g,'/');
 // Android's document picker can encode the actual relative path inside a
 // Storage Access Framework document ID instead of returning normal folders.
 if(/(?:^|\/)tree\//.test(path)&&path.includes('/document/')){
  let document=path.slice(path.lastIndexOf('/document/')+10);
  for(let i=0;i<2&&/%[\da-f]{2}/i.test(document);i++){try{document=decodeURIComponent(document);}catch{break;}}
  document=document.replace(/^[^/]+:/,'').replace(/^\/+|\/+$/g,'');
  if(document)path=document;
 }
 return path;
}
const normalizedPath=backgroundPath;
export function backgroundImportPath(file,collection=''){
 const path=backgroundPath(file.webkitRelativePath||file.name),name=String(collection).trim().replace(/[\\/]/g,'-');
 return name?`${name}/${path.split('/').pop()}`:path;
}
export function folderBackgrounds(items,folder='all'){
 if(folder==='all')return items;
 const prefix=normalizedPath(folder).toLowerCase()+'/';
 return items.filter(item=>normalizedPath(item.path).toLowerCase().startsWith(prefix));
}
export function backgroundFolders(items){
 const folders=new Map();
 for(const item of items){const parts=normalizedPath(item.path).split('/');parts.pop();for(let depth=1;depth<=parts.length;depth++){const path=parts.slice(0,depth).join('/'),key=path.toLowerCase();const entry=folders.get(key)||{path,count:0};entry.count++;folders.set(key,entry);}}
 return [...folders.values()].sort((a,b)=>a.path.localeCompare(b.path,undefined,{numeric:true,sensitivity:'base'}));
}
export function chooseBackground(items,selection,previous,random=Math.random,folder='all'){
 items=folderBackgrounds(items,folder);
 if(selection==='none')return null;
 if(selection!=='random')return items.find(item=>item.id===selection)||null;
 const candidates=items.length>1?items.filter(item=>item.id!==previous):items;
 return candidates.length?candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))]:null;
}
export function setupBackgrounds({getSelection,setSelection,getFolder=()=> 'all',setFolder=()=>{},report}){
 const $=id=>document.getElementById(id),video=$('backgroundVideo'),items=new Map();
 let previous=null,url=null,active=false,visible=true,revision=0;
 const controls=['backgroundImport','backgroundFolderImport','backgroundClear'];
 const busy=value=>controls.forEach(id=>$(id).disabled=value);
 function render(){
  const all=[...items.values()],folderSelect=$('backgroundFolderSelect');folderSelect.replaceChildren(new Option('All videos','all'));
  for(const folder of backgroundFolders(all))folderSelect.append(new Option(`${folder.path} (${folder.count})`,folder.path));
  folderSelect.value=getFolder();if(!folderSelect.value){folderSelect.value='all';setFolder('all');}
  const available=folderBackgrounds(all,getFolder());
  const select=$('backgroundSelect');select.replaceChildren();
  for(const [value,label] of [['none','No background'],['random','Random video for each song']]){
   const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);
  }
  const groups=new Map();for(const item of available){const path=normalizedPath(item.path),folder=path.includes('/')?path.slice(0,path.lastIndexOf('/')):'Individual videos';let group=groups.get(folder);if(!group){group=document.createElement('optgroup');group.label=folder;groups.set(folder,group);select.append(group);}group.append(new Option(path.split('/').pop(),item.id));}
  select.value=getSelection();if(!select.value){select.value=available.length?'random':'none';setSelection(select.value);}
  $('backgroundScope').textContent=`${available.length} video(s) in ${getFolder()==='all'?'all folders':getFolder()}. Random mode changes video each song; choosing a video keeps it for every song.`;
  $('backgroundShuffle').disabled=!available.length;
 }
 function sync(playing=active,show=visible){
  active=playing;visible=show;video.hidden=!url||!visible;
  $('stage').classList.toggle('has-background',!!url&&visible);
  if(active&&visible&&url){const attempt=revision;void video.play().catch(error=>{if(attempt===revision&&error.name!=='AbortError')$('backgroundStatus').textContent='Background could not play. Try an H.264 MP4 or WebM video.';});}
  else video.pause();
 }
 async function select(){
  const item=chooseBackground([...items.values()],getSelection(),previous,Math.random,getFolder());
  revision++;video.pause();video.removeAttribute('src');video.load();if(url)URL.revokeObjectURL(url);url=null;
  previous=item?.id||null;
  if(item){const attempt=revision;try{const blob=await fileBlob(item.file);if(attempt!==revision)return;url=URL.createObjectURL(blob);video.src=url;}catch(error){if(attempt!==revision)return;$('backgroundStatus').textContent=error.message;}}
  sync();
 }
 video.muted=true;video.loop=true;
 video.addEventListener('error',()=>{if(url)$('backgroundStatus').textContent=`Cannot play ${items.get(previous)?.path||'this background'}. Try H.264 MP4 or WebM.`;});
 const ready=(async()=>{try{for(const item of await loadLocalFiles('backgrounds',{mapRecord:record=>({...record,file:storedFile(record,getLocalFile,'backgrounds')}),onProgress:count=>{$('backgroundStatus').textContent=`Reading saved backgrounds: ${count}…`;}}))items.set(item.id,item);render();select();$('backgroundStatus').textContent=`${items.size} background video(s) saved on this device.`;}catch(error){render();$('backgroundStatus').textContent=`${error.message||'Background storage is unavailable.'} Files can still be used this session.`;}})();
 async function add(selected,{folder=false}={}){
  busy(true);await ready;let count=0;const issues=[];
  try{
   for(const file of selected){
    const path=backgroundImportPath(file,$('backgroundCollectionName').value);
    if(!/\.(mp4|webm|m4v|mov)$/i.test(file.name)){issues.push({path,status:'Skipped',reason:'Choose MP4, WebM, M4V or MOV background videos.'});continue;}
    if(!file.size){issues.push({path,status:'Failed',reason:'This video is empty.'});continue;}
    const record={id:'background:'+path.toLowerCase(),path,file};items.set(record.id,record);count++;
    $('backgroundStatus').textContent=`Adding background ${count}: ${path}`;
    try{await saveLocalFiles('backgrounds',[record]);items.set(record.id,{...record,file:storedFile(record,getLocalFile,'backgrounds')});}catch{issues.push({path,status:'Not saved',reason:'Browser storage is full or unavailable. This background works this session but will need adding again after reloading.'});}
   }
   if(count&&getSelection()==='none')setSelection('random');render();select();
   $('backgroundStatus').textContent=count?`${count} video(s) added. ${items.size} background video(s) available.${issues.length?' Some files need attention.':''}`:folder?'No supported videos found in this folder or its subfolders. Select the bgv folder containing MP4, WebM, M4V or MOV files.':`No videos added.${issues.length?' Some files need attention.':''}`;
   if(issues.length)report(count,issues);
  }finally{busy(false);}
 }
 $('backgroundImport').onclick=()=>$('backgroundFiles').click();
 $('backgroundFiles').onchange=async event=>{const selected=Array.from(event.target.files);event.target.value='';await add(selected);};
 $('backgroundFolder').onchange=async event=>{const selected=Array.from(event.target.files);event.target.value='';if(!selected.length)return;await add(selected,{folder:true});};
 $('backgroundFolderImport').onclick=()=>{
  // The browser's directory input returns files from all nested folders and
  // avoids the separate handle-permission flow of showDirectoryPicker.
  if('webkitdirectory' in $('backgroundFolder')){$('backgroundFolder').click();return;}
  $('backgroundStatus').textContent='Folder selection is unavailable in this browser. Use Add videos, or try desktop Chrome or Edge.';
 };
 $('backgroundSelect').onchange=()=>{setSelection($('backgroundSelect').value);select();};
 $('backgroundFolderSelect').onchange=()=>{setFolder($('backgroundFolderSelect').value);render();select();};
 $('backgroundShuffle').onclick=()=>{setSelection('random');render();select();};
 $('backgroundClear').onclick=async()=>{busy(true);await ready;try{await clearLocalFiles('backgrounds');items.clear();setSelection('none');setFolder('all');render();select();$('backgroundStatus').textContent='Backgrounds cleared. Your original files are untouched.';}catch{$('backgroundStatus').textContent='Could not clear saved backgrounds. Please try again.';}finally{busy(false);}};
 return {sync,nextSong:select,ready};
}
