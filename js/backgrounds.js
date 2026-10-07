import {saveLocalFiles,loadLocalFiles,clearLocalFiles} from './storage.js?v=29';
export function chooseBackground(items,selection,previous,random=Math.random){
 if(selection==='none')return null;
 if(selection!=='random')return items.find(item=>item.id===selection)||null;
 const candidates=items.length>1?items.filter(item=>item.id!==previous):items;
 return candidates.length?candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))]:null;
}
export function setupBackgrounds({getSelection,setSelection,report}){
 const $=id=>document.getElementById(id),video=$('backgroundVideo'),items=new Map();
 let previous=null,url=null,active=false,visible=true,revision=0;
 const controls=['backgroundImport','backgroundFolderImport','backgroundClear'];
 const busy=value=>controls.forEach(id=>$(id).disabled=value);
 function render(){
  const select=$('backgroundSelect');select.replaceChildren();
  for(const [value,label] of [['none','No background'],['random','Random video for each song'],...[...items.values()].map(item=>[item.id,item.path])]){
   const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);
  }
  select.value=getSelection();if(!select.value){select.value='none';setSelection('none');}
 }
 function sync(playing=active,show=visible){
  active=playing;visible=show;video.hidden=!url||!visible;
  $('stage').classList.toggle('has-background',!!url&&visible);
  if(active&&visible&&url){const attempt=revision;void video.play().catch(error=>{if(attempt===revision&&error.name!=='AbortError')$('backgroundStatus').textContent='Background could not play. Try an H.264 MP4 or WebM video.';});}
  else video.pause();
 }
 function select(){
  const item=chooseBackground([...items.values()],getSelection(),previous);
  revision++;video.pause();video.removeAttribute('src');video.load();if(url)URL.revokeObjectURL(url);url=null;
  previous=item?.id||null;
  if(item){url=URL.createObjectURL(item.file);video.src=url;}
  sync();
 }
 video.muted=true;video.loop=true;
 video.addEventListener('error',()=>{if(url)$('backgroundStatus').textContent=`Cannot play ${items.get(previous)?.path||'this background'}. Try H.264 MP4 or WebM.`;});
 const ready=(async()=>{try{for(const item of await loadLocalFiles('backgrounds',{onProgress:count=>{$('backgroundStatus').textContent=`Reading saved backgrounds: ${count}…`;}}))items.set(item.id,item);render();select();$('backgroundStatus').textContent=`${items.size} background video(s) saved on this device.`;}catch(error){render();$('backgroundStatus').textContent=`${error.message||'Background storage is unavailable.'} Files can still be used this session.`;}})();
 async function add(selected,{folder=false}={}){
  busy(true);await ready;let count=0;const issues=[];
  try{
   for(const file of selected){
    const path=file.webkitRelativePath||file.name;
    if(!/\.(mp4|webm|m4v|mov)$/i.test(file.name)){issues.push({path,status:'Skipped',reason:'Choose MP4, WebM, M4V or MOV background videos.'});continue;}
    if(!file.size){issues.push({path,status:'Failed',reason:'This video is empty.'});continue;}
    const record={id:'background:'+path.toLowerCase(),path,file};items.set(record.id,record);count++;
    $('backgroundStatus').textContent=`Adding background ${count}: ${path}`;
    try{await saveLocalFiles('backgrounds',[record]);}catch{issues.push({path,status:'Not saved',reason:'Browser storage is full or unavailable. This background works this session but will need adding again after reloading.'});}
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
 $('backgroundShuffle').onclick=()=>{setSelection('random');render();select();};
 $('backgroundClear').onclick=async()=>{busy(true);await ready;try{await clearLocalFiles('backgrounds');items.clear();setSelection('none');render();select();$('backgroundStatus').textContent='Backgrounds cleared. Your original files are untouched.';}catch{$('backgroundStatus').textContent='Could not clear saved backgrounds. Please try again.';}finally{busy(false);}};
 return {sync,nextSong:select,ready};
}
