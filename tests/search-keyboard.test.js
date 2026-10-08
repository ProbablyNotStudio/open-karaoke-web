import test from 'node:test';
import assert from 'node:assert/strict';
import {editSearch,setupSearchKeyboard,songNumberKey,indexSongNumbers,numberedMatches} from '../js/search-keyboard.js';
test('keypad edits a cursor or selection without losing the rest of a search',()=>{
 assert.deepEqual(editSearch('song','x',2,2),{value:'soxng',cursor:3});
 assert.deepEqual(editSearch('song','a',1,3),{value:'sag',cursor:2});
 assert.deepEqual(editSearch('Test','space'),{value:'Test ',cursor:5});
 assert.deepEqual(editSearch('0000','1'),{value:'00001',cursor:5});
});
test('backspace removes a whole Unicode character or the selected text',()=>{
 assert.deepEqual(editSearch('a🎵','backspace'),{value:'a',cursor:1});
 assert.deepEqual(editSearch('song','backspace',1,3),{value:'sg',cursor:1});
 assert.deepEqual(editSearch('','backspace'),{value:'',cursor:0});
 assert.deepEqual(editSearch('song','clear'),{value:'',cursor:0});
});
test('keypad keeps search text bounded',()=>{
 const value='a'.repeat(120);assert.deepEqual(editSearch(value,'b'),{value,cursor:120});
});

test('touch search opens read-only with inputmode none and keypad changes the query',()=>{
 const original=globalThis.document;
 const element=()=>({children:[],handlers:{},dataset:{},setAttribute(name,value){this[name]=value;},addEventListener(name,callback){this.handlers[name]=callback;},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];}});
 globalThis.document={createElement:element};
 try{
  const input={...element(),value:'',selectionStart:0,selectionEnd:0,focus(){this.handlers.focus?.();},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}};
  const container=element(),toggle=element();let changes=0;
  const keyboard=setupSearchKeyboard({input,container,toggle,onChange(){changes++;},touch:()=>true});
  assert.equal(input.readOnly,true);assert.equal(input.inputMode,'none');
  keyboard.open();assert.equal(container.hidden,false);
  container.children[0].children[0].onclick();assert.equal(input.value,'1');assert.equal(changes,1);
  toggle.onclick();assert.equal(container.hidden,true);assert.equal(input.readOnly,true);
  input.focus();assert.equal(container.hidden,false);
 }finally{globalThis.document=original;}
});

test('song numbers match across five- and six-digit padding without accepting text',()=>{
 assert.equal(songNumberKey('000448'),'448');assert.equal(songNumberKey('00448'),'448');
 assert.equal(songNumberKey('00000'),'0');assert.equal(songNumberKey('12 to 12'),null);
 assert.equal(songNumberKey(''),null);
});

test('number lookup keeps ambiguous songs selectable and ignores nonnumeric search',()=>{
 const a={id:'a',number:'00001'},b={id:'b',number:'1'},c={id:'c',number:'00448'};
 const index=indexSongNumbers([a,b,c,{id:'text',number:'unknown'}]);
 assert.deepEqual(numberedMatches(index,'000001'),[a,b]);assert.deepEqual(numberedMatches(index,'000448'),[c]);
 assert.deepEqual(numberedMatches(index,'unknown'),[]);assert.deepEqual(numberedMatches(index,'99999'),[]);
});
