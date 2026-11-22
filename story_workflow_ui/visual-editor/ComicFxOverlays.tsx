// Modular Motion-Comic Overlays & Panel Renderer for CreatedScene.tsx.
// Integrates patterns adapted from open-source Remotion toolkits:
//   - Ashad001/remotion-transitions (MIT): glitch-slam, diagonal-wipe, energy-burst, shutter
//   - reactvideoeditor/remotion-templates: film-burn, glitch-text, letterbox-reveal, decaying shake
//   - ye1683/last-row-monsters-motion-comic-kit (MIT): halftone, portal-glow, debris PaperParticles, spring SoundWords, DoF layer focus
//   - rough-stuff/rough (inspiration): deterministic hand-drawn SVG double-ink panel strokes (sketchyRectPaths)
// IMPORTANT: Keep 100% browser-safe & free of staticFile/<Img>/<Audio> so composition-media scoping remains exact.
import React from 'react';
import {interpolate,spring,useVideoConfig} from 'remotion';
import {valueAt} from './model.mjs';
import {
  AURA_PRESETS,
  LINE_PRESETS,
  FLASH_COLORS,
  MOOD_PRESETS,
  PARTICLE_PRESETS,
  IMPACT_COLORS,
  SFX_STYLES,
  CUT_TRANSITION_DEFAULTS,
  FILM_BURN_PRESETS,
  IMPACT_FRAME_STYLES,
  LIGHTING_PRESETS,
  steppedJitter,
  auraEnvelope,
  sketchyRectPaths,
} from './fx-presets.mjs';

const CLAMP={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};

function hash01(seed:number){
  const x=Math.sin(seed*12.9898+78.233)*43758.5453;
  return x-Math.floor(x);
}

function escapeAttr(val:string){
  return String(val??'').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
}

export function AuraOverlay({fx,frame,doc}:{fx:any;frame:number;doc:any}){
  const preset=(AURA_PRESETS as any)[fx.preset]??AURA_PRESETS.power;
  const local=frame-fx.from,dur=Math.max(1,fx.to-fx.from);
  let dx=0,dy=0,sRatio=1,layerOpacity=1;
  const layer=fx.layerId?doc?.layers?.[fx.layerId]:null;
  if(layer){
    const v=valueAt(layer,frame);
    dx=(v.x??0)-(layer.base?.x??0);
    dy=(v.y??0)-(layer.base?.y??0);
    if(layer.base?.scale)sRatio=(v.scale??layer.base.scale)/layer.base.scale;
    layerOpacity=v.opacity??1;
  }
  const env=auraEnvelope(local,dur)*(fx.intensity??1)*layerOpacity;
  const jx=steppedJitter(11,frame,preset.step)*7;
  const jy=steppedJitter(23,frame,preset.step)*5;
  const sc=(1+steppedJitter(37,frame,preset.step)*0.055)*sRatio;
  const w=Math.round((fx.height??750)*0.76),h=Math.round((fx.height??750)*1.10);
  const left=Math.round((fx.x??960)+dx-w/2+jx),top=Math.round((fx.y??960)+dy-h+32+jy);

  const flames=Array.from({length:7},(_,i)=>{
    const angle=((i-3)/3)*0.55;
    const cx=w/2+Math.sin(angle)*(w*0.33)+steppedJitter(100+i,frame,preset.step)*14;
    const baseY=h*0.84-Math.abs(i-3)*12;
    const fh=h*(0.36+0.24*((i+1)%2))+steppedJitter(200+i,frame,preset.step)*26;
    const tipY=Math.max(12,baseY-fh);
    const sway=steppedJitter(250+i,frame,preset.step)*18;
    return `M ${cx} ${baseY} C ${cx-34} ${baseY-fh*0.25}, ${cx-24+sway} ${tipY+fh*0.35}, ${cx+sway*0.6} ${tipY} C ${cx+24+sway} ${tipY+fh*0.35}, ${cx+34} ${baseY-fh*0.25}, ${cx} ${baseY} Z`;
  });

  const orbs=Array.from({length:7},(_,i)=>{
    const speed=0.045+hash01(500+i)*0.04;
    const phase=(local*speed+hash01(550+i))%1;
    const ox=w*(0.24+hash01(580+i)*0.52)+Math.sin(local*0.22+i)*12;
    const oy=h*0.86-phase*h*0.76;
    const r=4+hash01(600+i)*5;
    const op=Math.sin(phase*Math.PI)*0.85;
    return {ox,oy,r,op};
  });

  return <div style={{position:'absolute',left,top,width:w,height:h,zIndex:fx.z??95,pointerEvents:'none',opacity:Math.min(1,env),transform:`scale(${sc})`,transformOrigin:'50% 85%'}}>
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{overflow:'visible'}}>
      <defs>
        <radialGradient id={`aura-g-${fx.id}`} cx="50%" cy="60%" r="52%">
          <stop offset="0%" stopColor={preset.inner}/>
          <stop offset="55%" stopColor={preset.outer}/>
          <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
        </radialGradient>
      </defs>
      <ellipse cx={w/2} cy={h*0.56} rx={w*0.50} ry={h*0.46} fill={`url(#aura-g-${fx.id})`}/>
      <g style={{filter:'blur(3px)'}}>
        {flames.map((d,i)=><path key={i} d={d} fill={preset.core} stroke={preset.stroke} strokeOpacity={0.55} strokeWidth={2.5}/>)}
      </g>
      {orbs.map((o,i)=><circle key={i} cx={o.ox} cy={o.oy} r={o.r} fill={preset.inner} opacity={o.op}/>)}
    </svg>
  </div>;
}

export function LinesOverlay({fx,frame}:{fx:any;frame:number}){
  const preset=(LINE_PRESETS as any)[fx.preset]??LINE_PRESETS.focus;
  const color=fx.color??preset.color;
  if(preset.kind==='speed-horiz'){
    const half=Math.floor(preset.rays/2);
    const streaks=Array.from({length:preset.rays},(_,i)=>{
      const isTop=i<half;
      const lane=isTop?i:i-half;
      const yBase=isTop?(24+lane*(220/Math.max(1,half))):(760+lane*(240/Math.max(1,preset.rays-half)));
      const y=yBase+steppedJitter(700+i,frame,preset.step)*10;
      const len=260+hash01(730+i)*460;
      const span=1920+len;
      const shift=((frame*58*(0.8+hash01(760+i)*0.5))+hash01(790+i)*span)%span;
      const x1=1920-shift;
      const w=preset.strokeWidth*(0.65+0.6*hash01(810+i));
      return {x1,x2:x1+len,y,w};
    });
    return <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,zIndex:fx.z??8500,pointerEvents:'none',opacity:fx.opacity??1}}>
      {streaks.map((s,i)=><line key={i} x1={s.x1} y1={s.y} x2={s.x2} y2={s.y} stroke={color} strokeWidth={s.w} strokeLinecap="round"/>)}
    </svg>;
  }
  const jitterAngle=steppedJitter(41,frame,preset.step)*6;
  const cx=960,cy=540,outerR=1180;
  const rays=Array.from({length:preset.rays},(_,i)=>{
    const a=((i/preset.rays)*360+jitterAngle)*Math.PI/180;
    const rIn=preset.innerRadius+steppedJitter(300+i,frame,preset.step)*70;
    return {x1:cx+Math.cos(a)*rIn,y1:cy+Math.sin(a)*rIn,x2:cx+Math.cos(a)*outerR,y2:cy+Math.sin(a)*outerR,w:preset.strokeWidth*(0.7+0.6*Math.abs(steppedJitter(400+i,frame,preset.step)))};
  });
  return <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,zIndex:fx.z??8500,pointerEvents:'none',opacity:fx.opacity??1}}>
    {rays.map((r,i)=><line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={color} strokeWidth={r.w} strokeLinecap="round"/>)}
  </svg>;
}

export function MoodOverlay({fx,frame}:{fx:any;frame:number}){
  const preset=(MOOD_PRESETS as any)[fx.preset]??MOOD_PRESETS.tension;
  if(!preset.memoryStyle){
    const pulse=preset.pulse?(0.85+0.15*Math.sin((frame-fx.from)*0.25)):1;
    const opacity=Math.min(1,(fx.opacity??1)*pulse);
    return <div style={{
      position:'absolute',inset:0,zIndex:fx.z??8200,pointerEvents:'none',opacity,
      backgroundColor:preset.tint,
      backgroundImage:`radial-gradient(ellipse at center, transparent 48%, ${preset.vignette} 100%)`,
    }}/>;
  }

  const z=fx.z??8200;
  const baseOp=Math.max(0,Math.min(1,fx.opacity??1));
  const isWarm=preset.memoryStyle==='warm';
  const local=Math.max(0,frame-fx.from);
  const flicker=1+steppedJitter(7701,frame,3)*0.035;
  const bucket=Math.floor(Math.max(0,frame)/2);
  const scratchBucket=Math.floor(Math.max(0,frame)/3);

  const f=preset.imgFilter;
  const filterParts:string[]=[];
  if(f){
    if(f.grayscale)filterParts.push(`grayscale(${(f.grayscale*baseOp).toFixed(3)})`);
    if(f.sepia)filterParts.push(`sepia(${(f.sepia*baseOp).toFixed(3)})`);
    if(f.saturateDelta)filterParts.push(`saturate(${(1+f.saturateDelta*baseOp).toFixed(3)})`);
    if(f.contrastDelta)filterParts.push(`contrast(${(1+f.contrastDelta*baseOp).toFixed(3)})`);
    if(f.brightnessDelta)filterParts.push(`brightness(${(1+f.brightnessDelta*baseOp).toFixed(3)})`);
    if(f.hueRotate)filterParts.push(`hue-rotate(${(f.hueRotate*baseOp).toFixed(1)}deg)`);
  }
  const imgFilterCss=filterParts.join(' ');

  const scratches=[0,1,2].map((si)=>{
    const show=hash01(8100+scratchBucket*13+si*31)>0.22;
    if(!show)return null;
    const sideRight=si%2===1;
    const xBase=sideRight
      ?1582+hash01(8200+scratchBucket*7+si)*300
      :38+hash01(8250+scratchBucket*7+si)*300;
    const y1=hash01(8300+scratchBucket*11+si)*320;
    const len=340+hash01(8350+scratchBucket*17+si)*680;
    const y2=Math.min(1080,y1+len);
    const w=1.3+hash01(8400+scratchBucket*5+si)*0.9;
    const op=0.22+hash01(8450+scratchBucket*19+si)*0.20;
    return {x:Math.round(xBase),y1:Math.round(y1),y2:Math.round(y2),w,op};
  }).filter(Boolean) as Array<{x:number;y1:number;y2:number;w:number;op:number}>;

  const dustSpecks=Array.from({length:32},(_,di)=>{
    const isDark=di>=22;
    const dx=Math.round(hash01(8600+bucket*41+di*17)*1880+20);
    const dy=Math.round(hash01(8700+bucket*37+di*23)*1040+20);
    const r=isDark
      ?1.0+hash01(8800+bucket*13+di)*1.4
      :1.2+hash01(8850+bucket*13+di)*2.0;
    const op=(0.28+hash01(8900+bucket*29+di)*0.42)*(isDark?0.78:0.9);
    return {x:dx,y:dy,r,op,isDark};
  });

  const orbs=Array.from({length:6},(_,oi)=>{
    const speedY=isWarm?-(1.4+oi*0.25):(1.1+oi*0.2);
    const driftX=isWarm?Math.sin(local*0.05+oi)*14:-(0.9+oi*0.18)*local;
    const ox=((hash01(9000+oi*19)*1800+60+driftX)%1920+1920)%1920;
    const oy=((hash01(9100+oi*23)*1000+40+local*speedY)%1080+1080)%1080;
    const r=7+hash01(9200+oi*11)*10;
    const op=0.09+hash01(9300+oi*13)*0.07;
    return {x:Math.round(ox),y:Math.round(oy),r,op};
  });

  return <>
    {imgFilterCss&&(
      <style>{`.project-composition [data-edit-id]:not([data-edit-id$="/subtitle"]):not([data-edit-id*="speech"]):not([data-edit-id*="panel"]) > img { filter: ${imgFilterCss}; }`}</style>
    )}
    <div style={{
      position:'absolute',inset:0,zIndex:z+1,pointerEvents:'none',
      opacity:Math.min(1,baseOp*flicker),
      backgroundColor:preset.tint,
      backgroundImage:isWarm
        ?`radial-gradient(ellipse 68% 66% at 50% 48%, transparent 42%, ${preset.haloColor} 66%, ${preset.vignette} 100%), radial-gradient(circle at 8% 10%, ${preset.edgeLeak} 0%, transparent 44%), radial-gradient(circle at 92% 88%, ${preset.edgeLeak} 0%, transparent 46%), linear-gradient(180deg, ${preset.frameTint} 0%, transparent 18%, transparent 82%, ${preset.frameTint} 100%)`
        :`radial-gradient(ellipse 64% 62% at 50% 48%, transparent 34%, ${preset.haloColor} 58%, ${preset.vignette} 100%), radial-gradient(circle at 12% 14%, ${preset.edgeLeak} 0%, transparent 40%), linear-gradient(180deg, ${preset.frameTint} 0%, transparent 22%, transparent 78%, ${preset.frameTint} 100%)`,
      boxShadow:isWarm
        ?'inset 0 0 130px rgba(255,244,214,0.34), inset 0 0 220px rgba(42,22,8,0.40)'
        :'inset 0 0 155px rgba(2,6,23,0.70), inset 0 0 52px rgba(15,23,42,0.58)',
    }}/>
    <div style={{position:'absolute',inset:0,zIndex:z+2,pointerEvents:'none',opacity:baseOp,overflow:'hidden'}}>
      <div style={{
        position:'absolute',inset:0,
        opacity:isWarm?0.04:0.055,
        backgroundImage:'repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, rgba(0,0,0,0.6) 2px, transparent 4px)',
      }}/>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position:'absolute',inset:0}}>
        {scratches.map((s,si)=>(
          <line key={`sc-${si}`} x1={s.x} y1={s.y1} x2={s.x} y2={s.y2} stroke={preset.scratchColor} strokeWidth={s.w} opacity={s.op}/>
        ))}
        {dustSpecks.map((d,di)=>(
          <circle key={`du-${di}`} cx={d.x} cy={d.y} r={d.r} fill={d.isDark?preset.grainDark:preset.grainLight} opacity={d.op}/>
        ))}
        {orbs.map((o,oi)=>(
          <circle key={`ob-${oi}`} cx={o.x} cy={o.y} r={o.r} fill={preset.haloColor} opacity={o.op}/>
        ))}
        <rect x={24} y={24} width={1872} height={1032} rx={22} fill="none" stroke={isWarm?'rgba(255,244,214,0.24)':'rgba(148,163,184,0.18)'} strokeWidth={2}/>
      </svg>
    </div>
  </>;
}

export function ParticlesOverlay({fx,frame}:{fx:any;frame:number}){
  const preset=(PARTICLE_PRESETS as any)[fx.preset]??PARTICLE_PRESETS.sparks;
  const local=frame-fx.from;
  if(preset.dir==='burst'){
    // Adapted from ye1683/last-row-monsters-motion-comic-kit PaperParticles (MIT)
    const dur=Math.max(1,fx.to-fx.from);
    const progress=interpolate(frame,[fx.from,fx.from+dur],[0,1],CLAMP);
    const cx=fx.x??960,cy=fx.y??540;
    const fadeOut=progress>0.75?Math.max(0,(1-progress)/0.25):1;
    return <div style={{position:'absolute',inset:0,zIndex:fx.z??8400,pointerEvents:'none',opacity:(fx.opacity??1)*fadeOut,overflow:'hidden'}}>
      {Array.from({length:preset.count},(_,index)=>{
        const angle=hash01(2000+index)*Math.PI*2;
        const radius=55+progress*(160+hash01(2050+index)*360);
        const size=preset.size[0]+hash01(2100+index)*(preset.size[1]-preset.size[0]);
        const delay=hash01(2150+index)*0.28;
        const travel=Math.max(0,(progress-delay)/(1-delay));
        return <div key={index} style={{
          position:'absolute',
          left:cx+Math.cos(angle)*radius*travel,
          top:cy+Math.sin(angle)*radius*travel-travel*65,
          width:size,
          height:size*0.66,
          border:'2px solid rgba(23,36,43,0.75)',
          backgroundColor:index%3===0?(preset.accent??'#38bdf8'):preset.color,
          transform:`rotate(${progress*280+index*31}deg)`,
        }}/>;
      })}
    </div>;
  }
  if(preset.dir==='trail'){
    const puffs=Array.from({length:preset.count},(_,i)=>{
      const speed=0.04+hash01(900+i)*0.045;
      const life=(local*speed+hash01(930+i))%1;
      const x=1820-((hash01(960+i)*1500+local*14*(0.7+hash01(990+i)*0.6))%1700);
      const y=800+hash01(1020+i)*200-life*45+steppedJitter(1050+i,frame,preset.step)*6;
      const r=(preset.size[0]+hash01(1080+i)*(preset.size[1]-preset.size[0]))*(0.7+0.6*life);
      const op=Math.sin(life*Math.PI)*0.8;
      return {x,y,r,op};
    });
    return <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,zIndex:fx.z??8400,pointerEvents:'none',opacity:fx.opacity??1}}>
      {puffs.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={p.r} fill={preset.color} opacity={p.op}/>)}
    </svg>;
  }
  if(preset.dir==='left'){
    const streaks=Array.from({length:preset.count},(_,i)=>{
      const len=preset.size[0]+hash01(1100+i)*(preset.size[1]-preset.size[0]);
      const span=1920+len;
      const shift=(local*46*(0.8+hash01(1130+i)*0.6)+hash01(1160+i)*span)%span;
      const x=1920-shift;
      const rawY=40+hash01(1190+i)*940;
      const y=(rawY>280&&rawY<660)?(rawY<470?rawY-210:rawY+220):rawY;
      const op=0.35+hash01(1220+i)*0.45;
      return {x,y,len,op};
    });
    return <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,zIndex:fx.z??8400,pointerEvents:'none',opacity:fx.opacity??1}}>
      {streaks.map((s,i)=><line key={i} x1={s.x} y1={s.y} x2={s.x+s.len} y2={s.y} stroke={preset.color} strokeWidth={2.5} strokeLinecap="round" opacity={s.op}/>)}
    </svg>;
  }
  if(preset.dir==='smoke'){
    // Atmospheric cannon smoke / harbor mist (FunnyAnimationAssitant ScreenEffect inspired)
    const clouds=Array.from({length:preset.count},(_,i)=>{
      const baseX=hash01(2400+i)*2100-120;
      const x=((baseX+local*(2.8+hash01(2430+i)*3.2))%2200)-140;
      const y=480+hash01(2460+i)*520+Math.sin(local*0.04+i)*18;
      const r=preset.size[0]+hash01(2490+i)*(preset.size[1]-preset.size[0]);
      const op=0.45+hash01(2520+i)*0.45;
      return {x,y,r,op,alt:i%2===1};
    });
    const gid=`smoke-g-${fx.id}`;
    return <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,zIndex:fx.z??8420,pointerEvents:'none',opacity:fx.opacity??1}}>
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={preset.color}/>
          <stop offset="60%" stopColor={preset.accent??preset.color}/>
          <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
        </radialGradient>
      </defs>
      {clouds.map((c,i)=><circle key={i} cx={c.x} cy={c.y} r={c.r} fill={`url(#${gid})`} opacity={c.op}/>)}
    </svg>;
  }
  if(preset.dir==='rain'){
    // Foreground angled storm rain + ground splashes
    const drops=Array.from({length:preset.count},(_,i)=>{
      const speedY=36+hash01(2700+i)*24;
      const len=preset.size[0]+hash01(2750+i)*(preset.size[1]-preset.size[0]);
      const baseX=hash01(2800+i)*2160;
      const rawY=(hash01(2850+i)*1200+local*speedY)%1220-120;
      const x=((baseX-rawY*0.26)%2100+2100)%2100-90;
      const op=0.35+hash01(2900+i)*0.55;
      return {x1:x,y1:rawY,x2:x-len*0.26,y2:rawY+len,op};
    });
    const splashes=Array.from({length:10},(_,i)=>{
      const phase=((local*0.16)+hash01(2950+i))%1;
      const sx=120+hash01(2980+i)*1680;
      const sy=910+hash01(3010+i)*110;
      return {sx,sy,rx:6+phase*16,op:(1-phase)*0.65};
    });
    return <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,zIndex:fx.z??8420,pointerEvents:'none',opacity:fx.opacity??1}}>
      {drops.map((d,i)=><line key={i} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke={preset.color} strokeWidth={2.2} strokeLinecap="round" opacity={d.op}/>)}
      {splashes.map((s,i)=><ellipse key={`sp-${i}`} cx={s.sx} cy={s.sy} rx={s.rx} ry={s.rx*0.32} fill="none" stroke={preset.color} strokeWidth={1.6} opacity={s.op}/>)}
    </svg>;
  }
  const driftAmp=preset.dir==='up-drift'?38:14;
  const specks=Array.from({length:preset.count},(_,i)=>{
    const speed=0.024+hash01(1300+i)*0.032;
    const life=(local*speed+hash01(1330+i))%1;
    const baseX=70+hash01(1360+i)*1780;
    const x=baseX+Math.sin(local*0.14+i*1.7)*driftAmp;
    const y=1060-life*1040;
    const r=(preset.size[0]+hash01(1390+i)*(preset.size[1]-preset.size[0]))*0.5*(1-0.35*life);
    const op=Math.sin(life*Math.PI)*0.95;
    const fill=i%3===0&&preset.accent?preset.accent:preset.color;
    return {x,y,r,op,fill};
  });
  return <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,zIndex:fx.z??8400,pointerEvents:'none',opacity:fx.opacity??1}}>
    {specks.map((s,i)=><circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.fill} opacity={s.op}/>)}
  </svg>;
}

export function ImpactOverlay({fx,frame}:{fx:any;frame:number}){
  const dur=Math.max(1,fx.to-fx.from);
  const p=Math.max(0,Math.min(1,(frame-fx.from)/dur));
  const easeOut=1-(1-p)*(1-p);
  const cx=fx.x??960,cy=fx.y??540;
  const ringR=30+310*easeOut;
  const op=Math.max(0,1-p*0.95);
  const color=(IMPACT_COLORS as any)[fx.color]??IMPACT_COLORS.white;
  const spikes=Array.from({length:12},(_,i)=>{
    const a=(i/12)*Math.PI*2;
    const r1=40+150*easeOut;
    const r2=85+285*easeOut;
    return {x1:cx+Math.cos(a)*r1,y1:cy+Math.sin(a)*r1,x2:cx+Math.cos(a)*r2,y2:cy+Math.sin(a)*r2};
  });
  return <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,zIndex:fx.z??8700,pointerEvents:'none',opacity:op}}>
    <circle cx={cx} cy={cy} r={ringR} fill="none" stroke={color} strokeWidth={Math.max(2,14*(1-p))}/>
    <circle cx={cx} cy={cy} r={ringR*0.68} fill="none" stroke="#ffffff" strokeWidth={Math.max(1.5,7*(1-p))} opacity={0.85}/>
    {spikes.map((s,i)=><line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={color} strokeWidth={Math.max(2,7*(1-p))} strokeLinecap="round"/>)}
  </svg>;
}

export function LightningOverlay({fx,frame}:{fx:any;frame:number}){
  const xBase=fx.x??960,color=fx.color??'#93c5fd';
  const segs=10;
  const pts:string[]=[];
  for(let i=0;i<=segs;i++){
    const y=Math.round((i/segs)*1080);
    const offset=i===0||i===segs?steppedJitter(1500+i,frame,4)*25:steppedJitter(1500+i,frame,4)*78;
    pts.push(`${Math.round(xBase+offset)},${y}`);
  }
  const points=pts.join(' ');
  return <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,zIndex:fx.z??8600,pointerEvents:'none'}}>
    <polyline points={points} fill="none" stroke={color} strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" opacity={0.55} style={{filter:'blur(4px)'}}/>
    <polyline points={points} fill="none" stroke="#ffffff" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round"/>
  </svg>;
}

export function SfxTextOverlay({fx,frame}:{fx:any;frame:number}){
  const {fps}=useVideoConfig();
  const st=(SFX_STYLES as any)[fx.style]??SFX_STYLES.impact;
  const local=Math.max(0,frame-fx.from);
  // Spring pop curve adapted from ye1683/last-row-monsters-motion-comic-kit SoundWords (MIT)
  const sc=spring({frame:local,fps,durationInFrames:14,config:{damping:9,stiffness:210,mass:0.55}});
  const jx=steppedJitter(1701,frame,3)*4,jy=steppedJitter(1702,frame,3)*4;
  const fadeOut=(fx.to-frame)<=4?Math.max(0,(fx.to-frame)/4):1;
  const pos:React.CSSProperties=
    fx.at==='top-left'?{left:72,top:78}:
    fx.at==='left'?{left:64,top:260}:
    fx.at==='right'?{right:64,top:260}:
    fx.at==='center'?{left:0,right:0,top:96,textAlign:'center'}:
    {right:72,top:78};

  if(fx.style==='glitch'){
    // Chromatic RGB split text adapted from reactvideoeditor/remotion-templates glitch-text.tsx
    const rgbX=Math.sin(frame*0.8)*7;
    const rgbY=Math.cos(frame*1.1)*4;
    const baseStyle:React.CSSProperties={
      fontFamily:'"Impact", "Arial Black", "Segoe UI", sans-serif',
      fontSize:84,fontWeight:900,fontStyle:'italic',lineHeight:1.05,letterSpacing:'0.03em',
      userSelect:'none',
    };
    return <div style={{
      position:'absolute',...pos,zIndex:fx.z??9200,pointerEvents:'none',opacity:fadeOut,
      transform:`translate(${jx}px, ${jy}px) rotate(${fx.rotate??-6}deg) scale(${sc})`,
      transformOrigin:'50% 50%',
    }}>
      <div style={{...baseStyle,position:'absolute',inset:0,color:st.cyan??'#22d3ee',transform:`translate(${rgbX}px, ${rgbY}px)`,mixBlendMode:'screen'}}>{fx.text}</div>
      <div style={{...baseStyle,position:'absolute',inset:0,color:st.magenta??'#e879f9',transform:`translate(${-rgbX}px, ${-rgbY}px)`,mixBlendMode:'screen'}}>{fx.text}</div>
      <div style={{...baseStyle,position:'relative',color:st.fill,WebkitTextStroke:`5px ${st.stroke}`,paintOrder:'stroke fill'}}>{fx.text}</div>
    </div>;
  }

  return <div style={{
    position:'absolute',...pos,zIndex:fx.z??9200,pointerEvents:'none',
    opacity:fadeOut,
    fontFamily:'"Impact", "Arial Black", "Segoe UI", sans-serif',
    fontSize:84,fontWeight:900,fontStyle:'italic',lineHeight:1.05,letterSpacing:'0.03em',
    color:st.fill,
    WebkitTextStroke:`5px ${st.stroke}`,
    paintOrder:'stroke fill',
    filter:`drop-shadow(6px 6px 0px ${st.shadow})`,
    transform:`translate(${jx}px, ${jy}px) rotate(${fx.rotate??-8}deg) scale(${sc})`,
    transformOrigin:'50% 50%',
    userSelect:'none',
  }}>{fx.text}</div>;
}

export function FlashOverlay({fx,frame}:{fx:any;frame:number}){
  const local=frame-fx.from,dur=Math.max(1,fx.to-fx.from);
  const alpha=Math.max(0,0.82*(1-local/dur));
  const bg=(FLASH_COLORS as any)[fx.color]??FLASH_COLORS.white;
  return <div style={{position:'absolute',inset:0,zIndex:fx.z??25000,pointerEvents:'none',background:bg,opacity:alpha}}/>;
}

/**
 * Cut transitions rendered inside the cut's own entry frames (never lengthens verified audio cues).
 * Patterns adapted from Ashad001/remotion-transitions (MIT): glitch-slam, diagonal-wipe, energy-burst, shutter.
 */
export function CutTransitionOverlay({fx,frame}:{fx:any;frame:number}){
  const dur=Math.max(1,fx.to-fx.from);
  const p=Math.max(0,Math.min(1,(frame-fx.from)/dur));
  const preset=fx.preset??'glitch-slam';
  const def=(CUT_TRANSITION_DEFAULTS as any)[preset]??CUT_TRANSITION_DEFAULTS['glitch-slam'];
  const accent=fx.color??def.accent;
  const darkBg='#090d16';

  if(preset==='diagonal-wipe'){
    const pe=1-Math.pow(1-p,2.5);
    const bx=interpolate(pe,[0,1],[-14,118],CLAMP);
    return <div style={{position:'absolute',inset:0,zIndex:fx.z??8950,pointerEvents:'none',overflow:'hidden'}}>
      <div style={{position:'absolute',top:0,bottom:0,left:`${bx}%`,right:0,background:darkBg}}/>
      <div style={{position:'absolute',top:'-10%',bottom:'-10%',left:`${bx-7}%`,width:'10%',background:darkBg,transform:'skewX(-9deg)',transformOrigin:'top left'}}/>
      <div style={{position:'absolute',top:'-10%',bottom:'-10%',left:`${bx-0.5}%`,width:5,background:accent,transform:'skewX(-9deg)',boxShadow:`0 0 18px ${accent}, 0 0 36px ${accent}`}}/>
    </div>;
  }

  if(preset==='energy-burst'){
    const opacity=interpolate(p,[0,0.18,0.65,1],[0.95,0.72,0.18,0],CLAMP);
    return <div style={{
      position:'absolute',inset:0,zIndex:fx.z??8950,pointerEvents:'none',opacity,mixBlendMode:'screen',
      background:`radial-gradient(circle at 50% 50%, #ffffff 0%, ${accent} 22%, rgba(255,255,255,0.22) 45%, transparent 72%)`,
    }}/>;
  }

  if(preset==='shutter'){
    const panels=7,w=100/panels;
    return <div style={{position:'absolute',inset:0,zIndex:fx.z??8950,pointerEvents:'none',overflow:'hidden'}}>
      {Array.from({length:panels},(_,i)=>{
        const stagger=(i/panels)*0.28;
        const sp=Math.max(0,Math.min(1,(p-stagger)/(1-stagger)));
        const pe=1-Math.pow(1-sp,3);
        const scaleX=interpolate(pe,[0,1],[1,0],CLAMP);
        const bg=i%2===0?darkBg:accent;
        return <div key={i} style={{
          position:'absolute',top:0,bottom:0,left:`${i*w}%`,width:`${w+0.35}%`,
          background:bg,transform:`scaleX(${scaleX})`,transformOrigin:'left center',
        }}/>;
      })}
    </div>;
  }

  // Default: glitch-slam (decaying shake + 4 snappy RGB-offset horizontal strips)
  const stripOpacity=interpolate(p,[0,0.18,0.55,1],[0.45,1,0.32,0],CLAMP);
  const flashOp=interpolate(p,[0,0.22,1],[0.38,0,0],CLAMP);
  const shake=Math.sin(p*Math.PI*10)*18*Math.pow(1-p,1.5);
  const strips=[
    {top:'14%',h:'2.8%',dx:34,color:'rgba(239,68,68,0.46)'},
    {top:'36%',h:'1.8%',dx:-28,color:'rgba(34,211,238,0.46)'},
    {top:'58%',h:'3.5%',dx:42,color:'rgba(59,130,246,0.42)'},
    {top:'79%',h:'1.8%',dx:-24,color:'rgba(255,255,255,0.34)'},
  ];
  return <div style={{position:'absolute',inset:0,zIndex:fx.z??8950,pointerEvents:'none',overflow:'hidden',transform:`translateX(${shake}px)`}}>
    {flashOp>0&&<div style={{position:'absolute',inset:0,background:'#ffffff',opacity:flashOp}}/>}
    {strips.map((s,i)=><div key={i} style={{
      position:'absolute',top:s.top,left:-40,right:-40,height:s.h,background:s.color,
      transform:`translateX(${s.dx*(1-p)*1.4}px)`,opacity:stripOpacity,mixBlendMode:'screen',
    }}/>)}
  </div>;
}

/**
 * Animated organic light leak / film burn overlay.
 * Adapted from reactvideoeditor/remotion-templates/templates/film-burn.tsx
 */
export function FilmBurnOverlay({fx,frame}:{fx:any;frame:number}){
  const colors=(FILM_BURN_PRESETS as any)[fx.preset]??FILM_BURN_PRESETS.warm;
  const dur=Math.max(1,fx.to-fx.from);
  const p=Math.max(0,Math.min(1,(frame-fx.from)/dur));
  const env=interpolate(p,[0,0.25,0.75,1],[0,1,0.92,0],CLAMP)*(fx.opacity??0.85);
  const x1=50+Math.sin(frame*0.07)*28,y1=50+Math.cos(frame*0.05)*22;
  const x2=50+Math.sin(frame*0.09+2)*25,y2=50+Math.cos(frame*0.08+1)*28;
  const x3=50+Math.sin(frame*0.04+4)*20,y3=50+Math.cos(frame*0.10+3)*18;
  return <div style={{position:'absolute',inset:0,zIndex:fx.z??8450,pointerEvents:'none',opacity:env,mixBlendMode:'screen'}}>
    <div style={{position:'absolute',inset:0,background:`radial-gradient(circle at ${x1}% ${y1}%, ${colors[0]}, transparent 60%)`}}/>
    <div style={{position:'absolute',inset:0,background:`radial-gradient(circle at ${x2}% ${y2}%, ${colors[1]}, transparent 50%)`}}/>
    <div style={{position:'absolute',inset:0,background:`radial-gradient(circle at ${x3}% ${y3}%, ${colors[2]}, transparent 40%)`}}/>
  </div>;
}

/** Comic print halftone dot overlay adapted from ye1683/last-row-monsters-motion-comic-kit (MIT). */
export function HalftoneOverlay({fx,frame}:{fx:any;frame:number}){
  const dur=Math.max(1,fx.to-fx.from);
  const fade=Math.min(5,dur/3);
  const env=interpolate(frame,[fx.from,fx.from+fade,fx.to-fade,fx.to],[0,1,1,0],CLAMP)*(fx.opacity??0.42);
  return <div style={{
    position:'absolute',inset:0,zIndex:fx.z??8150,pointerEvents:'none',opacity:env,
    backgroundImage:'radial-gradient(circle, rgba(18,37,45,0.48) 1.7px, transparent 1.9px)',
    backgroundSize:'14px 14px',
    mixBlendMode:'multiply',
  }}/>;
}

/** Pulsing radial portal/energy glow orb adapted from ye1683/last-row-monsters-motion-comic-kit (MIT). */
export function PortalGlowOverlay({fx,frame}:{fx:any;frame:number}){
  const dur=Math.max(1,fx.to-fx.from);
  const fade=Math.min(6,dur/3);
  const env=interpolate(frame,[fx.from,fx.from+fade,fx.to-fade,fx.to],[0,1,1,0],CLAMP)*(fx.opacity??0.88);
  const pulse=0.9+Math.sin((frame-fx.from)*0.18)*0.1;
  const size=fx.size??620;
  const color=fx.color??'#38bdf8';
  return <div style={{
    position:'absolute',left:fx.x??960,top:fx.y??540,width:size,height:size,
    zIndex:fx.z??90,pointerEvents:'none',opacity:env,
    transform:`translate(-50%, -50%) scale(${pulse})`,
    background:`radial-gradient(circle, ${color}b8 0%, ${color}46 36%, transparent 72%)`,
    mixBlendMode:'screen',
  }}/>;
}

/** Cinematic top/bottom bars below subtitle zIndex (8800 < 10000), adapted from reactvideoeditor letterbox-reveal. */
export function LetterboxOverlay({fx,frame}:{fx:any;frame:number}){
  const dur=Math.max(1,fx.to-fx.from);
  const ramp=Math.min(8,Math.max(1,Math.floor(dur/4)));
  const h=fx.height??8;
  const pct=interpolate(frame,[fx.from,fx.from+ramp,fx.to-ramp,fx.to],[0,h,h,0],CLAMP);
  return <div style={{position:'absolute',inset:0,zIndex:fx.z??8800,pointerEvents:'none'}}>
    <div style={{position:'absolute',top:0,left:0,right:0,height:`${pct}%`,background:'#000000'}}/>
    <div style={{position:'absolute',bottom:0,left:0,right:0,height:`${pct}%`,background:'#000000'}}/>
  </div>;
}

/**
 * Depth-of-field background blur + near-actor grounding shadow (learned from ye1683 LayeredShot.tsx).
 * Injects a frame-scoped <style> targeting Editable's data-edit-id attributes so Editable.tsx stays untouched.
 */
export function DofStyleOverlay({fx}:{fx:any}){
  const rules:string[]=[];
  if(fx.bgLayerId){
    rules.push(`[data-edit-id="${escapeAttr(fx.bgLayerId)}"] { filter: blur(${fx.blur??3.5}px) brightness(${fx.dim??0.92}); will-change: transform; }`);
  }
  if(Array.isArray(fx.dimLayerIds)&&fx.dimLayerIds.length){
    const dimSels=fx.dimLayerIds.map((id:string)=>`[data-edit-id="${escapeAttr(id)}"]`).join(', ');
    const dBlur=fx.dimBlur??3.2,dBright=fx.dimBrightness??0.68,dSat=fx.dimSaturate??0.78,dOp=fx.dimOpacity??0.88;
    rules.push(`${dimSels} { filter: blur(${dBlur}px) brightness(${dBright}) saturate(${dSat}); opacity: ${dOp}; will-change: transform; }`);
  }
  if(fx.shadow!==false&&Array.isArray(fx.actorLayerIds)&&fx.actorLayerIds.length){
    const sels=fx.actorLayerIds.map((id:string)=>`[data-edit-id="${escapeAttr(id)}"]`).join(', ');
    rules.push(`${sels} { filter: drop-shadow(8px 12px 10px rgba(10,16,28,0.32)); will-change: transform; }`);
  }
  if(!rules.length)return null;
  return <style>{rules.join('\n')}</style>;
}

/** Ominous blackened character silhouette with optional crimson rim glow (e.g. blacklist / flashback antagonists). */
export function SilhouetteStyleOverlay({fx}:{fx:any}){
  if(!fx.layerId)return null;
  const glow=fx.style==='crimson'?'drop-shadow(0 0 12px rgba(220,38,38,0.88))':'drop-shadow(0 0 8px rgba(0,0,0,0.85))';
  return <style>{`[data-edit-id="${escapeAttr(fx.layerId)}"] { filter: brightness(0) ${glow} !important; will-change: transform; }`}</style>;
}

/** 1–6 frame high-contrast black/white/invert anime punch freeze overlay. */
export function ImpactFrameOverlay({fx,frame}:{fx:any;frame:number}){
  const styleKey=fx.style??'invert';
  const filter=(IMPACT_FRAME_STYLES as any)[styleKey]??IMPACT_FRAME_STYLES.invert;
  const local=frame-fx.from;
  const rays=local===0?Array.from({length:16},(_,i)=>{
    const a=(i/16)*Math.PI*2;
    return {x1:960+Math.cos(a)*460,y1:540+Math.sin(a)*320,x2:960+Math.cos(a)*1180,y2:540+Math.sin(a)*860};
  }):[];
  return <div style={{
    position:'absolute',inset:0,zIndex:fx.z??8960,pointerEvents:'none',
    backdropFilter:filter,
    WebkitBackdropFilter:filter,
  }}>
    {styleKey==='crimson'&&<div style={{position:'absolute',inset:0,backgroundColor:'rgba(220,38,38,0.36)',mixBlendMode:'multiply'}}/>}
    {rays.length>0&&<svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position:'absolute',inset:0}}>
      {rays.map((r,i)=><line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke="#ffffff" strokeWidth={i%2===0?10:5} opacity={0.88}/>)}
    </svg>}
  </div>;
}

/**
 * 2D scene lighting system adapted from wormsun/FunnyAnimationAssitant (Apache-2.0):
 * sunset, night, alarm, spotlight (volumetric cone + bright focus), point light.
 */
export function LightingOverlay({fx,frame}:{fx:any;frame:number}){
  const presetName=fx.preset??'sunset';
  const p=(LIGHTING_PRESETS as any)[presetName]??LIGHTING_PRESETS.sunset;
  const local=Math.max(0,frame-fx.from);
  const dur=Math.max(1,fx.to-fx.from);
  const fade=Math.min(5,dur/4);
  const env=interpolate(frame,[fx.from,fx.from+fade,fx.to-fade,fx.to],[0,1,1,0],CLAMP)*(fx.intensity??1);
  const z=fx.z??8250;

  if(presetName==='spotlight'){
    const cx=fx.x??960,cy=fx.y??540,r=fx.radius??460,darkness=fx.darkness??0.68;
    const coneTopL=cx-130,coneTopR=cx+130,coneBotL=cx-r*0.76,coneBotR=cx+r*0.76;
    const coneId=`spot-cone-${fx.id}`;
    return <div style={{position:'absolute',inset:0,zIndex:z,pointerEvents:'none',opacity:env}}>
      <div style={{
        position:'absolute',inset:0,
        background:`radial-gradient(ellipse ${r}px ${Math.round(r*1.2)}px at ${cx}px ${cy}px, rgba(255,250,235,0.04) 0%, rgba(15,23,42,0.22) 55%, rgba(2,6,23,${darkness}) 94%)`,
      }}/>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,mixBlendMode:'screen'}}>
        <defs>
          <linearGradient id={coneId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={fx.color??'rgba(254,243,199,0.28)'}/>
            <stop offset="75%" stopColor="rgba(254,243,199,0.08)"/>
            <stop offset="100%" stopColor="rgba(254,243,199,0)"/>
          </linearGradient>
        </defs>
        <polygon points={`${coneTopL},0 ${coneTopR},0 ${coneBotR},1080 ${coneBotL},1080`} fill={`url(#${coneId})`}/>
      </svg>
    </div>;
  }

  if(presetName==='point'){
    const cx=fx.x??960,cy=fx.y??440,r=fx.radius??380,darkness=fx.darkness??0.54;
    const flicker=1+steppedJitter(3101,frame,3)*0.06;
    const color=fx.color??'rgba(253,224,71,0.45)';
    return <div style={{position:'absolute',inset:0,zIndex:z,pointerEvents:'none',opacity:env}}>
      <div style={{
        position:'absolute',inset:0,
        background:`radial-gradient(circle ${Math.round(r*1.5*flicker)}px at ${cx}px ${cy}px, transparent 15%, rgba(2,6,23,${darkness}) 85%)`,
      }}/>
      <div style={{
        position:'absolute',inset:0,mixBlendMode:'screen',
        background:`radial-gradient(circle ${Math.round(r*flicker)}px at ${cx}px ${cy}px, ${color} 0%, transparent 72%)`,
      }}/>
    </div>;
  }

  const pulse=presetName==='alarm'?(0.45+0.55*(0.5+0.5*Math.sin(local*0.28))):1;
  return <div style={{position:'absolute',inset:0,zIndex:z,pointerEvents:'none',opacity:env*pulse}}>
    <div style={{position:'absolute',inset:0,backgroundColor:p.wash,mixBlendMode:'multiply'}}/>
    <div style={{
      position:'absolute',inset:0,mixBlendMode:'screen',
      background:presetName==='sunset'
        ?`radial-gradient(ellipse at 18% 12%, ${p.topGlow}, transparent 68%)`
        :presetName==='night'
          ?`radial-gradient(ellipse at 50% 8%, ${p.topGlow}, transparent 64%)`
          :`radial-gradient(ellipse at 50% 50%, transparent 35%, ${p.topGlow} 100%)`,
    }}/>
    <div style={{
      position:'absolute',inset:0,
      background:`radial-gradient(ellipse at center, transparent 52%, ${p.vignette} 100%)`,
    }}/>
  </div>;
}

/**
 * Diagonal manga split-panel confrontation frame + faction tint contrast.
 * Adapted from wormsun/FunnyAnimationAssitant clip-mask concepts without breaking Editable actor geometry.
 */
export function SplitPanelOverlay({fx,frame}:{fx:any;frame:number}){
  const slant=fx.slant??9;
  const topPct=50+slant,botPct=50-slant;
  const xTop=Math.round(1920*(topPct/100)),xBot=Math.round(1920*(botPct/100));
  const gutter=fx.gutter??14;
  const borderColor=fx.borderColor??'#0f172a';
  const accentColor=fx.accentColor??'#e2e8f0';
  const local=Math.max(0,frame-fx.from);
  const sweep=Math.min(1,(local+1)/6);
  const len=Math.hypot(xTop-xBot,1080);

  return <>
    <div style={{position:'absolute',inset:0,zIndex:85,pointerEvents:'none'}}>
      <div style={{position:'absolute',inset:0,clipPath:`polygon(0% 0%, ${topPct}% 0%, ${botPct}% 100%, 0% 100%)`,background:fx.leftTint??'rgba(14,165,233,0.22)'}}/>
      <div style={{position:'absolute',inset:0,clipPath:`polygon(${topPct}% 0%, 100% 0%, 100% 100%, ${botPct}% 100%)`,background:fx.rightTint??'rgba(220,38,38,0.22)'}}/>
    </div>
    <div style={{position:'absolute',inset:0,zIndex:fx.z??8850,pointerEvents:'none'}}>
      <div style={{position:'absolute',inset:10,border:`8px solid ${borderColor}`,boxSizing:'border-box'}}/>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position:'absolute',inset:0}}>
        <line x1={xTop} y1={0} x2={xBot} y2={1080} stroke={borderColor} strokeWidth={gutter} strokeDasharray={len} strokeDashoffset={len*(1-sweep)}/>
        <line x1={xTop} y1={0} x2={xBot} y2={1080} stroke={accentColor} strokeWidth={3} strokeDasharray={len} strokeDashoffset={len*(1-sweep)} opacity={0.9}/>
      </svg>
    </div>
  </>;
}

/** Hand-drawn anime reaction emote (`shock` | `question` | `anger` | `sweat` | `spark` | `silence`) beside speaker head. */
export function EmoteOverlay({fx,frame,doc}:{fx:any;frame:number;doc:any}){
  const {fps}=useVideoConfig();
  const local=Math.max(0,frame-fx.from);
  const dur=Math.max(1,fx.to-fx.from);
  const pop=spring({frame:local,fps,durationInFrames:12,config:{damping:9,stiffness:260,mass:0.55}});
  const fadeOut=dur-local<=4?Math.max(0,(dur-local)/4):1;
  let dx=0,dy=0;
  const layer=fx.layerId?doc?.layers?.[fx.layerId]:null;
  if(layer){
    const v=valueAt(layer,frame);
    dx=(v.x??0)-(layer.base?.x??0);
    dy=(v.y??0)-(layer.base?.y??0);
  }
  const hRef=fx.height??750;
  const sideDist=Math.max(115,Math.round(hRef*0.18));
  const baseX=(fx.x??960)+dx;
  const headY=Math.max(76,Math.round((fx.y??960)+dy-hRef*0.90));
  const autoRight=fx.side==='right'?true:fx.side==='left'?false:baseX<1500;
  const ex=Math.round(Math.max(68,Math.min(1852,baseX+(autoRight?sideDist:-sideDist))));
  const preset=fx.preset??'shock';
  const tilt=autoRight?8:-8;
  const pulse=1+Math.sin(local*0.35)*0.06;

  return <div style={{
    position:'absolute',left:ex-38,top:headY-38,width:76,height:76,zIndex:fx.z??9100,
    pointerEvents:'none',opacity:fadeOut,
    transform:`scale(${pop*pulse}) rotate(${preset==='anger'||preset==='sweat'?0:tilt}deg)`,
    transformOrigin:'50% 80%',
    filter:'drop-shadow(2px 3px 0 rgba(15,23,42,0.85))',
  }}>
    <svg width={76} height={76} viewBox="0 0 76 76" style={{overflow:'visible'}}>
      {preset==='shock'&&(
        <g>
          <path d="M 32 10 L 44 10 L 41 44 L 35 44 Z" fill="#facc15" stroke="#18181b" strokeWidth={4} strokeLinejoin="round"/>
          <circle cx="38" cy="57" r="6" fill="#ef4444" stroke="#18181b" strokeWidth={4}/>
          <line x1="16" y1="18" x2="23" y2="23" stroke="#ef4444" strokeWidth={4} strokeLinecap="round"/>
          <line x1="60" y1="18" x2="53" y2="23" stroke="#ef4444" strokeWidth={4} strokeLinecap="round"/>
        </g>
      )}
      {preset==='question'&&(
        <g>
          <path d="M 25 24 C 25 11, 51 11, 51 24 C 51 33, 38 34, 38 44" fill="none" stroke="#18181b" strokeWidth={11} strokeLinecap="round"/>
          <path d="M 25 24 C 25 11, 51 11, 51 24 C 51 33, 38 34, 38 44" fill="none" stroke="#38bdf8" strokeWidth={5.5} strokeLinecap="round"/>
          <circle cx="38" cy="58" r="5.5" fill="#38bdf8" stroke="#18181b" strokeWidth={3.8}/>
        </g>
      )}
      {preset==='anger'&&(
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 20 30 Q 32 30 32 18 M 56 30 Q 44 30 44 18 M 20 46 Q 32 46 32 58 M 56 46 Q 44 46 44 58" stroke="#18181b" strokeWidth={9.5}/>
          <path d="M 20 30 Q 32 30 32 18 M 56 30 Q 44 30 44 18 M 20 46 Q 32 46 32 58 M 56 46 Q 44 46 44 58" stroke="#ef4444" strokeWidth={4.8}/>
        </g>
      )}
      {preset==='sweat'&&(
        <g style={{transform:`translateY(${Math.min(12,local*0.35)}px)`}}>
          <path d="M 38 10 C 38 10, 56 34, 56 47 C 56 58, 48 65, 38 65 C 28 65, 20 58, 20 47 C 20 34, 38 10, 38 10 Z" fill="#7dd3fc" stroke="#18181b" strokeWidth={4.2} strokeLinejoin="round"/>
          <ellipse cx="32" cy="46" rx="3.5" ry="7" fill="#ffffff" opacity={0.88} transform="rotate(-14 32 46)"/>
        </g>
      )}
      {preset==='spark'&&(
        <g>
          <path d="M 38 8 L 44 30 L 66 36 L 44 42 L 38 64 L 32 42 L 10 36 L 32 30 Z" fill="#fde047" stroke="#18181b" strokeWidth={4} strokeLinejoin="round"/>
          <path d="M 59 10 L 61 17 L 68 19 L 61 21 L 59 28 L 57 21 L 50 19 L 57 17 Z" fill="#ffffff" stroke="#18181b" strokeWidth={2.5} strokeLinejoin="round"/>
        </g>
      )}
      {preset==='silence'&&(
        <g>
          <rect x="8" y="20" width="60" height="34" rx="16" fill="#fffdf5" stroke="#18181b" strokeWidth={4}/>
          {[0,1,2].map(di=><circle key={di} cx={24+di*14} cy={37} r={3.8} fill="#18181b" opacity={(Math.floor(local/6)%3)>=di?1:0.25}/>)}
        </g>
      )}
    </svg>
  </div>;
}

/** Deterministic jagged starburst polygon points for manga SHOUT bubble borders. */
function shoutBubblePoints(w:number,h:number,seed=7){
  const pts:string[]=[];
  const xStep=72,yStep=44;
  const push=(x:number,y:number)=>pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  const amp=(i:number)=>10+Math.round(hash01(seed*31+i)*9);
  let idx=0;
  for(let x=14;x<w-14;x+=xStep){
    push(x,-4);
    push(Math.min(w-10,x+xStep*0.5),-amp(idx++));
  }
  push(w+4,10);
  for(let y=22;y<h-16;y+=yStep){
    push(w+amp(idx++),y);
    push(w+2,Math.min(h-8,y+yStep*0.5));
  }
  push(w-8,h+4);
  for(let x=w-24;x>16;x-=xStep){
    push(x,h+amp(idx++));
    push(Math.max(10,x-xStep*0.5),h+2);
  }
  push(-4,h-10);
  for(let y=h-24;y>16;y-=yStep){
    push(-amp(idx++),y);
    push(-2,Math.max(10,y-yStep*0.5));
  }
  return pts.join(' ');
}

/** Smooth scalloped anime thought-cloud SVG path around `(0..w, 0..h)`. */
function thoughtCloudPath(w:number,h:number){
  const rx=Math.round(w),ry=Math.round(h);
  const topSteps=Math.max(4,Math.round(rx/78)),sideSteps=Math.max(2,Math.round(ry/56));
  let d=`M 18 ${Math.round(ry*0.35)}`;
  const dx=rx/topSteps;
  for(let i=0;i<topSteps;i++){
    const x1=i*dx+dx*0.5,x2=Math.min(rx-12,(i+1)*dx);
    d+=` Q ${x1.toFixed(1)} -16, ${x2.toFixed(1)} 8`;
  }
  const dy=ry/sideSteps;
  for(let i=0;i<sideSteps;i++){
    const y1=i*dy+dy*0.5,y2=Math.min(ry-8,(i+1)*dy);
    d+=` Q ${(rx+18).toFixed(1)} ${y1.toFixed(1)}, ${(rx-6).toFixed(1)} ${y2.toFixed(1)}`;
  }
  for(let i=topSteps-1;i>=0;i--){
    const x1=i*dx+dx*0.5,x2=Math.max(12,i*dx);
    d+=` Q ${x1.toFixed(1)} ${(ry+16).toFixed(1)}, ${x2.toFixed(1)} ${(ry-8).toFixed(1)}`;
  }
  for(let i=sideSteps-1;i>=0;i--){
    const y1=i*dy+dy*0.5,y2=Math.max(12,i*dy);
    d+=` Q -18 ${y1.toFixed(1)}, 10 ${y2.toFixed(1)}`;
  }
  return d+' Z';
}

/** Hand-drawn / HUD panel body rendered inside CreatedScene's EditDiv('story-panel'). */
export function ComicPanelBox({panel,frame}:{panel:any;frame:number}){
  const {fps}=useVideoConfig();
  const local=Math.max(0,frame-panel.from);
  const dur=Math.max(1,panel.to-panel.from);
  const pop=spring({frame:local,fps,durationInFrames:10,config:{damping:11,stiffness:300,mass:0.75}});
  const fadeOut=dur-local<=4?Math.max(0,(dur-local)/4):1;
  const style=panel.style??'system';

  if(style==='comic'||style==='speech'){
    const boxW=panel.width??880;
    const variant=panel.variant??'normal';
    const isShout=style==='speech'&&variant==='shout';
    const isThought=style==='speech'&&variant==='thought';
    const hPad=isThought?72:isShout?64:52;
    const titleH=panel.title&&style!=='speech'?52:0;
    const estH=Math.max(96,titleH+(isThought?48:44)+Math.max(1,Math.ceil((panel.text?.length??12)/Math.max(16,(boxW-hPad)/18.5)))*48);
    const [p1,p2]=sketchyRectPaths(boxW,estH,5,panel.seed??11);

    // Compute speaker-anchored tail geometry relative to the bubble box (kept compact outside faces)
    let edge:'bottom'|'left'|'right'='bottom';
    let tailAnchor=panel.side==='left'?boxW-56:56;
    let dx=panel.side==='left'?28:-28;
    let dy=32;
    if(typeof panel.left==='number'&&typeof panel.top==='number'&&typeof panel.tailTipX==='number'&&typeof panel.tailTipY==='number'){
      if(panel.tailTipX>panel.left+boxW+18){
        edge='right';
        dx=Math.min(46,Math.max(22,panel.tailTipX-(panel.left+boxW)));
        dy=Math.min(30,Math.max(-18,(panel.tailTipY-(panel.top+estH*0.66))*0.45));
      }else if(panel.tailTipX<panel.left-18){
        edge='left';
        dx=-Math.min(46,Math.max(22,panel.left-panel.tailTipX));
        dy=Math.min(30,Math.max(-18,(panel.tailTipY-(panel.top+estH*0.66))*0.45));
      }else{
        edge='bottom';
        tailAnchor=Math.max(46,Math.min(boxW-46,panel.tailTipX-panel.left));
        dx=Math.max(-40,Math.min(40,(panel.tailTipX-(panel.left+tailAnchor))*0.6));
        dy=Math.min(38,Math.max(20,panel.tailTipY-(panel.top+estH)));
      }
    }

    const renderTail=()=>{
      if(style!=='speech'||panel.noTail===true)return null;
      if(variant==='thought'){
        const sx=edge==='right'?boxW+6:edge==='left'?-6:tailAnchor;
        const sy=edge==='bottom'?estH+4:estH*0.68;
        return <svg width={1} height={1} style={{position:'absolute',left:0,top:0,overflow:'visible',pointerEvents:'none'}}>
          {[0.25,0.58,0.88].map((t,i)=>{
            const r=i===0?11:i===1?7.5:5;
            return <circle key={i} cx={sx+dx*t} cy={sy+dy*t} r={r} fill="#f8fafc" stroke="#17242b" strokeWidth={3.5}/>;
          })}
        </svg>;
      }
      if(edge==='right'){
        const y0=Math.round(estH*0.54),y1=Math.min(estH-14,y0+24);
        return <svg width={1} height={1} style={{position:'absolute',left:boxW-4,top:0,overflow:'visible',pointerEvents:'none'}}>
          <path d={`M 0 ${y0} L ${dx} ${(y0+y1)/2+dy} L 0 ${y1} Z`} fill={variant==='shout'?'#fffbeb':'#fffdf7'} stroke="#17242b" strokeWidth={4.5} strokeLinejoin="round"/>
          <line x1={0} y1={y0+2} x2={0} y2={y1-2} stroke={variant==='shout'?'#fffbeb':'#fffdf7'} strokeWidth={6}/>
        </svg>;
      }
      if(edge==='left'){
        const y0=Math.round(estH*0.54),y1=Math.min(estH-14,y0+24);
        return <svg width={1} height={1} style={{position:'absolute',left:4,top:0,overflow:'visible',pointerEvents:'none'}}>
          <path d={`M 0 ${y0} L ${dx} ${(y0+y1)/2+dy} L 0 ${y1} Z`} fill={variant==='shout'?'#fffbeb':'#fffdf7'} stroke="#17242b" strokeWidth={4.5} strokeLinejoin="round"/>
          <line x1={0} y1={y0+2} x2={0} y2={y1-2} stroke={variant==='shout'?'#fffbeb':'#fffdf7'} strokeWidth={6}/>
        </svg>;
      }
      return <svg width={1} height={1} style={{position:'absolute',left:tailAnchor,top:'100%',overflow:'visible',pointerEvents:'none'}}>
        <path d={`M -12 -3 L ${dx} ${dy} L 14 -3 Z`} fill={variant==='shout'?'#fffbeb':'#fffdf7'} stroke="#17242b" strokeWidth={4.5} strokeLinejoin="round"/>
        <line x1={-10} y1={-3} x2={12} y2={-3} stroke={variant==='shout'?'#fffbeb':'#fffdf7'} strokeWidth={7}/>
      </svg>;
    };

    const bg=isThought||isShout?'transparent':'rgba(255,253,245,0.97)';
    const boxShadow=isThought||isShout?'none':style==='speech'?`7px 8px 0 ${panel.speakerColor??'rgba(23,36,43,0.88)'}`:'10px 12px 0 rgba(23,36,43,0.90)';
    const filterCss=isShout?`drop-shadow(7px 8px 0 ${panel.speakerColor??'rgba(220,38,38,0.82)'})`:isThought?'drop-shadow(5px 6px 0 rgba(23,36,43,0.72))':undefined;

    return <div style={{
      position:'relative',
      padding:isThought?'24px 36px':isShout?'22px 32px':style==='speech'?'18px 26px':'28px 36px',
      background:bg,
      color:'#17242b',
      fontSize:style==='speech'?34:38,
      fontWeight:isShout?800:style==='speech'?700:500,
      lineHeight:1.38,
      whiteSpace:'pre-wrap',
      textAlign:'left',
      opacity:fadeOut,
      transform:`scale(${0.90+0.10*pop})`,
      transformOrigin:'50% 60%',
      boxShadow,
      filter:filterCss,
      borderRadius:isThought?34:style==='speech'?14:6,
    }}>
      {isShout?(
        <svg width={boxW} height={estH} viewBox={`0 0 ${boxW} ${estH}`} preserveAspectRatio="none" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',overflow:'visible'}}>
          <polygon points={shoutBubblePoints(boxW,estH,panel.seed??11)} fill="#fffbeb" stroke="#18181b" strokeWidth={5.5} strokeLinejoin="round"/>
        </svg>
      ):isThought?(
        <svg width={boxW} height={estH} viewBox={`0 0 ${boxW} ${estH}`} preserveAspectRatio="none" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',overflow:'visible'}}>
          <path d={thoughtCloudPath(boxW,estH)} fill="#f8fafc" stroke="#17242b" strokeWidth={4.8} strokeLinejoin="round"/>
        </svg>
      ):(
        <svg width={boxW} height={estH} viewBox={`0 0 ${boxW} ${estH}`} preserveAspectRatio="none" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',overflow:'visible'}}>
          <path d={p1} fill="none" stroke="#17242b" strokeWidth={5.5} strokeLinejoin="round"/>
          <path d={p2} fill="none" stroke="#17242b" strokeWidth={2.5} strokeLinejoin="round" opacity={0.78}/>
        </svg>
      )}
      {renderTail()}
      {panel.title&&style!=='speech'&&(
        <div style={{position:'relative',zIndex:1,fontSize:40,fontWeight:900,color:'#0f172a',marginBottom:12,borderBottom:'2.5px solid #17242b',paddingBottom:8}}>{panel.title}</div>
      )}
      <div style={{position:'relative',zIndex:1}}>{panel.text}</div>
    </div>;
  }

  // Holographic HUD 'system' panel with minimalist cyan brackets + subtle scanlines + spring
  const corner=(pos:React.CSSProperties,bw:string)=> <span style={{position:'absolute',width:20,height:20,borderColor:'#67e8f9',borderStyle:'solid',borderWidth:bw,pointerEvents:'none',...pos}}/>;
  return <div style={{
    position:'relative',padding:'28px 34px',border:'2px solid rgba(103,232,249,0.58)',borderRadius:14,
    backgroundColor:'rgba(4,20,36,0.93)',
    backgroundImage:'repeating-linear-gradient(0deg, rgba(103,232,249,0.04) 0px, rgba(103,232,249,0.04) 2px, transparent 2px, transparent 6px), linear-gradient(180deg, rgba(6,34,58,0.65), rgba(2,12,24,0.85))',
    color:'#e5fbff',fontSize:38,lineHeight:1.45,whiteSpace:'pre-wrap',textAlign:'left',
    opacity:fadeOut,transform:`scale(${0.92+0.08*pop})`,transformOrigin:'50% 50%',
    boxShadow:'0 0 28px rgba(34,211,238,0.22), 0 14px 34px rgba(0,0,0,0.52)',
  }}>
    {corner({top:-2,left:-2},'4px 0 0 4px')}
    {corner({top:-2,right:-2},'4px 4px 0 0')}
    {corner({bottom:-2,left:-2},'0 0 4px 4px')}
    {corner({bottom:-2,right:-2},'0 4px 4px 0')}
    {panel.title&&<div style={{fontSize:40,fontWeight:800,color:'#8ff5ff',marginBottom:14,borderBottom:'1px solid rgba(134,222,236,.38)',paddingBottom:10,letterSpacing:'0.02em'}}>{panel.title}</div>}
    <div style={{position:'relative',zIndex:1}}>{panel.text}</div>
  </div>;
}

export function ComicFxOverlays({effects,frame,doc}:{effects:any[];frame:number;doc:any}){
  return <>
    {effects.map((fx:any)=>
      fx.kind==='dof'?<DofStyleOverlay key={fx.id} fx={fx}/>:
      fx.kind==='silhouette'?<SilhouetteStyleOverlay key={fx.id} fx={fx}/>:
      fx.kind==='aura'?<AuraOverlay key={fx.id} fx={fx} frame={frame} doc={doc}/>:
      fx.kind==='portalGlow'?<PortalGlowOverlay key={fx.id} fx={fx} frame={frame}/>:
      fx.kind==='halftone'?<HalftoneOverlay key={fx.id} fx={fx} frame={frame}/>:
      fx.kind==='mood'?<MoodOverlay key={fx.id} fx={fx} frame={frame}/>:
      fx.kind==='lighting'?<LightingOverlay key={fx.id} fx={fx} frame={frame}/>:
      fx.kind==='particles'?<ParticlesOverlay key={fx.id} fx={fx} frame={frame}/>:
      fx.kind==='filmBurn'?<FilmBurnOverlay key={fx.id} fx={fx} frame={frame}/>:
      fx.kind==='lines'?<LinesOverlay key={fx.id} fx={fx} frame={frame}/>:
      fx.kind==='lightning'?<LightningOverlay key={fx.id} fx={fx} frame={frame}/>:
      fx.kind==='impact'?<ImpactOverlay key={fx.id} fx={fx} frame={frame}/>:
      fx.kind==='letterbox'?<LetterboxOverlay key={fx.id} fx={fx} frame={frame}/>:
      fx.kind==='splitPanel'?<SplitPanelOverlay key={fx.id} fx={fx} frame={frame}/>:
      fx.kind==='cutTransition'?<CutTransitionOverlay key={fx.id} fx={fx} frame={frame}/>:
      fx.kind==='impactFrame'?<ImpactFrameOverlay key={fx.id} fx={fx} frame={frame}/>:
      fx.kind==='emote'?<EmoteOverlay key={fx.id} fx={fx} frame={frame} doc={doc}/>:
      fx.kind==='sfxText'?<SfxTextOverlay key={fx.id} fx={fx} frame={frame}/>:
      fx.kind==='flash'?<FlashOverlay key={fx.id} fx={fx} frame={frame}/>:
      null
    )}
  </>;
}
