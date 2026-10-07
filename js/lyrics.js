export function lyricIndex(lines,time){
 let low=0,high=lines.length;
 while(low<high){const middle=(low+high)>>1;if(lines[middle].time<=time)low=middle+1;else high=middle;}
 return low-1;
}
export function lyricPresentation(lines,time,duration=0,size=2){
 const first=lines[0]?.time||0,index=lyricIndex(lines,time);
 const countdown=lines.length&&time<first&&first-time<=5?Math.min(5,Math.ceil(first-time)):0;
 const start=Math.max(0,Math.floor(Math.max(0,index)/size)*size);
 return {index,start,countdown,intro:lines.length?time<first:time<5,rows:lines.slice(start,start+size)};
}
export function lyricFill(line,index,time,nextTime,duration){
 const words=line.words?.length?line.words:[{time:line.time,text:line.text}];
 const word=words[index];if(!word||time<=word.time)return 0;
 const next=words[index+1]?.time;
 const previous=words[index-1]?.time;
 // Final syllables should not stretch across long instrumental breaks.
 const estimate=Math.max(.2,Math.min(1.5,previous===undefined?.8:word.time-previous));
 const end=next??Math.min(nextTime??Infinity,duration||Infinity,word.time+(words.length===1?8:estimate));
 return Math.max(0,Math.min(1,(time-word.time)/Math.max(.05,end-word.time)));
}
