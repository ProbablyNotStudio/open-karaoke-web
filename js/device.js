export function isAppleMobile(device=globalThis.navigator){
 return /iPhone|iPad|iPod/i.test(device?.userAgent||'')||(/Macintosh/i.test(device?.userAgent||'')&&device.maxTouchPoints>1);
}
export function defaultSoundFont(device){return isAppleMobile(device)?'builtin':'karaoke-king';}

// Use the visible screen when the mobile keyboard covers the layout viewport.
export function visiblePanel(viewport,screenHeight){
 const height=viewport?.height||screenHeight,top=viewport?.offsetTop||0;
 return {height:Math.max(1,height),top:Math.max(0,top)};
}
export function setupMobileViewport(panel,win=window){
 const update=()=>{
  const {height,top}=visiblePanel(win.visualViewport,win.innerHeight);
  panel.style.setProperty('--visible-height',`${height}px`);
  panel.style.setProperty('--visible-top',`${top}px`);
 };
 win.visualViewport?.addEventListener('resize',update);
 win.visualViewport?.addEventListener('scroll',update);
 win.addEventListener('resize',update);update();
}
