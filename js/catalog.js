import {libraryPage} from './search.js?v=31';
export function catalogLetter(title){const initial=String(title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()[0]?.toUpperCase();return /^[A-Z]$/.test(initial||'')?initial:'#';}
export function songbookPage(songs,{letter='all',query='',page=0,size=32,ordered=false}={}){
 const eligible=songs.filter(song=>letter==='all'||catalogLetter(song.title)===letter);
 return libraryPage(eligible,{query,page,size,sort:'title',ordered});
}
