export const PAGE_SIZE=50;
const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
export const searchText=song=>normalize(`${song.number} ${song.title} ${song.artist}`);
export function catalogLetter(title){const initial=normalize(String(title||'')).trim()[0]?.toUpperCase();return /^[A-Z]$/.test(initial||'')?initial:'#';}
const natural=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
function compareSongs(field){return (a,b)=>natural.compare(String(a[field]||''),String(b[field]||''))||natural.compare(a.title||'',b.title||'')||natural.compare(a.number||'',b.number||'')||natural.compare(a.id||'',b.id||'');}
function criteria({query='',format='all',letter='all',favoriteOnly=false,favorites=new Set(),sort='title'}={}){
 return {term:normalize(query).trim(),format,letter,favoriteOnly,favorites,field:['title','artist','number'].includes(sort)?sort:'title'};
}
function matching(songs,{term,format,letter,favoriteOnly,favorites}){
 if(!term&&format==='all'&&letter==='all'&&!favoriteOnly)return songs;
 return songs.filter(song=>(!favoriteOnly||favorites.has(song.id))&&(format==='all'||format===song.format)&&(letter==='all'||catalogLetter(song.title)===letter)&&(!term||(song.searchText||searchText(song)).includes(term)));
}
function paginate(matches,{page=0,size=PAGE_SIZE}={}){
 const pages=Math.max(1,Math.ceil(matches.length/size)),index=Math.max(0,Math.min(pages-1,page));
 return {rows:matches.slice(index*size,(index+1)*size),total:matches.length,pages,page:index,start:matches.length?index*size+1:0,end:Math.min(matches.length,(index+1)*size)};
}
export function libraryPage(songs,options={}){
 const filter=criteria(options);let matches=matching(songs,filter);
 if(!options.ordered||filter.field!=='title')matches=[...matches].sort(compareSongs(filter.field));
 return paginate(matches,options);
}
// Cache only three result lists (library, fullscreen search and songbook).
// Entries contain song references, never file contents. Metadata changes and
// imports must invalidate the order; mutable favorites are checked separately.
export function createSongOrder(readSongs){
 let cached,results=[];
 const get=()=>cached??=Array.from(readSongs()).sort(compareSongs('title'));
 const sameFilters=(a,b)=>a.format===b.format&&a.letter===b.letter&&a.field===b.field&&a.favoriteOnly===b.favoriteOnly&&(!a.favoriteOnly||(a.favorites.size===b.favorites.size&&[...a.favorites].every(id=>b.favorites.has(id))));
 return {get,invalidate(){cached=undefined;results=[];},page(options={}){
   const filter=criteria(options),hit=results.find(entry=>sameFilters(entry.filter,filter)&&entry.filter.term===filter.term);
   if(hit){results=results.filter(entry=>entry!==hit);results.unshift(hit);return paginate(hit.matches,options);}
   // Adding letters to an existing search can only narrow its previous matches.
   const previous=results.find(entry=>sameFilters(entry.filter,filter)&&filter.term.startsWith(entry.filter.term));
   let matches=matching(previous?.matches||get(),filter);
   if(filter.field!=='title'&&!previous)matches=[...matches].sort(compareSongs(filter.field));
   const snapshot={...filter,favorites:filter.favoriteOnly?new Set(filter.favorites):null};
   results.unshift({filter:snapshot,matches});results.length=Math.min(results.length,3);
   return paginate(matches,options);
 }};
}
