export function editSearch(value,key,start=value.length,end=start){
 start=Math.max(0,Math.min(value.length,start??value.length));end=Math.max(start,Math.min(value.length,end??start));
 if(key==='clear')return {value:'',cursor:0};
 if(key==='backspace'){
  if(start===end&&start>0)start-=Array.from(value.slice(0,start)).at(-1).length;
  return {value:value.slice(0,start)+value.slice(end),cursor:start};
 }
 const insert=key==='space'?' ':key;
 const result=value.slice(0,start)+insert+value.slice(end);
 return result.length>120?{value,cursor:end}:{value:result,cursor:start+insert.length};
}
export function songNumberKey(value){return /^\d+$/.test(String(value).trim())?String(value).trim().replace(/^0+(?=\d)/,''):null;}
export function indexSongNumbers(songs){
 const index=new Map();
 for(const song of songs){const key=songNumberKey(song.number);if(key===null)continue;const previous=index.get(key);if(Array.isArray(previous))previous.push(song);else index.set(key,previous?[previous,song]:song);}
 return index;
}
export function numberedMatches(index,value){const match=index.get(songNumberKey(value));return match?(Array.isArray(match)?match:[match]):[];}
export function setupSearchKeyboard({input,container,wrapper=container,toggle,onChange,onMode=()=>{},touch=()=>matchMedia('(pointer:coarse)').matches}){
 let numbers=touch(),enabled=false;
 function keyButton(label,key){
  const button=document.createElement('button');button.type='button';button.textContent=label;
  button.setAttribute('aria-label',key==='backspace'?'Backspace':key==='space'?'Space':key==='clear'?'Clear search':label);
  button.addEventListener('pointerdown',event=>event.preventDefault());
  button.onclick=()=>{
   if(key==='mode'){numbers=!numbers;render();return;}
   const edited=editSearch(input.value,key,input.selectionStart,input.selectionEnd);
   input.value=edited.value;input.focus({preventScroll:true});input.setSelectionRange(edited.cursor,edited.cursor);onChange();
  };
  return button;
 }
 function render(){
  container.replaceChildren();container.dataset.mode=numbers?'numbers':'letters';
  const rows=numbers?['123','456','789']:['qwertyuiop','asdfghjkl','zxcvbnm'];
  for(const keys of rows){const row=document.createElement('div');row.className='search-key-row';
   for(const key of Array.from(keys))row.append(keyButton(key.toUpperCase(),key));container.append(row);
  }
  const row=document.createElement('div');row.className='search-key-row search-key-actions';
  if(numbers)row.append(keyButton('⌫','backspace'),keyButton('0','0'),keyButton('Clear','clear'),keyButton('ABC','mode'));
  else row.append(keyButton('123','mode'),keyButton("'","'"),keyButton('Space','space'),keyButton('⌫','backspace'),keyButton('Clear','clear'));
  container.append(row);
  onMode(numbers);
 }
 function show(value){enabled=value;container.hidden=!value;wrapper.hidden=!value;input.readOnly=value||touch();input.inputMode=value||touch()?'none':'search';toggle.textContent=value?'Hide keypad':'Show keypad';toggle.setAttribute('aria-expanded',String(value));}
 toggle.onclick=()=>show(!enabled);
 input.addEventListener('focus',()=>{if(touch())show(true);});
 render();show(false);
 return {open({force=false,numeric=false}={}){if(numeric){numbers=true;render();}show(force||touch()||enabled);}};
}
