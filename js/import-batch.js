// Finish processing and saving one archive before allocating the next one.
export async function runImportBatches(selected,{expand,consume,onIssue=()=>{},onProgress=()=>{},size=100}){
 const inputs=Array.from(selected);
 let loose=[],lastProgress;
 const flush=async()=>{if(!loose.length)return;const chunk=loose;loose=[];await consume(chunk);onProgress({...lastProgress,processed:chunk.length,total:chunk.length});};
 for(let i=0;i<inputs.length;i++){
  const item=inputs[i],name=item.file?item.path:item.name;
  if(item.file||!/\.zip$/i.test(item.name)){
   lastProgress={name,input:i+1,inputs:inputs.length};
   loose.push(item.file?item:{file:item,path:item.webkitRelativePath||item.name,source:'local'});
   if(loose.length===size)await flush();
   continue;
  }
  await flush();
  onProgress({name,input:i+1,inputs:inputs.length,processed:0,total:0});
  let entries;
  try{entries=item.file?[item]:/\.zip$/i.test(item.name)?await expand(item):[{file:item,path:item.webkitRelativePath||item.name,source:'local'}];}
  catch(error){onIssue({path:name,reason:error.message,status:'Failed'});continue;}
  for(const issue of entries.issues||[])onIssue(issue);
  for(let start=0;start<entries.length;start+=size){
   await consume(entries.slice(start,start+size));
   onProgress({name,input:i+1,inputs:inputs.length,processed:Math.min(start+size,entries.length),total:entries.length});
  }
 }
 await flush();
}
export function importQueue(task){
 let pending=Promise.resolve();
 return (selection,options)=>{const snapshot=Array.from(selection);const next=pending.catch(()=>{}).then(()=>task(snapshot,options));pending=next;return next;};
}
