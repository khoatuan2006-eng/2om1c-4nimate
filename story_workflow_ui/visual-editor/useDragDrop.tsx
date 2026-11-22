import {parallaxMatrix} from './parallax.mjs';
import {multiply} from './scene-graph.mjs';
import {inheritedMatrix,layoutLocked} from './scene-graph.mjs';
import type React from 'react';
import type {PlayerRef} from '@remotion/player';
import type {EditDocument,LayerInfo} from './Editable';
import type {EditSession} from './edit-session.mjs';
import {valueAt,setValue} from './model.mjs';
import {sceneMeta} from './scenes';
const copy=<T,>(value:T):T=>structuredClone(value);
export function useDragDrop({session,saving,playing,selected,setSelected,setChosenKey,sceneReadOnly,locked,registry,player,stage,gesture,docRef,frame,auto,setDoc,commit,motionTargeting,motionOrigin,motionDuration,scene,setMotionTargeting,setStatus}:{session:React.RefObject<EditSession>;saving:boolean;playing:boolean;selected:string;setSelected:(id:string)=>void;setChosenKey:(key:null)=>void;sceneReadOnly:boolean;locked:Set<string>;registry:React.RefObject<Map<string,LayerInfo>>;player:React.RefObject<PlayerRef|null>;stage:React.RefObject<HTMLDivElement|null>;gesture:React.RefObject<any>;docRef:React.RefObject<EditDocument>;frame:number;auto:boolean;setDoc:React.Dispatch<React.SetStateAction<EditDocument>>;commit:(next:EditDocument,before?:EditDocument)=>void;motionTargeting:boolean;motionOrigin:React.RefObject<{x:number;y:number;frame:number}|null>;motionDuration:number;scene:string;setMotionTargeting:(value:boolean)=>void;setStatus:(value:string)=>void;}){
 const startDrag=(e:React.PointerEvent,resize=false)=>{
  if(session.current.busy||saving||playing)return;
  let id=selected;
  if(!resize){const hits=document.elementsFromPoint(e.clientX,e.clientY).map(el=>el.closest('[data-edit-id]')?.getAttribute('data-edit-id')).filter(Boolean) as string[];id=hits.find(id=>registry.current.has(id))??'';setSelected(id);setChosenKey(null);}
  if(!id||sceneReadOnly||locked.has(id)||layoutLocked(docRef.current.layers,id))return;
  const target=registry.current.get(id);if(!target)return;
  player.current?.pause();e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
  let matrix=new DOMMatrix();for(let p=target.element.parentElement;p&&p!==stage.current;p=p.parentElement){const c=getComputedStyle(p);let m=c.transform==='none'?new DOMMatrix():new DOMMatrix(c.transform);const scale=c.scale==='none'?[1,1]:c.scale.split(' ').map(Number);m=new DOMMatrix().rotate(parseFloat(c.rotate)||0).scale(scale[0],scale[1]??scale[0]).multiply(m);matrix=m.multiply(matrix)}
  matrix=matrix.multiply(new DOMMatrix(multiply(parallaxMatrix(docRef.current.layers,id,frame),inheritedMatrix(docRef.current.layers,id,frame))));
 const r=target.element.getBoundingClientRect();gesture.current={kind:resize?'scale':'move',id,x:e.clientX,y:e.clientY,before:copy(docRef.current),values:valueAt(docRef.current.layers[id],frame),inverse:new DOMMatrix([matrix.a,matrix.b,matrix.c,matrix.d,0,0]).inverse(),center:{x:r.left+r.width/2,y:r.top+r.height/2},distance:Math.hypot(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2),frame};
 };
 const drag=(e:React.PointerEvent)=>{const g=gesture.current;if(!g)return;const delta=new DOMPoint(e.clientX-g.x,e.clientY-g.y).matrixTransform(g.inverse);const changes=g.kind==='scale'?{scale:Math.max(.01,Math.min(100,g.values.scale*Math.hypot(e.clientX-g.center.x,e.clientY-g.center.y)/Math.max(1,g.distance)))}:{x:Math.round(g.values.x+delta.x),y:Math.round(g.values.y+delta.y)};
  const base=copy(g.before.layers[g.id]??{});const target=registry.current.get(g.id);if(auto&&target&&g.frame>target.start)for(const field of Object.keys(changes))if(!base.keys?.[field]?.length){base.keys??={};base.keys[field]=[{frame:target.start,value:valueAt(base,target.start)[field],easing:'linear'}]}
  setDoc({...g.before,layers:{...g.before.layers,[g.id]:setValue(base,g.frame,changes,auto)}});
 };
 const endDrag=()=>{
  const g=gesture.current;
  if(g){
   if(motionTargeting&&motionOrigin.current){
    const origin=motionOrigin.current;
    const currentEndValues=valueAt(docRef.current.layers[g.id],frame);
    const durationFrames=Math.max(15,Math.round(motionDuration*30));
    const targetFrame=Math.min(sceneMeta[scene].duration-1,origin.frame+durationFrames);

    const base=copy(g.before.layers[g.id]??{});
    const withStart=setValue(base,origin.frame,{x:origin.x,y:origin.y},true);
    const withEnd=setValue(withStart,targetFrame,{x:currentEndValues.x,y:currentEndValues.y},true);

    const next={
      ...docRef.current,
      layers:{
        ...docRef.current.layers,
        [g.id]:withEnd
      }
    };
    commit(next,g.before);
    motionOrigin.current=null;
    setMotionTargeting(false);
    gesture.current=null;
    setStatus(`✓ Đã tạo chuyển động (${motionDuration}s) từ frame ${origin.frame} đến ${targetFrame}! Bấm Play để xem.`);
    return;
   }
   commit(docRef.current,g.before);
   gesture.current=null;
  }
 };
 const cancelDrag=()=>{if(gesture.current){setDoc(gesture.current.before);gesture.current=null}};
 return {startDrag,drag,endDrag,cancelDrag};
}
