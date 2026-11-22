import {shiftAssembly,trimAssembly} from './assembly-timing.mjs';
import {layoutLocked} from './scene-graph.mjs';
import type React from 'react';
import type {PlayerRef} from '@remotion/player';
import type {EditDocument} from './Editable';
import type {EditSession} from './edit-session.mjs';
import {sceneMeta} from './scenes';
const copy=<T,>(value:T):T=>structuredClone(value);

function applySnap(targetFrame:number,snapPoints?:number[],threshold=5):number{
 if(!snapPoints?.length)return targetFrame;
 for(const p of snapPoints){
  if(Math.abs(p-targetFrame)<=threshold)return p;
 }
 return targetFrame;
}

export function useTimeline({sceneReadOnly,session,scene,docRef,setDoc,commit,zoomShot,shot,saving,player,snapPoints}:{sceneReadOnly:boolean;session:React.RefObject<EditSession>;scene:string;docRef:React.RefObject<EditDocument>;setDoc:React.Dispatch<React.SetStateAction<EditDocument>>;commit:(next:EditDocument,before?:EditDocument)=>void;zoomShot:boolean;shot:{from:number;to:number};saving:boolean;player:React.RefObject<PlayerRef|null>;snapPoints?:number[];}){
 const changeRange=(id:string,from:number,to:number,before=docRef.current,live=false)=>{if(sceneReadOnly||session.current.busy||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to>sceneMeta[scene].duration||from>=to)return;const next=trimAssembly(before,id,from,to);live?setDoc(next):commit(next,before)};
 const timeFrom=zoomShot?shot.from:0,timeTo=zoomShot?shot.to:sceneMeta[scene].duration;
 const dragRange=(e:React.PointerEvent,id:string,edge:string)=>{if(sceneReadOnly||session.current.busy||saving||layoutLocked(docRef.current.layers,id))return;e.stopPropagation();player.current?.pause();const node=e.currentTarget as HTMLElement,r=(edge==='move'?node.parentElement!:node.parentElement!.parentElement!).getBoundingClientRect(),before=copy(docRef.current),a=before.layers[id].asset,startX=e.clientX;node.setPointerCapture(e.pointerId);
 const move=(ev:PointerEvent)=>{
  if(edge==='move'){
   let requestedDelta=Math.round((ev.clientX-startX)/r.width*(timeTo-timeFrom));
   if(snapPoints?.length){
    const targetStart=a.from+requestedDelta,snappedStart=applySnap(targetStart,snapPoints,5);
    if(snappedStart!==targetStart){
     requestedDelta=snappedStart-a.from;
    }else{
     const targetEnd=a.to+requestedDelta,snappedEnd=applySnap(targetEnd,snapPoints,5);
     if(snappedEnd!==targetEnd)requestedDelta=snappedEnd-a.to;
    }
   }
   setDoc(shiftAssembly(before,id,requestedDelta,sceneMeta[scene].duration));
   return;
  }
  let f=Math.round(Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width))*(timeTo-timeFrom)+timeFrom);
  f=applySnap(f,snapPoints,5);
  changeRange(id,edge==='from'?Math.min(f,a.to-1):a.from,edge==='to'?Math.max(f,a.from+1):a.to,before,true);
 };
 const cleanup=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',cancel)};const end=()=>{commit(docRef.current,before);cleanup()};const cancel=()=>{setDoc(before);cleanup()};node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',cancel);
 };

 return {timeFrom,timeTo,dragRange};
}
