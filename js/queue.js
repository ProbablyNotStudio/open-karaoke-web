// Song IDs are intentionally repeated: each occurrence is a separate turn.
export function validQueue(value,available){
 return Array.isArray(value)?value.filter(id=>typeof id==='string'&&(!available||available.has(id))):[];
}
export function moveQueueEntry(queue,index,direction){
 if(!Number.isInteger(index)||index<0||index>=queue.length)return queue;
 const target=index+direction;
 if(!Number.isInteger(target)||target<0||target>=queue.length)return queue;
 const result=queue.slice();const [entry]=result.splice(index,1);result.splice(target,0,entry);return result;
}
export function formatBytes(bytes){
 if(!Number.isFinite(bytes)||bytes<0)return 'Unavailable';
 if(bytes===0)return '0 B';
 const units=['B','KB','MB','GB','TB'],unit=Math.min(units.length-1,Math.floor(Math.log(bytes)/Math.log(1024)));
 return `${(bytes/1024**unit).toLocaleString(undefined,{maximumFractionDigits:unit?1:0})} ${units[unit]}`;
}
