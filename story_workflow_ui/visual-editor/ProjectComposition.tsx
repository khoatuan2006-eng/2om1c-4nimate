import React from 'react';
import {AbsoluteFill,Sequence,useCurrentFrame} from 'remotion';
import {transitionOverlay} from './transitions.mjs';
import './composition.css';
import {EditorContext} from './Editable';
import {sceneMeta,withScene} from './scenes';
import {legacyComponents} from '@legacy-scenes';
import {CreatedScene,createdScenes} from './CreatedScene';
const components:Record<string,React.ComponentType<any>>=Object.fromEntries(
 Object.entries(legacyComponents).map(([id,Component])=>[id,withScene(id,Component)])
);
export function installCompositionProject(project:any){for(const entry of project.scenes){sceneMeta[entry.id]={duration:entry.duration,shots:entry.shots};if(entry.kind==='created')createdScenes[entry.id]=entry;}}
/** In/out transition drawn above everything (subtitles included) inside the scene's own frames; never changes timing. */
function TransitionOverlay({scene,document}:any){
 const frame=useCurrentFrame(),duration=sceneMeta[scene]?.duration,overlay=document?.transitions&&Number.isFinite(duration)?transitionOverlay(document.transitions,frame,duration):null;
 return overlay?<div data-transition="1" style={{position:'absolute',inset:0,zIndex:30000,pointerEvents:'none',background:overlay.color,opacity:overlay.opacity,clipPath:overlay.clipPath??undefined}}/>:null;
}
export function Composition({scene,document,register,unregister}:any){return <AbsoluteFill className="project-composition" style={{fontFamily:'system-ui, Arial',fontSize:13,color:'#eceef2',lineHeight:'normal'}}><EditorContext.Provider value={{scene,document,register,unregister}}>{components[scene as keyof typeof components]?React.createElement(components[scene as keyof typeof components]):<CreatedScene scene={scene}/>}<TransitionOverlay scene={scene} document={document}/></EditorContext.Provider></AbsoluteFill>;}
const noop=()=>{};
export function FilmComposition({project}:any){installCompositionProject(project);return <>{project.scenes.map((entry:any)=><Sequence key={entry.id} from={entry.from} durationInFrames={entry.duration}><Composition scene={entry.id} document={entry.document} register={noop} unregister={noop}/></Sequence>)}</>;}
