import test from 'node:test';
import assert from 'node:assert/strict';
import {isAppleMobile,defaultSoundFont,visiblePanel,setupMobileViewport} from '../js/device.js';
test('iPhones and desktop-mode iPads default to the lightweight synth',()=>{
 assert.equal(defaultSoundFont({userAgent:'iPhone',maxTouchPoints:5}),'builtin');
 assert.equal(defaultSoundFont({userAgent:'Macintosh',maxTouchPoints:5}),'builtin');
 assert.equal(isAppleMobile({userAgent:'Macintosh',maxTouchPoints:0}),false);
 assert.equal(defaultSoundFont({userAgent:'Windows'}),'karaoke-king');
});
test('song search uses the visible screen above a keyboard and follows viewport changes',()=>{
 assert.deepEqual(visiblePanel({height:280,offsetTop:150},800),{height:280,top:150});
 assert.deepEqual(visiblePanel(null,800),{height:800,top:0});
 const handlers={},values={};
 const win={innerHeight:800,visualViewport:{height:280,offsetTop:150,addEventListener:(event,fn)=>handlers[event]=fn},addEventListener:()=>{}};
 setupMobileViewport({style:{setProperty:(key,value)=>values[key]=value}},win);
 assert.equal(values['--visible-height'],'280px');assert.equal(values['--visible-top'],'150px');
 win.visualViewport.height=800;win.visualViewport.offsetTop=0;handlers.resize();
 assert.equal(values['--visible-height'],'800px');assert.equal(values['--visible-top'],'0px');
});
