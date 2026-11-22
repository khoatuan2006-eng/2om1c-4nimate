import {subtree, validateHierarchy, inverse, worldMatrix} from './scene-graph.mjs';
import {valueAt, validateDocument} from './model.mjs';
export function shiftAssembly(document,id,requestedDelta,duration){
 const next=structuredClone(document),ids=subtree(document.layers,id),frames=ids.flatMap(key=>{const l=document.layers[key];return [l.asset.from,l.asset.to-1,...Object.values(l.keys??{}).flat().map(k=>k.frame),...Object.values(l.camera?.keys??{}).flat().map(k=>k.frame)];});
 const delta=Math.max(-Math.min(...frames),Math.min(duration-1-Math.max(...frames),Math.round(requestedDelta)));
 for(const key of ids){const l=next.layers[key];l.asset.from+=delta;l.asset.to+=delta;for(const keys of [...Object.values(l.keys??{}),...Object.values(l.camera?.keys??{})])for(const k of keys)k.frame+=delta;}
 return next;
}
export function trimAssembly(document,id,from,to){const next=structuredClone(document),l=next.layers[id];l.asset.from=from;l.asset.to=to;if(l.camera){for(const field of ['x','y','scale']){const sample=f=>valueAt({base:l.camera.base,keys:l.camera.keys},f)[field];l.camera.keys[field]=[{frame:from,value:sample(from),easing:'linear'},...l.camera.keys[field].filter(k=>k.frame>from&&k.frame<to-1),...(to-1>from?[{frame:to-1,value:sample(to-1),easing:'linear'}]:[])];}}return next;}
export function splitLayerAtFrame(document,id,frame,duration,newIdGen=()=>Math.random().toString(36).slice(2,10)){
 const next=structuredClone(document),layer=next.layers[id];
 if(!layer?.asset)throw Error('Không tìm thấy đối tượng để cắt');
 if(!Number.isInteger(frame)||frame<=layer.asset.from||frame>=layer.asset.to){
  throw Error(`Con trỏ phát (frame ${frame}) phải nằm trong khoảng hiển thị của clip (${layer.asset.from} - ${layer.asset.to})`);
 }
 const scenePrefix=id.split('/shot-')[0],newLayerId=`${scenePrefix}/shot-${frame}/user-${newIdGen()}`;
 const currentVals=valueAt(layer,frame);
 const part2=structuredClone(layer);
 part2.asset.from=frame;
 part2.base={...part2.base,x:currentVals.x,y:currentVals.y,scale:currentVals.scale,rotation:currentVals.rotation,flipX:currentVals.flipX,flipY:currentVals.flipY,opacity:currentVals.opacity,z:currentVals.z};
 if(part2.keys){
  for(const f of Object.keys(part2.keys)){
   part2.keys[f]=(part2.keys[f]||[]).filter(k=>k.frame>=frame);
   if(part2.keys[f].length>0&&!part2.keys[f].some(k=>k.frame===frame)){
    part2.keys[f].unshift({frame,value:currentVals[f],easing:'linear'});
   }
  }
 }
 layer.asset.to=frame;
 if(layer.keys){
  for(const f of Object.keys(layer.keys)){
   layer.keys[f]=(layer.keys[f]||[]).filter(k=>k.frame<frame);
  }
 }
 if(part2.parentId){
  const parent=next.layers[part2.parentId];
  if(parent?.asset&&frame>=parent.asset.from&&frame<parent.asset.to){
   try{part2.parentInverse=inverse(worldMatrix(document.layers,part2.parentId,frame));}
   catch{delete part2.parentId;delete part2.parentInverse;}
  }else{delete part2.parentId;delete part2.parentInverse;}
 }
 next.layers[newLayerId]=part2;
 validateHierarchy(next.layers);
 validateDocument(next,duration);
 return {document:next,newLayerId};
}
