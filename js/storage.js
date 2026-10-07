// Imported files stay in this browser's IndexedDB; no network requests.
export function createLibraryStorage({database=()=>globalThis.indexedDB,keyRange=()=>globalThis.IDBKeyRange,openTimeout=10000,operationTimeout=30000}={}){
 let connection;
 function openLibrary(){
  if(!connection){
   const pending=new Promise((resolve,reject)=>{
    let request,settled=false;
    const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error);};
    const timer=setTimeout(()=>fail(Error('Browser storage took too long to open. Close other Open Karaoke tabs, then retry.')),openTimeout);
    try{request=database().open('open-karaoke-local-library',2);}catch(error){fail(error);return;}
    request.onblocked=()=>fail(Error('Saved files are blocked by another Open Karaoke tab. Close other tabs for this website, then retry.'));
    request.onupgradeneeded=()=>{for(const store of ['songs','fonts','backgrounds'])if(!request.result.objectStoreNames.contains(store))request.result.createObjectStore(store,{keyPath:'id'});};
    request.onsuccess=()=>{const db=request.result;if(settled){db.close();return;}settled=true;clearTimeout(timer);db.onversionchange=()=>{db.close();connection=null;};resolve(db);};
    request.onerror=()=>fail(request.error||Error('Browser storage could not open.'));
   });
   connection=pending;pending.catch(()=>{if(connection===pending)connection=null;});
  }
  return connection;
 }
 async function transaction(stores,mode,work){
  const db=await openLibrary();
  return new Promise((resolve,reject)=>{
   let tx,result,settled=false;
   const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(result);};
   const timer=setTimeout(()=>{finish(Error('Browser storage stopped responding. Close other Open Karaoke tabs, then retry.'));try{tx?.abort();}catch{}db.close();connection=null;},operationTimeout);
   try{tx=db.transaction(stores,mode);tx.oncomplete=()=>finish();tx.onabort=()=>finish(tx.error||Error('Browser storage operation was interrupted.'));tx.onerror=()=>{};work(tx,value=>{result=value;},finish);}catch(error){finish(error);}
  });
 }
 async function saveLocalFiles(store,records){if(records.length)await transaction(store,'readwrite',tx=>{for(const record of records)tx.objectStore(store).put(record);});}
 async function loadLocalFiles(store,{onProgress=()=>{},batchSize=store==='songs'?50:1,mapRecord=record=>record}={}){
  const records=[];let after;
  do{
   const page=await transaction(store,'readonly',(tx,set,fail)=>{const request=tx.objectStore(store).getAll(after===undefined?null:keyRange().lowerBound(after,true),batchSize);request.onsuccess=()=>set(request.result);request.onerror=()=>fail(request.error);});
   records.push(...page.map(mapRecord));onProgress(records.length);
   if(page.length<batchSize)break;
   after=page.at(-1).id;
   // Give the interface a chance to display progress between batches.
   await new Promise(resolve=>setTimeout(resolve,0));
  }while(true);
  return records;
 }
 async function getLocalFile(store,id){return transaction(store,'readonly',(tx,set,fail)=>{const request=tx.objectStore(store).get(id);request.onsuccess=()=>set(request.result);request.onerror=()=>fail(request.error);});}
 async function clearLocalLibrary(){return transaction(['songs','fonts'],'readwrite',tx=>{tx.objectStore('songs').clear();tx.objectStore('fonts').clear();});}
 async function clearLocalFiles(store){return transaction(store,'readwrite',tx=>tx.objectStore(store).clear());}
 return {openLibrary,saveLocalFiles,loadLocalFiles,getLocalFile,clearLocalLibrary,clearLocalFiles};
}
const storage=createLibraryStorage();
export const {openLibrary,saveLocalFiles,loadLocalFiles,getLocalFile,clearLocalLibrary,clearLocalFiles}=storage;
