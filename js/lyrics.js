export function lyricIndex(lines,time){
 let low=0,high=lines.length;
 while(low<high){const middle=(low+high)>>1;if(lines[middle].time<=time)low=middle+1;else high=middle;}
 return low-1;
}
export function lyricPresentation(lines,time,duration=0,size=2){
 const first=lines[0]?.time||0,index=lyricIndex(lines,time);
 const countdown=lines.length&&time<first&&first-time<=5?Math.min(5,Math.ceil(first-time)):0;
 const start=Math.max(0,Math.floor(Math.max(0,index)/size)*size);
 const rowIndices=size===2?[0,1].map(slot=>{
  const active=Math.max(0,index),latest=active-((active-slot+2)%2);
  const row=Math.max(slot,latest);
  return row+2<lines.length&&time>=lyricEnd(lines[row],lines[row+1]?.time,duration)?row+2:row;
 }):Array.from({length:size},(_,slot)=>start+slot);
 return {index,start,rowIndices,countdown,intro:lines.length?time<first:time<5,rows:rowIndices.map(i=>lines[i]||null)};
}
export function lyricEnd(line,nextTime,duration){
 if(!line)return Infinity;
 const words=line.words?.length?line.words:[{time:line.time,text:line.text}],last=words.at(-1),previous=words.at(-2)?.time;
 const estimate=Math.max(.2,Math.min(1.5,previous===undefined?.8:last.time-previous));
 return Math.min(nextTime??Infinity,duration||Infinity,last.time+(words.length===1?8:estimate));
}
export function lyricFill(line,index,time,nextTime,duration){
 const words=line.words?.length?line.words:[{time:line.time,text:line.text}];
 const word=words[index];if(!word||time<=word.time)return 0;
 const next=words[index+1]?.time;
 const end=next??lyricEnd(line,nextTime,duration);
 return Math.max(0,Math.min(1,(time-word.time)/Math.max(.05,end-word.time)));
}
