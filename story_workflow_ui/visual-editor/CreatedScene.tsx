import React,{useContext} from 'react';
import {Audio,Img,Sequence,staticFile,useCurrentFrame} from 'remotion';
import {SceneScope,EditDiv,EditorContext} from './Editable';
import {ComicFxOverlays,ComicPanelBox} from './ComicFxOverlays';
import {valueAt} from './model.mjs';
import {parallaxMatrix} from './parallax.mjs';
import {multiply,hierarchy,worldMatrix} from './scene-graph.mjs';
import {computeDuckedVolume,activeCaptionWordIndex,splitSubtitleSegments,weightedChunkAt,TRAIL_COLORS} from './fx-presets.mjs';

export const createdScenes:Record<string,any>={};

/** Ghost afterimage trail rendered inside CreatedScene so ownedDocumentMedia covers its <Img src={staticFile(...)/>. */
function ActorTrailOverlay({fx,frame,doc}:{fx:any;frame:number;doc:any}){
  const layer=fx.layerId?doc?.layers?.[fx.layerId]:null;
  const a=layer?.asset;
  if(!layer||!a?.parts?.length)return null;
  const copies=Math.max(1,Math.min(5,fx.copies??3));
  const step=Math.max(1,Math.min(6,fx.step??2));
  const tint=(TRAIL_COLORS as any)[fx.color]??fx.color??TRAIL_COLORS.cyan;
  const vNow=valueAt(layer,frame);
  const useCamera=Boolean(layer.parentId||hierarchy(doc.layers,fx.layerId).some((id:string)=>doc.layers[id]?.camera?.enabled));
  const ghosts:React.ReactNode[]=[];
  for(let k=1;k<=copies;k++){
    const ghostFrame=Math.max(fx.from,frame-k*step);
    if(ghostFrame===frame)continue;
    const vGhost=valueAt(layer,ghostFrame);
    const dist=Math.hypot((vNow.x??0)-(vGhost.x??0),(vNow.y??0)-(vGhost.y??0));
    if(dist<=4)continue;
    const op=Math.max(0.08,(0.46-k*0.11)*(vGhost.opacity??1));
    const filter=`drop-shadow(0 0 10px ${tint}) brightness(1.08) saturate(1.45)`;
    const zIndex=Math.max(1,(fx.z??96)-k);
    const baseStyle:React.CSSProperties=useCamera
      ?{position:'absolute',left:0,top:0,width:a.width,height:a.height,transformOrigin:'0 0',transform:`matrix(${multiply(parallaxMatrix(doc.layers,fx.layerId,frame),worldMatrix(doc.layers,fx.layerId,ghostFrame)).join(',')})`,opacity:op,filter,zIndex,pointerEvents:'none'}
      :{position:'absolute',left:a.left,top:a.top,width:a.width,height:a.height,transformOrigin:'50% 50%',translate:`${vGhost.x}px ${vGhost.y}px`,scale:`${vGhost.scale*(vGhost.flipX?-1:1)} ${vGhost.scale*(vGhost.flipY?-1:1)}`,rotate:`${vGhost.rotation}deg`,opacity:op,filter,zIndex,pointerEvents:'none'};
    ghosts.push(<div key={k} style={baseStyle}>{a.parts.map((p:any,pi:number)=><Img key={pi} src={staticFile(p.src)} style={{position:'absolute',left:p.left,top:p.top,width:p.width,height:p.height,pointerEvents:'none'}}/>)}</div>);
  }
  return <>{ghosts}</>;
}

export function CreatedScene({scene}:{scene:string}){
  const source=createdScenes[scene],frame=useCurrentFrame();
  const editor=useContext(EditorContext);
  const doc=editor?.scene===scene?editor.document:null;
  if(!source)return null;
  const cue=(source.subtitleCues??source.cues).find((c:any)=>frame>=c.from&&frame<c.to);
  const task=source.scriptPlan?.tasks.find((t:any)=>frame>=t.from&&frame<t.to);
  const panel=source.panels?.find((p:any)=>frame>=p.from&&frame<p.to);
  const rawFx=(source.effects??[]).filter((fx:any)=>frame>=fx.from&&frame<fx.to);
  const userDimIds:string[]=[];
  const userSharpIds:string[]=[];
  if(doc?.layers){
    for(const [lid,l] of Object.entries<any>(doc.layers)){
      const a=l?.asset;
      if(!a||a.type==='backgrounds'||frame<a.from||frame>=a.to)continue;
      if(l.dimmed===true)userDimIds.push(lid);
      else if(l.dimmed===false)userSharpIds.push(lid);
    }
  }
  let activeFx=rawFx;
  if(userDimIds.length||userSharpIds.length){
    const sharpSet=new Set(userSharpIds);
    const dimSet=new Set(userDimIds);
    let mergedIntoDof=false;
    activeFx=rawFx.map((fx:any)=>{
      if(fx.kind!=='dof')return fx;
      mergedIntoDof=true;
      const baseDims=(fx.dimLayerIds??[]).filter((id:string)=>!sharpSet.has(id));
      const baseActors=(fx.actorLayerIds??[]).filter((id:string)=>!dimSet.has(id));
      return {
        ...fx,
        dimLayerIds:[...new Set([...baseDims,...userDimIds])],
        actorLayerIds:[...new Set([...baseActors,...userSharpIds])],
      };
    });
    if(!mergedIntoDof&&userDimIds.length){
      activeFx=[
        ...activeFx,
        {id:'user-focus-dof',kind:'dof',dimLayerIds:userDimIds,actorLayerIds:userSharpIds,shadow:true,from:0,to:source.duration,z:8000},
      ];
    }
  }
  const trailFx=activeFx.filter((fx:any)=>fx.kind==='trail');
  const subSegments=splitSubtitleSegments(cue?.text??'',72);
  const chunks=subSegments.map((s)=>s.text);
  const cueDur=Math.max(1,(cue?.to??1)-(cue?.from??0));
  const cueProgress=Math.max(0,Math.min(0.999999,(frame-(cue?.from??0))/cueDur));
  const {index:rawIdx,localProgress:chunkProgress}=weightedChunkAt(chunks,cueProgress);
  const caption=rawIdx>=0?chunks[rawIdx]??'':'';
  const captionStyle=source.captionStyle??'classic';
  const activeWord=captionStyle==='classic'?-1:activeCaptionWordIndex(caption,chunkProgress);
  const hl=cue?.highlightColor??'#fde047';
  const panelLeft=panel?.left??(panel?.side==='left'?90:panel?.side==='center'?540:920);
  const panelTop=panel?.top??170;
  const panelWidth=panel?.width??880;
  return <SceneScope scene={scene} shots={source.shots}>
    {source.cues.map((c:any)=><Sequence key={c.cueId} from={c.from} durationInFrames={c.to-c.from} layout="none"><Audio src={staticFile(c.publicPath.split('?')[0].replace(/^\//,''))}/></Sequence>)}
    {(source.audioTracks??[]).map((t:any)=>{
      const from=t.from??0,dur=Math.max(1,(t.to??source.duration)-from);
      const src=staticFile(t.publicPath.split('?')[0].replace(/^\//,''));
      return <Sequence key={t.id} from={from} durationInFrames={dur} layout="none">
        {t.role==='bgm'
          ?<Audio src={src} loop loopVolumeCurveBehavior="extend" volume={(f:number)=>computeDuckedVolume(from+f,{baseVolume:t.volume,duckVolume:t.duckVolume,cues:source.cues,from,to:t.to??source.duration,fadeIn:t.fadeIn,fadeOut:t.fadeOut})}/>
          :<Audio src={src} volume={t.volume??0.85}/>}
      </Sequence>;
    })}
    {trailFx.map((fx:any)=><ActorTrailOverlay key={fx.id} fx={fx} frame={frame} doc={doc}/>)}
    <ComicFxOverlays effects={activeFx} frame={frame} doc={doc}/>
    {panel&&<EditDiv key={panel.id??'story-panel'} editorId={panel.id??'story-panel'} editorLabel={panel.title??(panel.style==='speech'?'Bong bóng thoại':'Bảng thông tin')} style={{position:'absolute',left:panelLeft,top:panelTop,width:panelWidth,zIndex:9000}}><ComicPanelBox panel={panel} frame={frame}/></EditDiv>}
    {!panel&&task?.screenText&&<EditDiv editorId="story-panel" editorLabel="Thông tin truyện" style={{position:'absolute',left:850,top:180,width:840,padding:36,border:'3px solid #86deec',borderRadius:20,background:'rgba(5,25,38,.92)',color:'#e5fbff',fontSize:42,lineHeight:1.45,whiteSpace:'pre-wrap',textAlign:'center',zIndex:9000}}>{task.screenText}</EditDiv>}
    {cue&&caption.trim()&&<EditDiv editorId="subtitle" editorLabel="Phụ đề" style={{
      position:'absolute',bottom:42,left:100,right:100,textAlign:'center',fontWeight:700,fontSize:42,color:'white',
      background:captionStyle==='comic'?'rgba(15,23,42,0.86)':'rgba(0,0,0,.56)',
      borderRadius:captionStyle==='comic'?14:10,
      ...(captionStyle==='comic'?{border:'3px solid #0f172a',boxShadow:'4px 5px 0 rgba(15,23,42,0.85)'}:{}),
      textShadow:'0 2px 5px #000, 0 0 10px #000',zIndex:10000,padding:'10px 18px',whiteSpace:'pre-wrap',
    }}>{captionStyle==='classic'?caption:caption.split(' ').map((w:string,wi:number)=><React.Fragment key={wi}>{wi>0?' ':null}<span style={wi===activeWord?{color:hl,fontWeight:900,textShadow:`0 0 12px ${hl}99, 0 2px 5px #000`}:wi<activeWord?{color:'#ffffff'}:{color:'#cbd5e1'}}>{w}</span></React.Fragment>)}</EditDiv>}
  </SceneScope>;
}
