// Independent packet decoder for raw CD+G subcode files (300 packets/second).
export class CDGDecoder {
  constructor(buffer){this.data=new Uint8Array(buffer);if(this.data.length%24)throw Error('CDG file must contain complete 24-byte packets');this.reset();}
  reset(){this.pixels=new Uint8Array(300*216);this.palette=Array.from({length:16},()=>[0,0,0]);this.packet=0;this.transparent=-1;this.hOffset=0;this.vOffset=0;this.dirty=true;}
  seek(seconds){const target=Math.min(Math.floor(Math.max(0,seconds)*300),this.data.length/24);if(target<this.packet)this.reset();while(this.packet<target){this.decode(this.data.subarray(this.packet*24,this.packet*24+24));this.packet++;}}
  decode(p){
    if((p[0]&63)!==9)return;
    const op=p[1]&63,d=p.subarray(4,20),color=d[0]&15;
    if(![1,2,30,31,28,6,38,20,24].includes(op))return;
    this.dirty=true;
    if(op===1){if(!(d[1]&15))this.pixels.fill(color);}
    else if(op===2){for(let y=0;y<216;y++)for(let x=0;x<300;x++)if(x<6||x>=294||y<12||y>=204)this.pixels[y*300+x]=color;}
    else if(op===30||op===31){for(let i=0;i<8;i++){const v=((d[i*2]&63)<<6)|(d[i*2+1]&63);this.palette[(op===31?8:0)+i]=[(v>>8&15)*17,(v>>4&15)*17,(v&15)*17];}}
    else if(op===28)this.transparent=color;
    else if(op===6||op===38){
      const y0=(d[2]&31)*12,x0=(d[3]&63)*6;if(y0>204||x0>294)return;
      for(let y=0;y<12;y++)for(let x=0;x<6;x++){const i=(y0+y)*300+x0+x,c=d[(d[4+y]>>(5-x))&1]&15;this.pixels[i]=op===38?this.pixels[i]^c:c;}
    }else if(op===20||op===24){
      this.hOffset=Math.min(d[1]&7,5);this.vOffset=Math.min(d[2]&15,11);
      const hc=d[1]>>4&3,vc=d[2]>>4&3,dx=hc===1?6:hc===2?-6:0,dy=vc===1?12:vc===2?-12:0;
      if(!dx&&!dy)return;
      const old=this.pixels.slice();
      for(let y=0;y<216;y++)for(let x=0;x<300;x++){
        let sx=x-dx,sy=y-dy;
        this.pixels[y*300+x]=op===24?old[((sy+216)%216)*300+(sx+300)%300]:(sx<0||sx>=300||sy<0||sy>=216?color:old[sy*300+sx]);
      }
    }
  }
  render(context){
    if(!this.dirty&&this.renderContext===context)return;
    const image=this.image??=context.createImageData(288,192);
    for(let y=0;y<192;y++)for(let x=0;x<288;x++){
      const c=this.pixels[(y+12+this.vOffset)*300+x+6+this.hOffset],rgb=this.palette[c],i=(y*288+x)*4;
      image.data[i]=rgb[0];image.data[i+1]=rgb[1];image.data[i+2]=rgb[2];image.data[i+3]=c===this.transparent?0:255;
    }
    context.putImageData(image,0,0);
    this.dirty=false;this.renderContext=context;
  }
}
