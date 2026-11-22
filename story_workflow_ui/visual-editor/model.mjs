import {validateHierarchy} from './scene-graph.mjs';
import {validateStoryboard} from './storyboard-model.mjs';
import {validateBeats} from './beats.mjs';
import {validateTransitions} from './transitions.mjs';
export const defaults = {x:0,y:0,z:0,scale:1,rotation:0,opacity:1,flipX:false,flipY:false};
export const easings = Object.freeze(['linear','smooth','hold','ease-in','ease-out']);
export const fields = Object.keys(defaults);
export function valueAt(layer={}, frame=0) {
 const result={...defaults,...layer.base};
 for(const field of fields){
  const keys=(layer.keys?.[field]??[]).slice().sort((a,b)=>a.frame-b.frame);
  if(!keys.length)continue;
  let left=keys[0],right=keys[0];
  for(const k of keys){right=k;if(k.frame>frame)break;left=k;}
  if(frame<=keys[0].frame){result[field]=keys[0].value;continue;}
  let t=right.frame>left.frame?Math.min(1,(frame-left.frame)/(right.frame-left.frame)):0;
  if(left.easing==='hold'||typeof left.value==='boolean'||field==='z')t=0;
  else if(left.easing==='smooth')t=t*t*(3-2*t);
  else if(left.easing==='ease-in')t=t*t;
  else if(left.easing==='ease-out')t=1-(1-t)*(1-t);
  result[field]=typeof left.value==='boolean'?left.value:left.value+(right.value-left.value)*t;
 }
 return result;
}
export function setValue(layer={}, frame, changes, auto=false){
 const next=structuredClone(layer);next.base??={};next.keys??={};
 if(("x" in changes||"y" in changes)&&(auto||next.keys.x?.length||next.keys.y?.length)){const current=valueAt(layer,frame);changes={x:current.x,y:current.y,...changes};auto=true;}
 for(const [field,value] of Object.entries(changes)){
  if(auto||next.keys[field]?.length){const keys=next.keys[field]??[];next.keys[field]=[...keys.filter(k=>k.frame!==frame),{frame,value,easing:keys.find(k=>k.frame===frame)?.easing??'linear'}].sort((a,b)=>a.frame-b.frame);}
  else next.base[field]=value;
 }
 return next;
}
export function validateDocument(doc,duration){
 if(!doc||doc.version!==1||!Number.isInteger(doc.revision)||doc.revision<0||!doc.layers||typeof doc.layers!=='object'||Array.isArray(doc.layers))throw Error('Dữ liệu chỉnh sửa không hợp lệ');
 validateStoryboard(doc.storyboard);
 validateHierarchy(doc.layers);
 if(Object.keys(doc.layers).length>2000)throw Error('Quá nhiều layer');
 if(doc.casting){
  if(typeof doc.casting!=='object'||!doc.casting.images||typeof doc.casting.images!=='object'||Array.isArray(doc.casting.images)||Object.keys(doc.casting.images).length>100)throw Error('Bộ nhân vật không hợp lệ');
  for(const replacement of Object.values(doc.casting.images))if(!replacement||typeof replacement!=='object'||(replacement.hidden!==true&&!/^images\/cast-[a-f0-9]{64}\.png$/.test(replacement.src)))throw Error('Ảnh nhân vật không hợp lệ');
 }
 const valid=(field,value)=>typeof defaults[field]==='boolean'?typeof value==='boolean':typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=100000&&(field!=='scale'||value>=.01&&value<=100)&&(field!=='z'||Number.isInteger(value))&&(field!=='opacity'||(value>=0&&value<=1));
 for(const [id,layer] of Object.entries(doc.layers)){
  if(layer?.asset){const a=layer.asset;
   if(typeof a.name!=='string'||a.name.length>500||!['characters','props','backgrounds','effects'].includes(a.type)||!Number.isInteger(a.from)||!Number.isInteger(a.to)||a.from<0||a.to>duration||a.from>=a.to||!Array.isArray(a.parts)||a.parts.length<1||a.parts.length>20)throw Error('Tài nguyên không hợp lệ');
   for(const f of ['left','top','width','height'])if(!Number.isFinite(a[f])||Math.abs(a[f])>100000||(['width','height'].includes(f)&&a[f]<=0))throw Error('Kích thước tài nguyên không hợp lệ');
   for(const p of a.parts){if(!/^library-assets\/[a-f0-9]{64}\.png$/.test(p.src))throw Error('Nguồn tài nguyên không hợp lệ');for(const f of ['left','top','width','height'])if(!Number.isFinite(p[f])||Math.abs(p[f])>100000||(['width','height'].includes(f)&&p[f]<=0))throw Error('Layer ảnh không hợp lệ');}
  }
  if(layer?.zOrderUnlocked!==undefined&&typeof layer.zOrderUnlocked!=='boolean')throw Error('Khóa Z không hợp lệ');
  if(layer?.dimmed!==undefined&&typeof layer.dimmed!=='boolean')throw Error('Trạng thái làm mờ không hợp lệ');
  if(id.length>1500||!layer||typeof layer!=='object')throw Error('Layer không hợp lệ');
  for(const [field,value] of Object.entries(layer.base??{}))if(!fields.includes(field)||!valid(field,value))throw Error(`Giá trị ${field} không hợp lệ`);
  for(const [field,keys] of Object.entries(layer.keys??{})){
   if(!fields.includes(field)||!Array.isArray(keys)||keys.length>duration)throw Error('Keyframe không hợp lệ');
   const seen=new Set();for(const k of keys){if(!Number.isInteger(k.frame)||k.frame<0||k.frame>=duration||seen.has(k.frame)||!valid(field,k.value)||!easings.includes(k.easing))throw Error('Keyframe không hợp lệ');seen.add(k.frame);}
  }
 }
 validateBeats(doc.beats,duration,doc.layers);
 validateTransitions(doc.transitions,duration);
 return doc;
}

export const trackFields=track=>track==='position'?['x','y']:[track];
export function trackKeys(layer={},track){
 if(track!=='position')return [...(layer.keys?.[track]??[])].sort((a,b)=>a.frame-b.frame);
 return [...new Set(['x','y'].flatMap(f=>(layer.keys?.[f]??[]).map(k=>k.frame)))].sort((a,b)=>a-b).map(frame=>({frame,value:valueAt(layer,frame),easing:layer.keys?.x?.find(k=>k.frame===frame)?.easing??layer.keys?.y?.find(k=>k.frame===frame)?.easing??'linear'}));
}
export function editTrackKey(layer,track,frame,action){
 if(!trackFields(track).every(field=>fields.includes(field)))throw Error('Track không hợp lệ');
 if(action.frame!==undefined&&(!Number.isInteger(action.frame)||action.frame<0))throw Error('Frame keyframe không hợp lệ');
 if(action.easing!==undefined&&!easings.includes(action.easing))throw Error('Easing không hợp lệ');
 const next=structuredClone(layer),fieldsToEdit=trackFields(track),sample=valueAt(layer,frame),key=trackKeys(layer,track).find(k=>k.frame===frame);
 if(!key)return next;
 if(action.frame!==undefined&&action.frame!==frame&&trackKeys(layer,track).some(k=>k.frame===action.frame))throw Error('Frame này đã có keyframe');
 next.keys??={};next.base??={};
 for(const field of fieldsToEdit){
  const keys=next.keys[field]??[],existing=keys.find(k=>k.frame===frame);
  next.keys[field]=keys.filter(k=>k.frame!==frame);
  if(action.remove){next.base[field]=sample[field];continue;}
  next.keys[field].push({...existing,frame:action.frame??frame,value:existing?.value??sample[field],easing:action.easing??existing?.easing??key.easing});
  next.keys[field].sort((a,b)=>a.frame-b.frame);
 }
 return next;
}
