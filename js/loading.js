export async function loadingDeadline(promise,milliseconds,message){
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),milliseconds);})]);}
 finally{clearTimeout(timer);}
}
