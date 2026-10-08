// Original procedural tones: no SoundFont samples or sample bank required.
// GM instrument structure and filter/envelope controls informed by local
// Timbres of Heaven, KaraOke King v2 and Yamaha XG banks. These are not sample replicas.
const FAMILIES=[
 [ .003,1.1,.025,.22,1, [1,.45,.23,.11,.06,.03]],
 [ .002,.65,.008,.18,.75,[1,.03,.35,.01,.13]],
 [ .008,.2,.85,.08,.65,[1,.55,.33,.22,.12,.08]],
 [ .003,.45,.03,.14,.85,[1,.48,.18,.08,.035]],
 [ .006,.32,.3,.09,1.1,[1,.35,.12,.035]],
 [ .08,.4,.7,.28,.6,[1,.5,.33,.24,.17,.11,.08]],
 [ .13,.4,.72,.34,.6,[1,.3,.2,.11,.07]],
 [ .025,.25,.67,.12,.6,[1,.6,.38,.25,.16,.09]],
 [ .018,.2,.7,.1,.7,[1,.09,.43,.04,.22,.02]],
 [ .025,.2,.78,.12,.85,[1,.12,.055,.02]],
 [ .009,.24,.58,.13,.6,[1,.48,.31,.23,.15,.1]],
 [ .2,.5,.7,.4,.6,[1,.29,.18,.1,.06]],
 [ .003,.5,.05,.22,.7,[1,.25,.5,.08,.2]],
 [ .003,.32,.025,.12,.85,[1,.5,.21,.1,.05]],
 [ .002,.2,.008,.08,.7,[1,.04,.42,.015,.17]],
 [ .01,.3,.1,.15,.65,[1,.35,.14,.08]]
];
// Distinct colors within each eight-program GM family, rather than one
// identical waveform for every instrument in that family.
// Per-program release and held-level references from the three banks.
// Bounded for procedural voices: sample envelopes include decay in recordings
// and cannot be copied directly into an oscillator envelope.
const REFERENCES=[[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.5,0.45],[0.55,0.45],[0.356,0.45],[0.1,0.45],[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.06,0.776],[0.11,0.92],[0.099,0.92],[0.55,0.92],[0.28,0.92],[0.076,0.92],[0.1,0.692],[0.17,0.794],[0.11,0.92],[0.229,0.891],[0.198,0.92],[0.124,0.45],[0.239,0.45],[0.06,0.45],[0.06,0.92],[0.06,0.45],[0.198,0.45],[0.087,0.45],[0.076,0.45],[0.079,0.45],[0.06,0.45],[0.06,0.45],[0.198,0.45],[0.15,0.45],[0.356,0.708],[0.45,0.631],[0.5,0.92],[0.55,0.92],[0.55,0.92],[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.55,0.92],[0.55,0.92],[0.55,0.92],[0.55,0.92],[0.55,0.92],[0.55,0.708],[0.55,0.92],[0.55,0.45],[0.199,0.776],[0.229,0.851],[0.229,0.708],[0.179,0.692],[0.429,0.708],[0.198,0.92],[0.358,0.631],[0.2,0.501],[0.27,0.92],[0.198,0.501],[0.198,0.7],[0.198,0.631],[0.27,0.803],[0.229,0.794],[0.27,0.776],[0.139,0.692],[0.11,0.776],[0.55,0.92],[0.06,0.692],[0.27,0.733],[0.27,0.776],[0.198,0.776],[0.55,0.794],[0.229,0.708],[0.099,0.92],[0.11,0.692],[0.5,0.631],[0.229,0.45],[0.06,0.45],[0.343,0.92],[0.55,0.537],[0.119,0.617],[0.55,0.708],[0.55,0.92],[0.55,0.631],[0.55,0.92],[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.55,0.519],[0.55,0.45],[0.55,0.92],[0.55,0.45],[0.55,0.92],[0.55,0.92],[0.55,0.45],[0.55,0.676],[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.198,0.776],[0.36,0.776],[0.198,0.501],[0.55,0.45],[0.509,0.45],[0.55,0.45],[0.3,0.45],[0.55,0.45],[0.55,0.45],[0.55,0.45],[0.3,0.45],[0.38,0.45],[0.33,0.45],[0.55,0.45],[0.55,0.45],[0.129,0.92],[0.55,0.92],[0.55,0.92],[0.55,0.45]];
const COLORS=[.85,1.2,1.05,.95,.62,.48,1.45,1.65];
export const ENHANCED_TIMBRES=Array.from({length:128},(_,program)=>{
 const family=program>>3,variant=program%8,[a,d,s,r,g,h]=FAMILIES[family];
 const brightness=COLORS[variant],reference=REFERENCES[program];
 const t={a:a*(1+variant*.045),d:d*(1+variant*.08),s:[2,5,6,7,8,9,10,11].includes(family)?reference[1]:s,r:reference[0],g,brightness,
  h:h.map((v,i)=>v*brightness**(i*.6)),spread:[5,6,11].includes(family)?5+variant*.7:0};
 if(family===0)t.d=2.4+variant*.12; // piano body decays beyond the initial attack
 if(program===4||program===5)t.h=[1,.04,.27,.01,.08]; // electric pianos
 if(program===6)t.s=.005; // harpsichord
 if(program===24||program===25)t.brightness=.7; // nylon / steel guitar
 if(program===30){t.h=[1,.7,.45,.32,.24,.18];t.s=.45;}
 if(program===32||program===33)t.brightness=.55; // acoustic / finger bass
 if(program===56)t.a=.014; // trumpet
 if(program===73||program===74)t.h=[1,.05,.015]; // flute / recorder
 if(program===80)t.h=[1,0,.33,0,.2,0,.14]; // square lead
 if(program===81)t.h=[1,.5,.333,.25,.2,.167]; // saw lead
 return Object.freeze({...t,h:Object.freeze(t.h)});
});
export function toneShape(program,velocity=100,pitch=60,sampleRate=44100){
 const t=ENHANCED_TIMBRES[Math.max(0,Math.min(127,Math.trunc(program)||0))];
 const strength=Math.max(0,Math.min(1,velocity/127));
 const frequency=440*2**((pitch-69)/12);
 const ceiling=sampleRate*.44;
 const cutoff=Math.min(ceiling,Math.max(180,(frequency*10+900)*t.brightness*(.45+strength*.9)));
 return {...t,cutoff,attackCutoff:Math.min(ceiling,cutoff*1.6),level:strength**1.35*t.g};
}
