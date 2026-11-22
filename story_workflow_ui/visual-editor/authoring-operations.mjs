import {easings,setValue,valueAt,validateDocument,fields} from './model.mjs';
import {replaceStoryboardAsset} from './storyboard-model.mjs';
import {taskLayerIds} from './task-layer-bindings.mjs';
export const authoringOperations={version:1,operations:['add-character','add-asset','replace-asset','set-pose-face','place','move','layout','pose-sequence','anchor','transform','set-range','replace-from-layer','fade','pop-in','shake','transition','effect'],transitions:['fade-black','fade-white','wipe-left','wipe-right','flash'],layouts:{solo:[{x:960,y:960,height:660}],dialogue:[{x:580,y:960,height:650},{x:1340,y:960,height:650}],pursuit:[{x:650,y:970,height:700},{x:1300,y:830,height:430}]}};
const fail=message=>{throw Error(message);};
const finite=(v,name)=>{if(!Number.isFinite(v)||Math.abs(v)>100000)fail('Giá trị '+name+' không hợp lệ');return v;};
// Keyframe presets compile to ordinary keyframes (same model/interpolation as hand-authored ones).
function clearRange(layer,fields,from,to,replaceKeys){
 for(const f of fields){const inside=(layer.keys?.[f]??[]).some(k=>k.frame>=from&&k.frame<to);
  if(inside&&replaceKeys!==true)fail('Đã có keyframe '+f+' trong khoảng; cần replaceKeys:true');
  if(layer.keys?.[f])layer.keys[f]=layer.keys[f].filter(k=>k.frame<from||k.frame>=to);}
}
const inRange=(layer,from,to)=>Number.isInteger(from)&&Number.isInteger(to)&&from>=layer.asset.from&&to<=layer.asset.to&&to-from>=2;
const keyAt=(layer,frame,values,easing)=>{let next=setValue(layer,frame,values,true);for(const f of Object.keys(values))next.keys[f]=next.keys[f].map(k=>k.frame===frame?{...k,easing}:k);return next;};
function layerOf(doc,id){const layer=doc.layers[id];if(!layer?.asset)fail('Layer tài nguyên không tồn tại: '+id);return layer;}
function place(layer,p){
 if(!p||typeof p!=='object'||Array.isArray(p)||layer.base?.rotation||layer.keys?.rotation?.length)fail('Place v1 cần sprite chưa xoay');
 if(Object.keys(p).some(k=>!['x','y','height','anchor','flipX','z'].includes(k))||(p.flipX!==undefined&&typeof p.flipX!=='boolean'))fail('Thông số placement không hợp lệ');
 const h=p.height??layer.asset.height;finite(h,'height');if(h<=0)fail('Chiều cao phải dương');const scale=h/layer.asset.height;
 const w=layer.asset.width*scale,anchor=p.anchor??'bottom-center';if(!['bottom-center','center','top-left'].includes(anchor))fail('Điểm đặt không hợp lệ');
 layer.base={...layer.base,scale,x:finite(p.x,'x')-layer.asset.left-(anchor==='top-left'?0:layer.asset.width/2),y:finite(p.y,'y')-layer.asset.top-(anchor==='bottom-center'?layer.asset.height:anchor==='center'?layer.asset.height/2:0)};
 // CSS scales about the container center. Compensate so the requested visual anchor stays fixed.
 layer.base.x+=(anchor==='top-left'?(w-layer.asset.width)/2:0);layer.base.y+=(anchor==='bottom-center'?-(h-layer.asset.height)/2:anchor==='top-left'?(h-layer.asset.height)/2:0);
 if(p.flipX!==undefined)layer.base.flipX=p.flipX;
 if(p.z!==undefined)layer.base.z=p.z;
 if(layer.keys?.x?.length||layer.keys?.y?.length||layer.keys?.scale?.length)fail('Place không ghi đè track đang có; dùng move hoặc chọn layer chưa có track');
}
export function applyAuthoringOperations(source,document,commands,selections={}){
 if(!Array.isArray(commands)||!commands.length||commands.length>200)fail('Batch cần1–200 thao tác');
 let next=structuredClone(document);const changes=[],warnings=[];
 const selection=op=>{const value=selections[op.asset];if(!value)fail('Chưa chuẩn bị tài nguyên: '+op.asset);return value;};
 const replace=op=>{layerOf(next,op.layerId);next=replaceStoryboardAsset(next,op.layerId,selection(op));changes.push({op:'replace-asset',layerId:op.layerId});warnings.push('Kiểm tra lại nhận diện/tiếp xúc sau thay '+op.layerId);};
 for(const op of commands){
  if(!op||!authoringOperations.operations.includes(op.op))fail('Thao tác không hỗ trợ: '+op?.op);
  if(op.op==='transform'){
   const layer=layerOf(next,op.layerId);if(!op.values||!Object.keys(op.values).length||Object.keys(op.values).some(f=>!fields.includes(f)))fail('Transform không hợp lệ');
   if(op.frame!==undefined&&(!Number.isInteger(op.frame)||op.frame<layer.asset.from||op.frame>=layer.asset.to))fail('Frame transform ngoài layer');
   if(op.frame===undefined){if(Object.keys(op.values).some(f=>layer.keys?.[f]?.length))fail('Transform base không ghi đè track');layer.base={...layer.base,...op.values};}
   else {if(Object.keys(op.values).some(f=>layer.keys?.[f]?.some(k=>k.frame===op.frame))&&op.replaceKeys!==true)fail('Key đã tồn tại');next.layers[op.layerId]=setValue(layer,op.frame,op.values,true);for(const f of Object.keys(op.values))next.layers[op.layerId].keys[f]=next.layers[op.layerId].keys[f].map(k=>k.frame===op.frame?{...k,easing:op.easing??'hold'}:k);}
   changes.push({op:op.op,layerId:op.layerId});continue;
  }
  if(op.op==='set-range'){
   const layer=layerOf(next,op.layerId);if(!Number.isInteger(op.from)||!Number.isInteger(op.to)||op.from<0||op.to>source.duration||op.from>=op.to)fail('Khoảng xuất hiện không hợp lệ');layer.asset.from=op.from;layer.asset.to=op.to;changes.push({op:op.op,layerId:op.layerId});continue;
  }
  if(op.op==='fade'){
   const layer=layerOf(next,op.layerId),easing=op.easing??'smooth';
   if(!inRange(layer,op.from,op.to)||!easings.includes(easing)||!Array.isArray(op.opacity)||op.opacity.length!==2||op.opacity.some(v=>!(v>=0&&v<=1)))fail('Fade cần from/to trong khoảng xuất hiện (≥2 frame), opacity [bắt đầu,kết thúc] trong 0–1');
   const copy=structuredClone(layer);clearRange(copy,['opacity'],op.from,op.to,op.replaceKeys);
   next.layers[op.layerId]=keyAt(keyAt(copy,op.from,{opacity:op.opacity[0]},easing),op.to-1,{opacity:op.opacity[1]},'linear');changes.push({op:op.op,layerId:op.layerId});continue;
  }
  if(op.op==='pop-in'){
   const layer=layerOf(next,op.layerId),frames=op.frames??8,from=op.from??layer.asset.from,to=from+frames;
   if(!inRange(layer,from,to))fail('Pop-in cần ≥2 frame nằm trong khoảng xuất hiện của layer');
   const copy=structuredClone(layer),s0=valueAt(layer,from).scale;clearRange(copy,['opacity','scale'],from,to,op.replaceKeys);
   let edited=keyAt(copy,from,{opacity:0,scale:s0*(op.fromScale??.85)},'ease-out');edited=keyAt(edited,to-1,{opacity:1,scale:s0},'linear');
   next.layers[op.layerId]=edited;changes.push({op:op.op,layerId:op.layerId});continue;
  }
  if(op.op==='shake'){
   const layer=layerOf(next,op.layerId),step=op.step??2,amp=op.amplitude??14;
   if(!inRange(layer,op.from,op.to)||!Number.isInteger(step)||step<1||!(amp>0&&amp<=200))fail('Shake cần from/to hợp lệ, step ≥1 frame, amplitude 0–200');
   const copy=structuredClone(layer),start=valueAt(layer,op.from);clearRange(copy,['x','y'],op.from,op.to,op.replaceKeys);
   const pattern=[[1,.5],[-1,-1],[.8,.7],[-.7,-.4],[.5,.6],[-.4,-.5]];let edited=copy;
   for(let frame=op.from,i=0;frame<op.to-1;frame+=step,i++){const k=1-(frame-op.from)/(op.to-op.from),[px,py]=pattern[i%pattern.length];
    edited=keyAt(edited,frame,i===0?{x:start.x,y:start.y}:{x:start.x+px*amp*k,y:start.y+py*amp*k},'linear');}
   next.layers[op.layerId]=keyAt(edited,op.to-1,{x:start.x,y:start.y},'linear');changes.push({op:op.op,layerId:op.layerId});warnings.push('Shake chỉ rung vị trí; kiểm tra bằng capture rằng nhân vật không rời khỏi khung');continue;
  }
  if(op.op==='transition'){
   if(!['in','out'].includes(op.side))fail('Transition cần side "in" hoặc "out"');
   next.transitions={...(next.transitions??{})};if(op.remove===true)delete next.transitions[op.side];else next.transitions[op.side]={type:op.type,frames:op.frames};
   if(!Object.keys(next.transitions).length)delete next.transitions;changes.push({op:op.op,side:op.side});warnings.push('Chuyển cảnh nằm trong chính các frame của cảnh, không thay đổi thời lượng');continue;
  }
  if(op.op==='effect'){
   if(typeof op.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(op.id))fail('Id hiệu ứng không hợp lệ');
   if(!Number.isInteger(op.from)||!Number.isInteger(op.to)||op.from<0||op.to>source.duration||op.to-op.from<2)fail('Khoảng hiệu ứng không hợp lệ');
   const id=source.id+'/shot-'+op.from+'/op-'+op.id;if(next.layers[id])fail('Layer đã tồn tại: '+id);
   const asset=selection(op);if(asset.type!=='effects')fail('Op effect cần tài nguyên loại effects (kho hiệu ứng)');
   const inF=op.inFrames??2,outF=op.outFrames??6;if(!Number.isInteger(inF)||!Number.isInteger(outF)||inF<0||outF<0||inF+outF>op.to-op.from-1)fail('inFrames/outFrames không vừa khoảng hiệu ứng');
   next.layers[id]={base:{z:op.z??300,opacity:1},asset:{...structuredClone(asset),from:op.from,to:op.to,left:0,top:0}};
   place(next.layers[id],{anchor:'center',x:960,y:540,height:1080,...(op.placement??{})});
   let layer=next.layers[id];layer=keyAt(layer,op.from,{opacity:inF?0:1},'ease-out');if(inF)layer=keyAt(layer,op.from+inF,{opacity:1},'linear');
   if(outF){layer=keyAt(layer,op.to-1-outF,{opacity:1},'ease-in');}layer=keyAt(layer,op.to-1,{opacity:outF?0:1},'linear');next.layers[id]=layer;
   changes.push({op:op.op,layerId:id});warnings.push('Hiệu ứng là ảnh tĩnh phủ lên cảnh; xem capture để chắc nó không che mất hành động chính');continue;
  }
  if(op.op==='replace-from-layer'){
   const original=layerOf(next,op.sourceLayerId);next=replaceStoryboardAsset(next,op.layerId,{...original.asset,name:layerOf(next,op.layerId).asset.name});changes.push({op:op.op,layerId:op.layerId,sourceLayerId:op.sourceLayerId});warnings.push('Ảnh tái dùng từ layer khác; cần kiểm tra ý nghĩa và nhận diện');continue;
  }
  if(op.op==='add-character'||op.op==='add-asset'){
   if(typeof op.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(op.id))fail('Id đối tượng không hợp lệ');
   const id=source.id+'/shot-'+op.from+'/op-'+op.id;if(next.layers[id])fail('Layer đã tồn tại: '+id);
   if(!Number.isInteger(op.from)||!Number.isInteger(op.to)||op.from<0||op.to>source.duration||op.from>=op.to)fail('Khoảng xuất hiện không hợp lệ');
   const asset=selection(op);if(op.op==='add-character'&&asset.type!=='characters')fail('add-character cần tài nguyên nhân vật');
   next.layers[id]={base:{z:asset.type==='backgrounds'?0:100},asset:{...structuredClone(asset),from:op.from,to:op.to,left:0,top:0}};
   place(next.layers[id],op.placement??{x:960,y:960,height:600});
   for(const taskId of op.taskIds??[]){const task=source.scriptPlan?.tasks.find(t=>t.id===taskId);if(!task||op.from>task.from||op.to<task.to)fail('Layer mới không phủ việc '+taskId);const binding=next.production?.taskBindings?.[taskId];if(!binding)fail('Task chưa có production binding');binding.layerIds=[...new Set([...taskLayerIds(task,next),id])];}
   if(source.scriptPlan&&!op.taskIds?.length)warnings.push('Layer mới chưa liên kết task: '+id);
   changes.push({op:op.op,layerId:id});
  }else if(op.op==='replace-asset'||op.op==='set-pose-face'){if(op.op==='set-pose-face'&&layerOf(next,op.layerId).asset.type!=='characters')fail('set-pose-face chỉ dùng cho nhân vật');replace(op);}
  else if(op.op==='pose-sequence'){
   if(!Array.isArray(op.states)||op.states.length<2||op.states.length>50||new Set(op.states.map(s=>s.layerId)).size!==op.states.length)fail('Chuỗi pose cần2–50layer trạng thái riêng');
   let end;for(const state of op.states){const layer=layerOf(next,state.layerId);if(state.from!==layer.asset.from||state.to!==layer.asset.to||(end!==undefined&&end!==state.from))fail('Chuỗi pose phải liên tục và khớp thời gian layer sẵn có');replace(state);end=state.to;}
  }else if(op.op==='place'){place(layerOf(next,op.layerId),op.placement);changes.push({op:op.op,layerId:op.layerId});}
  else if(op.op==='layout'){
   const slots=authoringOperations.layouts[op.preset];if(!slots||!Array.isArray(op.layerIds)||slots.length!==op.layerIds.length||new Set(op.layerIds).size!==op.layerIds.length)fail('Preset/bộ layer không khớp');
   if(op.overrides!==undefined&&(!Array.isArray(op.overrides)||op.overrides.length!==slots.length))fail('Overrides không khớp số slot');
   op.layerIds.forEach((id,i)=>{place(layerOf(next,id),{...slots[i],...(op.overrides?.[i]??{})});changes.push({op:'place',layerId:id,preset:op.preset});});warnings.push('Bố cục '+op.preset+' là điểm bắt đầu, cần xem ngữ cảnh/mặt đất');
  }else if(op.op==='move'){
   const layer=layerOf(next,op.layerId);if(!Number.isInteger(op.from)||!Number.isInteger(op.to)||op.from<layer.asset.from||op.to>layer.asset.to||op.to-op.from<2||!easings.includes(op.easing??'smooth'))fail('Khoảng di chuyển/easing không hợp lệ');
   const start=valueAt(layer,op.from);for(const f of ['x','y']){if((layer.keys?.[f]??[]).some(k=>k.frame>=op.from&&k.frame<op.to)&&op.replaceKeys!==true)fail('Đã có keyframe trong khoảng; cần replaceKeys:true');}
   let edited=structuredClone(layer);for(const f of ['x','y'])if(edited.keys?.[f])edited.keys[f]=edited.keys[f].filter(k=>k.frame<op.from||k.frame>=op.to);
   edited=setValue(edited,op.from,{x:start.x,y:start.y},true);edited=setValue(edited,op.to-1,{x:start.x+finite(op.delta?.x??0,'delta.x'),y:start.y+finite(op.delta?.y??0,'delta.y')},true);
   for(const f of ['x','y'])edited.keys[f]=edited.keys[f].map(k=>k.frame===op.from?{...k,easing:op.easing??'smooth'}:k);next.layers[op.layerId]=edited;changes.push({op:op.op,layerId:op.layerId});
  }else if(op.op==='anchor'){
   const layer=layerOf(next,op.layerId),frame=op.frame??layer.asset.from;if(!Number.isInteger(frame)||frame<layer.asset.from||frame>=layer.asset.to)fail('Frame neo không thuộc khoảng xuất hiện');const v=valueAt(layer,frame);
   if(v.rotation!==0||v.flipX||v.flipY)fail('Anchor v1 chỉ nhận sprite chưa xoay/lật');
   if(layer.keys?.x?.length||layer.keys?.y?.length||layer.keys?.scale?.length)fail('Anchor v1 cần layer chưa có track vị trí/scale');
   const a=layer.asset,px=finite(op.local?.x,'local.x'),py=finite(op.local?.y,'local.y');if(px<0||py<0||px>a.width||py>a.height)fail('Điểm neo nằm ngoài khung sprite');
   layer.base={...layer.base,x:finite(op.target?.x,'target.x')-(a.left+a.width/2+(px-a.width/2)*v.scale),y:finite(op.target?.y,'target.y')-(a.top+a.height/2+(py-a.height/2)*v.scale)};
   changes.push({op:op.op,layerId:op.layerId});warnings.push('Điểm neo là dữ liệu khai báo; cần xem tiếp xúc thật');
  }
 }
 validateDocument(next,source.duration);
 return {document:next,changes,warnings:[...new Set(warnings)]};
}
