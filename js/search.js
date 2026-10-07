export const PAGE_SIZE=50;
export const searchText=song=>`${song.number} ${song.title} ${song.artist}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
const natural=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
export function libraryPage(songs,{query='',format='all',favoriteOnly=false,favorites=new Set(),page=0,size=PAGE_SIZE,sort='title'}={}){
  const term=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim();
  const matches=songs.filter(song=>(!favoriteOnly||favorites.has(song.id))&&(format==='all'||format===song.format)&&(!term||(song.searchText||searchText(song)).includes(term)));
  const field=['title','artist','number'].includes(sort)?sort:'title';
  matches.sort((a,b)=>natural.compare(String(a[field]||''),String(b[field]||''))||natural.compare(a.title||'',b.title||'')||natural.compare(a.number||'',b.number||'')||natural.compare(a.id||'',b.id||''));
  const pages=Math.max(1,Math.ceil(matches.length/size)),index=Math.max(0,Math.min(pages-1,page));
  return {rows:matches.slice(index*size,(index+1)*size),total:matches.length,pages,page:index,start:matches.length?index*size+1:0,end:Math.min(matches.length,(index+1)*size)};
}
