import {libraryPage} from './search.js?v=44';
export {catalogLetter} from './search.js?v=44';
export function songbookPage(songs,{letter='all',query='',page=0,size=32,ordered=false}={}){
 return libraryPage(songs,{letter,query,page,size,sort:'title',ordered});
}
