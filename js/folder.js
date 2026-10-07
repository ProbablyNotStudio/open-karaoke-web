// Read file handles without loading song bytes into memory.
export function songFolderSelection(selected){
  const entries=Array.from(selected);
  const parts=file=>(file.webkitRelativePath||file.name).replace(/\\/g,'/').split('/');
  const root=entries.length?parts(entries[0])[0].toLowerCase():'';
  const restricted=root!=='songs'&&entries.some(file=>{const path=parts(file);return path.length>2&&path[1].toLowerCase()==='songs';});
  const files=entries.filter(file=>{
    const path=parts(file);
    return (!restricted||(path.length>2&&path[1].toLowerCase()==='songs'))&&/\.(mid|midi|kar|mp3|wav|ogg|m4a|mp4|webm|cdg|lrc|zip)$/i.test(file.name);
  });
  return {files,restricted,ignored:entries.length-files.length};
}
export async function folderFiles(directory,path=directory.name){
  const files=[];
  async function visit(folder,prefix){
    for await(const handle of folder.values()){
      const relative=`${prefix}/${handle.name}`;
      if(handle.kind==='directory')await visit(handle,relative);
      else if(/\.(mid|midi|kar|mp3|wav|ogg|m4a|mp4|webm|m4v|mov|cdg|lrc|zip)$/i.test(handle.name)){
        const file=await handle.getFile();
        Object.defineProperty(file,'webkitRelativePath',{value:relative});
        files.push(file);
      }
    }
  }
  await visit(directory,path);return files;
}
