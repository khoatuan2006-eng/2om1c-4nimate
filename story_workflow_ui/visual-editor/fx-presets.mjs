// Extensible Motion-Comic FX Preset Registry (shared between scene-plan compiler and CreatedScene renderer).
// Add new aura, speed/focus-line, flash, mood, particle, impact, or comic SFX presets here without touching core compiler or storage code.

export const AURA_PRESETS=Object.freeze({
  power:{outer:'rgba(255,196,46,0.52)',inner:'rgba(255,244,179,0.78)',core:'rgba(255,136,0,0.42)',stroke:'#ffd166',step:4},
  dark:{outer:'rgba(88,28,135,0.62)',inner:'rgba(16,185,129,0.34)',core:'rgba(15,10,30,0.72)',stroke:'#a855f7',step:4},
  cyan:{outer:'rgba(56,189,248,0.52)',inner:'rgba(186,230,253,0.74)',core:'rgba(14,165,233,0.42)',stroke:'#7dd3fc',step:5},
  rage:{outer:'rgba(220,38,38,0.58)',inner:'rgba(254,202,202,0.72)',core:'rgba(153,27,27,0.48)',stroke:'#f87171',step:3},
});

export const LINE_PRESETS=Object.freeze({
  focus:{kind:'focus',color:'rgba(255,255,255,0.42)',strokeWidth:3.5,rays:28,innerRadius:440,step:4},
  speed:{kind:'speed',color:'rgba(255,255,255,0.36)',strokeWidth:4,rays:22,innerRadius:520,step:3},
  'speed-horiz':{kind:'speed-horiz',color:'rgba(255,255,255,0.48)',strokeWidth:4.5,rays:20,innerRadius:0,step:2},
});

export const FLASH_COLORS=Object.freeze({
  white:'#ffffff',
  red:'#ef4444',
  gold:'#fde047',
});

export const MOOD_PRESETS=Object.freeze({
  tension:{vignette:'rgba(12,6,28,0.58)',tint:'rgba(76,29,149,0.12)',pulse:false},
  danger:{vignette:'rgba(69,10,10,0.62)',tint:'rgba(220,38,38,0.14)',pulse:true},
  action:{vignette:'rgba(10,14,24,0.48)',tint:'rgba(245,158,11,0.08)',pulse:false},
  flashback:{
    vignette:'rgba(42,22,8,0.64)',
    tint:'rgba(245,175,75,0.13)',
    pulse:false,
    memoryStyle:'warm',
    imgFilter:{sepia:0.48,grayscale:0,saturateDelta:-0.14,contrastDelta:0.05,brightnessDelta:0.04,hueRotate:-6},
    haloColor:'rgba(255,244,214,0.40)',
    edgeLeak:'rgba(251,146,60,0.34)',
    frameTint:'rgba(255,246,224,0.24)',
    grainLight:'rgba(255,248,228,0.62)',
    grainDark:'rgba(42,24,10,0.32)',
    scratchColor:'rgba(255,248,230,0.42)',
  },
  'flashback-cold':{
    vignette:'rgba(4,8,18,0.82)',
    tint:'rgba(18,32,54,0.18)',
    pulse:false,
    memoryStyle:'cold',
    imgFilter:{sepia:0.14,grayscale:0.58,saturateDelta:-0.34,contrastDelta:0.14,brightnessDelta:-0.10,hueRotate:-16},
    haloColor:'rgba(148,163,184,0.18)',
    edgeLeak:'rgba(100,116,139,0.22)',
    frameTint:'rgba(10,16,30,0.38)',
    grainLight:'rgba(226,232,240,0.56)',
    grainDark:'rgba(10,15,28,0.44)',
    scratchColor:'rgba(226,232,240,0.44)',
  },
  system:{vignette:'rgba(4,20,36,0.54)',tint:'rgba(14,165,233,0.12)',pulse:false},
});

export const PARTICLE_PRESETS=Object.freeze({
  dust:{count:16,color:'rgba(226,214,195,0.62)',dir:'trail',size:[10,26],step:2},
  sparks:{count:22,color:'#fde047',accent:'#fb923c',dir:'up',size:[5,11],step:2},
  embers:{count:24,color:'#f87171',accent:'#fbbf24',dir:'up-drift',size:[6,13],step:2},
  wind:{count:18,color:'rgba(255,255,255,0.48)',dir:'left',size:[90,220],step:2},
  debris:{count:18,color:'#f8fafc',accent:'#38bdf8',dir:'burst',size:[10,22],step:1},
  smoke:{count:14,color:'rgba(210,215,222,0.34)',accent:'rgba(148,163,184,0.26)',dir:'smoke',size:[110,230],step:2},
  rain:{count:48,color:'rgba(186,230,253,0.58)',dir:'rain',size:[55,115],step:1},
});

export const IMPACT_FRAME_STYLES=Object.freeze({
  invert:'grayscale(1) contrast(3.2) invert(1)',
  bw:'grayscale(1) contrast(3.6) brightness(1.12)',
  crimson:'grayscale(1) contrast(3.2) invert(1)',
});

export const TRAIL_COLORS=Object.freeze({
  cyan:'#38bdf8',
  gold:'#fde047',
  red:'#ef4444',
  purple:'#a855f7',
  white:'#ffffff',
});

export const LIGHTING_PRESETS=Object.freeze({
  sunset:{topGlow:'rgba(251,146,60,0.42)',wash:'rgba(124,45,18,0.24)',vignette:'rgba(30,10,5,0.42)'},
  night:{topGlow:'rgba(147,197,253,0.18)',wash:'rgba(8,18,46,0.50)',vignette:'rgba(2,6,23,0.64)'},
  alarm:{topGlow:'rgba(239,68,68,0.34)',wash:'rgba(127,29,29,0.28)',vignette:'rgba(69,10,10,0.58)'},
  spotlight:{topGlow:'rgba(254,243,199,0.26)',wash:'rgba(2,6,23,0.68)',vignette:'rgba(2,6,23,0.72)'},
  point:{topGlow:'rgba(253,224,71,0.48)',wash:'rgba(10,14,28,0.52)',vignette:'rgba(2,6,23,0.58)'},
});

export const CAPTION_STYLE_NAMES=Object.freeze(['classic','highlight','comic']);
export const EMOTE_NAMES=Object.freeze(['shock','question','anger','sweat','spark','silence']);
export const SPEECH_VARIANT_NAMES=Object.freeze(['normal','shout','thought']);
export const CAMERA_ANGLE_NAMES=Object.freeze(['standard','reverse','ots','hero-low','dutch-left','dutch-right']);

export const IMPACT_COLORS=Object.freeze({
  white:'#ffffff',
  gold:'#fde047',
  red:'#ef4444',
  cyan:'#38bdf8',
});

export const SFX_STYLES=Object.freeze({
  impact:{fill:'#fde047',stroke:'#18181b',shadow:'#dc2626'},
  menace:{fill:'#c084fc',stroke:'#18181b',shadow:'#3b0764'},
  speed:{fill:'#38bdf8',stroke:'#0f172a',shadow:'#0284c7'},
  rage:{fill:'#f87171',stroke:'#18181b',shadow:'#7f1d1d'},
  glitch:{fill:'#ffffff',stroke:'#0f172a',shadow:'#ec4899',cyan:'#22d3ee',magenta:'#e879f9'},
});

export const CUT_TRANSITION_DEFAULTS=Object.freeze({
  'glitch-slam':{frames:12,accent:'#22d3ee'},
  'diagonal-wipe':{frames:14,accent:'#38bdf8'},
  'energy-burst':{frames:12,accent:'#fde047'},
  shutter:{frames:14,accent:'#f59e0b'},
});

export const FILM_BURN_PRESETS=Object.freeze({
  warm:['rgba(249,115,22,0.62)','rgba(251,191,36,0.44)','rgba(255,255,255,0.24)'],
  cyan:['rgba(14,165,233,0.58)','rgba(56,189,248,0.42)','rgba(224,242,254,0.22)'],
  crimson:['rgba(220,38,38,0.62)','rgba(249,115,22,0.42)','rgba(254,226,226,0.22)'],
});

export const PANEL_STYLE_NAMES=Object.freeze(['system','comic','speech']);
export const BGM_PRESET_NAMES=Object.freeze(['tension','action','trailer','story','ambience-water','ambience-room','ambience-warm']);
export const SFX_PRESET_NAMES=Object.freeze(['impact','chime','breath']);

export const AURA_NAMES=Object.freeze(Object.keys(AURA_PRESETS));
export const LINE_NAMES=Object.freeze(Object.keys(LINE_PRESETS));
export const FLASH_NAMES=Object.freeze(Object.keys(FLASH_COLORS));
export const MOOD_NAMES=Object.freeze(Object.keys(MOOD_PRESETS));
export const PARTICLE_NAMES=Object.freeze(Object.keys(PARTICLE_PRESETS));
export const IMPACT_NAMES=Object.freeze(Object.keys(IMPACT_COLORS));
export const SFX_STYLE_NAMES=Object.freeze(Object.keys(SFX_STYLES));
export const CUT_TRANSITION_NAMES=Object.freeze(Object.keys(CUT_TRANSITION_DEFAULTS));
export const FILM_BURN_NAMES=Object.freeze(Object.keys(FILM_BURN_PRESETS));
export const IMPACT_FRAME_NAMES=Object.freeze(Object.keys(IMPACT_FRAME_STYLES));
export const TRAIL_COLOR_NAMES=Object.freeze(Object.keys(TRAIL_COLORS));
export const LIGHTING_NAMES=Object.freeze(Object.keys(LIGHTING_PRESETS));

/** Deterministic stepped pseudo-random in [-1, 1] for 2D comic jitter (changes every `step` frames). */
export function steppedJitter(seed,frame,step=4){
  const bucket=Math.floor(Math.max(0,frame)/Math.max(1,step));
  const x=Math.sin((bucket+1)*12.9898+seed*78.233)*43758.5453;
  return (x-Math.floor(x))*2-1;
}

/** Envelope for aura: bursts brightly on entry (first 10f), then settles to steady comic pulsing. */
export function auraEnvelope(localFrame,duration){
  const burst=localFrame<10?0.65+0.35*Math.sin((localFrame/10)*Math.PI):0.72;
  const fadeOut=duration-localFrame<=6?Math.max(0,(duration-localFrame)/6):1;
  return Math.min(1,burst)*fadeOut;
}

/**
 * Pure audio-ducking volume curve for BGM tracks (learned from auto-ducking audio pipelines).
 * Lowers BGM from `baseVolume` down to `duckVolume` smoothly whenever any voice cue is active.
 */
export function computeDuckedVolume(sceneFrame,{baseVolume=0.26,duckVolume=0.10,cues=[],from=0,to=1,fadeIn=12,fadeOut=18,ramp=6}={}){
  if(!Number.isFinite(sceneFrame)||to<=from||sceneFrame<from||sceneFrame>=to)return 0;
  const clamp01=v=>Math.max(0,Math.min(1,v));
  const inGain=fadeIn>0?clamp01((sceneFrame-from+1)/fadeIn):1;
  const outGain=fadeOut>0?clamp01((to-sceneFrame)/fadeOut):1;
  let duck=0;
  for(const cue of cues??[]){
    if(!cue||!Number.isFinite(cue.from)||!Number.isFinite(cue.to)||cue.to<=cue.from)continue;
    let p=0;
    if(sceneFrame>=cue.from&&sceneFrame<cue.to){
      p=1;
    }else if(ramp>0&&sceneFrame>=cue.from-ramp&&sceneFrame<cue.from){
      p=(sceneFrame-(cue.from-ramp))/ramp;
    }else if(ramp>0&&sceneFrame>=cue.to&&sceneFrame<cue.to+ramp){
      p=1-(sceneFrame-cue.to)/ramp;
    }
    if(p>duck)duck=p;
    if(duck>=1)break;
  }
  const mixed=baseVolume+(duckVolume-baseVolume)*clamp01(duck);
  return clamp01(mixed*Math.min(inGain,outGain));
}

/**
 * Deterministic double-ink sketchy rectangle SVG paths (inspired by rough.js) so Remotion renders
 * hand-drawn comic/system panel frames synchronously on frame 0 without browser Canvas state.
 */
export function sketchyRectPaths(w,h,pad=6,seed=1){
  const width=Math.max(24,Number(w)||100),height=Math.max(24,Number(h)||100);
  const jitter=idx=>{
    const s=Math.sin((seed+1)*91.73+idx*37.17)*43758.5453;
    return ((s-Math.floor(s))*2-1)*2.4;
  };
  const strokePass=(pass,inset)=>{
    const x0=pad+inset,y0=pad+inset,x1=width-pad-inset,y1=height-pad-inset;
    const mx=(x0+x1)/2,my=(y0+y1)/2,b=pass*32;
    const pts=[
      [x0+jitter(b+1),y0+jitter(b+2)],
      [mx+jitter(b+3),y0+jitter(b+4)*0.8],
      [x1+jitter(b+5),y0+jitter(b+6)],
      [x1+jitter(b+7)*0.8,my+jitter(b+8)],
      [x1+jitter(b+9),y1+jitter(b+10)],
      [mx+jitter(b+11),y1+jitter(b+12)*0.8],
      [x0+jitter(b+13),y1+jitter(b+14)],
      [x0+jitter(b+15)*0.8,my+jitter(b+16)],
    ];
    return `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} `
      +`Q ${pts[1][0].toFixed(1)} ${pts[1][1].toFixed(1)} ${pts[2][0].toFixed(1)} ${pts[2][1].toFixed(1)} `
      +`Q ${pts[3][0].toFixed(1)} ${pts[3][1].toFixed(1)} ${pts[4][0].toFixed(1)} ${pts[4][1].toFixed(1)} `
      +`Q ${pts[5][0].toFixed(1)} ${pts[5][1].toFixed(1)} ${pts[6][0].toFixed(1)} ${pts[6][1].toFixed(1)} `
      +`Q ${pts[7][0].toFixed(1)} ${pts[7][1].toFixed(1)} ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} Z`;
  };
  return [strokePass(0,0),strokePass(1,1.6)];
}

/**
 * Character-weighted active word index in `[0, words.length - 1]` for caption speech highlight.
 * Pure & deterministic for unit tests and Remotion frame rendering.
 */
export function activeCaptionWordIndex(caption,progress){
  const words=String(caption??'').trim().split(/\s+/).filter(Boolean);
  if(words.length<=1)return words.length?0:-1;
  const p=Math.max(0,Math.min(0.999999,Number.isFinite(progress)?progress:0));
  const weights=words.map(w=>w.length+2);
  const total=weights.reduce((a,b)=>a+b,0);
  const target=p*total;
  let acc=0;
  for(let i=0;i<words.length;i++){
    acc+=weights[i];
    if(target<acc)return i;
  }
  return words.length-1;
}

/**
 * Losslessly split a long dialogue string into balanced sequential speech-bubble turns.
 * Prefers full sentence breaks, then semicolons/em-dashes/colons, then commas/ellipses,
 * and avoids premature splits after `...` before a lowercase continuation (`cha mẹ con... đã`).
 * Invariant: `splitSpeechChunks(text, maxChars).join(' ') === normalizedText`.
 */
export function splitSpeechChunks(text,maxChars=58){
  const clean=String(text??'').trim().replace(/\s+/g,' ');
  if(!clean)return [];
  const limit=Math.max(24,Math.min(140,Math.round(Number(maxChars)||58)));
  if(clean.length<=limit)return [clean];

  // 1. Split into sentences, keeping lowercase continuations after ellipses (`... đã`) intact
  const allWords=clean.split(' ');
  const sentences=[];
  let buf=[];
  for(let i=0;i<allWords.length;i++){
    const w=allWords[i];
    buf.push(w);
    const next=allWords[i+1];
    if(next&&/[.?!…]["”]?$/.test(w)){
      const isEllipsis=/(\.\.\.|…)["”]?$/.test(w);
      const nextLower=/^["“]?\p{Ll}/u.test(next);
      if(!isEllipsis||!nextLower){
        sentences.push(buf.join(' '));
        buf=[];
      }
    }
  }
  if(buf.length)sentences.push(buf.join(' '));

  // 2. Clause-aware recursive split for any sentence longer than `limit`
  const splitLong=(s)=>{
    if(s.length<=limit)return [s];
    const words=s.split(' ');
    if(words.length<=2)return [s];
    const parts=Math.max(2,Math.ceil(s.length/limit));
    const target=s.length/parts;
    const minLeft=Math.max(14,Math.floor(limit*0.34));
    const tier1=[],tier2=[],tier3=[];
    let len=0;
    for(let i=0;i<words.length-1;i++){
      len+=(i>0?1:0)+words[i].length;
      const rightWords=words.length-1-i;
      if(len>limit)break;
      if(words.length>=4&&rightWords<2)continue;
      const w=words[i];
      const DANGLING_VN=new Set(['của','trong','với','cho','từ','và','hay','để','về','mà','là','đã','sẽ','đang','những','các','một','rất','bị','được','ở','như','khi','nếu','thì']);
      const normW=w.toLowerCase().replace(/[^\p{L}]/gu,'');
      const score=Math.abs(len-target)+(DANGLING_VN.has(normW)?18:0);
      if(len>=minLeft&&/[;—:]["”]?$/.test(w))tier1.push({i,score});
      else if(len>=minLeft&&/(,|…|\.{3})["”]?$/.test(w))tier2.push({i,score});
      tier3.push({i,score});
    }
    const pool=tier1.length?tier1:tier2.length?tier2:tier3;
    let pick=pool.length?pool.reduce((a,b)=>b.score<a.score?b:a).i:-1;
    if(pick<0){
      let acc=0;
      for(let i=0;i<words.length-1;i++){
        acc+=(i>0?1:0)+words[i].length;
        if(acc<=limit)pick=i;
      }
    }
    if(pick<0)return [s];
    return [words.slice(0,pick+1).join(' '),...splitLong(words.slice(pick+1).join(' '))];
  };

  const fragments=[];
  for(const sent of sentences)fragments.push(...splitLong(sent));

  // 3. Merge tiny adjacent fragments without exceeding `limit` (or slight allowance for short orphan tails)
  const out=[];
  for(const frag of fragments){
    const prev=out[out.length-1];
    if(prev&&(prev.length+1+frag.length<=limit||(frag.split(' ').length<=2&&prev.length+1+frag.length<=limit+12))){
      out[out.length-1]=prev+' '+frag;
    }else{
      out.push(frag);
    }
  }
  if(out.length>=2&&out[0].length<18&&out[0].length+1+out[1].length<=limit+10){
    out.splice(0,2,out[0]+' '+out[1]);
  }
  return out;
}

/**
 * Character-weighted lookup returning `{ index, localProgress }` across chunks
 * so subtitle chunk transitions match `allocateChunkSpans` TTS timing.
 */
export function weightedChunkAt(chunks,progress){
  const list=Array.isArray(chunks)?chunks:[];
  const p=Math.max(0,Math.min(0.999999,Number.isFinite(progress)?progress:0));
  if(list.length<=1)return {index:list.length?0:-1,localProgress:p};
  const weights=list.map(c=>Math.max(8,String(c??'').length));
  const total=weights.reduce((a,b)=>a+b,0);
  const target=p*total;
  let acc=0;
  for(let i=0;i<list.length;i++){
    const next=acc+weights[i];
    if(target<next||i===list.length-1){
      return {index:i,localProgress:Math.max(0,Math.min(1,(target-acc)/weights[i]))};
    }
    acc=next;
  }
  return {index:list.length-1,localProgress:1};
}

/**
 * Locate normalized word span `[startRatio, endRatio]` of `speechText` inside a beat's `quote`
 * (weighted by word length + 2 to approximate spoken TTS rhythm). Returns `null` if unmatched.
 */
export function locateQuoteSpan(quote,speechText){
  const tokenize=s=>String(s??'').trim().split(/\s+/).filter(Boolean).map(w=>({
    norm:w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,''),
    weight:Math.max(2,w.length+2),
  })).filter(t=>t.norm.length>0);
  const qTokens=tokenize(quote),sTokens=tokenize(speechText);
  if(!qTokens.length||!sTokens.length)return null;
  const prefix=[0];
  for(const t of qTokens)prefix.push(prefix[prefix.length-1]+t.weight);
  const totalWeight=prefix[prefix.length-1];
  if(!totalWeight)return null;

  if(sTokens.length<=qTokens.length){
    for(let i=0;i<=qTokens.length-sTokens.length;i++){
      let ok=true;
      for(let j=0;j<sTokens.length;j++){
        if(qTokens[i+j].norm!==sTokens[j].norm){ok=false;break;}
      }
      if(ok)return {startRatio:prefix[i]/totalWeight,endRatio:prefix[i+sTokens.length]/totalWeight,exact:true};
    }
  }
  if(sTokens.length>=3){
    const minSpan=Math.max(3,Math.floor(sTokens.length*0.65));
    const maxSpan=Math.ceil(sTokens.length*1.45);
    for(let i=0;i<=qTokens.length-3;i++){
      if(qTokens[i].norm===sTokens[0].norm&&qTokens[i+1].norm===sTokens[1].norm&&qTokens[i+2].norm===sTokens[2].norm){
        const endMin=Math.max(i+3,i+minSpan);
        const endMax=Math.min(qTokens.length,i+maxSpan);
        for(let end=endMin;end<=endMax;end++){
          if(qTokens[end-3].norm===sTokens[sTokens.length-3].norm
            &&qTokens[end-2].norm===sTokens[sTokens.length-2].norm
            &&qTokens[end-1].norm===sTokens[sTokens.length-1].norm){
            return {startRatio:prefix[i]/totalWeight,endRatio:prefix[end]/totalWeight,exact:false};
          }
        }
      }
    }
  }
  return null;
}

/**
 * Allocate contiguous non-overlapping `[from, to)` frame spans inside a cut for sequential speech turns.
 * Omits inter-bubble gap when cut duration is tight so every span stays strictly non-empty (`to > from`).
 */
export function allocateChunkSpans(chunks,from,to,gapFrames=2){
  const list=(Array.isArray(chunks)?chunks:[]).map(c=>String(c??'').trim()).filter(Boolean);
  if(!list.length||to<=from)return [];
  const total=to-from;
  if(list.length===1)return [{text:list[0],from,to,turnIndex:0,turnTotal:1}];
  const gap=total>=list.length*16?Math.max(0,Math.min(4,Math.round(gapFrames))):0;
  const avail=Math.max(list.length,total-gap*(list.length-1));
  const weights=list.map(c=>Math.max(8,c.length));
  const sum=weights.reduce((a,b)=>a+b,0);
  const durs=weights.map(w=>Math.max(1,Math.round((avail*w)/sum)));
  let diff=avail-durs.reduce((a,b)=>a+b,0);
  while(diff!==0){
    const idx=diff>0?durs.length-1:durs.reduce((best,v,i,arr)=>v>arr[best]?i:best,0);
    if(diff<0&&durs[idx]<=1)break;
    durs[idx]+=diff>0?1:-1;
    diff+=diff>0?-1:1;
  }
  const out=[];
  let cursor=from;
  for(let i=0;i<list.length;i++){
    const spanTo=i===list.length-1?to:Math.min(to,cursor+durs[i]);
    const finalTo=Math.max(cursor+1,spanTo);
    out.push({text:list[i],from:cursor,to:finalTo,turnIndex:i,turnTotal:list.length});
    cursor=Math.min(to,finalTo+(i<list.length-1?gap:0));
  }
  return out;
}

/**
 * Extract all quoted dialogue segments (`"..."` / `“...”`) from a beat's quote
 * along with word-weight normalized `[startRatio, endRatio]` spans in reading order.
 * Falls back to a single unquoted span `[0, 1]` when no quotation marks exist.
 */
export function extractQuotedDialogueSegments(quote){
  const raw=String(quote??'');
  const trimmed=raw.trim();
  if(!trimmed)return [];
  const matches=[...raw.matchAll(/["“]([^"”]+)["”]/g)].filter(m=>m[1]&&m[1].trim());
  if(!matches.length){
    return [{text:trimmed,startRatio:0,endRatio:1,quoted:false}];
  }
  const tokens=[];
  for(const tm of raw.matchAll(/\S+/g)){
    tokens.push({
      rawStart:tm.index,
      rawEnd:tm.index+tm[0].length,
      weight:Math.max(2,tm[0].length+2),
    });
  }
  if(!tokens.length){
    return matches.map(m=>({text:m[1].trim(),startRatio:0,endRatio:1,quoted:true}));
  }
  const prefix=[0];
  for(const t of tokens)prefix.push(prefix[prefix.length-1]+t.weight);
  const totalWeight=prefix[prefix.length-1]||1;
  return matches.map(m=>{
    const mStart=m.index,mEnd=m.index+m[0].length;
    const innerStart=mStart+1,innerEnd=Math.max(innerStart,mEnd-1);
    let first=-1,last=-1;
    for(let i=0;i<tokens.length;i++){
      if(tokens[i].rawStart<innerEnd&&tokens[i].rawEnd>innerStart){
        if(first<0)first=i;
        last=i;
      }
    }
    if(first<0){
      for(let i=0;i<tokens.length;i++){
        if(tokens[i].rawStart<mEnd&&tokens[i].rawEnd>mStart){
          if(first<0)first=i;
          last=i;
        }
      }
    }
    const startRatio=first>=0?prefix[first]/totalWeight:0;
    const endRatio=last>=0?prefix[last+1]/totalWeight:1;
    return {text:m[1].trim(),startRatio,endRatio,quoted:true};
  });
}

/**
 * Split subtitle text cleanly along `"..."` / `“...”` boundaries into typed chunks
 * (`dialogue` vs `narration`) so spoken character lines and narrator prose never mix on the same subtitle line.
 */
export function splitSubtitleSegments(text,maxChars=72){
  const clean=String(text??'').trim().replace(/\s+/g,' ');
  if(!clean)return [];
  const limit=Math.max(26,Math.min(140,Math.round(Number(maxChars)||72)));
  const matches=[...clean.matchAll(/["“]([^"”]+)["”]/g)];
  if(!matches.length){
    return splitSpeechChunks(clean,limit).map(c=>({kind:'narration',text:c}));
  }
  const out=[];
  let cursor=0;
  for(const m of matches){
    if(m.index>cursor){
      const narr=clean.slice(cursor,m.index).trim();
      if(narr){
        for(const c of splitSpeechChunks(narr,limit))out.push({kind:'narration',text:c});
      }
    }
    const inner=(m[1]??'').trim();
    if(inner){
      for(const c of splitSpeechChunks(inner,Math.max(24,limit-2))){
        out.push({kind:'dialogue',text:`"${c}"`});
      }
    }
    cursor=m.index+m[0].length;
  }
  if(cursor<clean.length){
    const tail=clean.slice(cursor).trim();
    if(tail){
      for(const c of splitSpeechChunks(tail,limit))out.push({kind:'narration',text:c});
    }
  }
  return out;
}
