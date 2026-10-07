// Finish processing and saving one archive before allocating the next one.
export async function runImportBatches(selected,{expand,consume,onIssue=()=>{},onProgress=()=>{},size=100}){
 const inputs=Array.from(selected);
 for(let i=0;i<inputs.length;i++){
  const item=inputs[i],name=item.file?item.path:item.name;
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
}
export function importQueue(task){
 let pending=Promise.resolve();
 return (selection,options)=>{const snapshot=Array.from(selection);const next=pending.catch(()=>{}).then(()=>task(snapshot,options));pending=next;return next;};
}
