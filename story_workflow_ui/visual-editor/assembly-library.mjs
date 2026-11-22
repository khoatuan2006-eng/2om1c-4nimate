import {subtree,validateHierarchy} from './scene-graph.mjs';
import {validateDocument} from './model.mjs';
export function captureAssembly(document,rootId,name){
 if(typeof name!=='string'||!name.trim()||name.length>100)throw Error('Tên bộ cần từ 1–100 ký tự');
 const root=document.layers[rootId];if(!root?.asset||root.parentId)throw Error('Chọn đối tượng gốc của bộ để lưu mẫu');
 const layers=Object.fromEntries(subtree(document.layers,rootId).map(id=>[id,structuredClone(document.layers[id])]));
 const from=Math.min(...Object.values(layers).map(l=>l.asset.from)),to=Math.max(...Object.values(layers).map(l=>l.asset.to));
 validateDocument({version:1,revision:0,layers},to);return {version:1,name:name.trim(),rootId,layers,from,to};
}
export function instantiateAssembly(document,template,scene,from,to,newId){
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<=from)throw Error('Khoảng đặt bộ không hợp lệ');
 const checked=captureAssembly({layers:template.layers},template.rootId,template.name),ratio=(to-from)/(checked.to-checked.from);
 const next=structuredClone(document),map=new Map(Object.keys(checked.layers).map(id=>[id,`${scene}/shot-${from}/user-${newId()}`]));
 const time=f=>Math.max(from,Math.min(to-1,from+Math.round((f-checked.from)*ratio)));
 for(const [id,source] of Object.entries(checked.layers)){const l=structuredClone(source);if(l.parentId)l.parentId=map.get(l.parentId);l.asset.from=time(l.asset.from);l.asset.to=Math.max(l.asset.from+1,Math.min(to,from+Math.round((l.asset.to-checked.from)*ratio)));if(l.camera)for(const [field,keys] of Object.entries(l.camera.keys))l.camera.keys[field]=[...new Map(keys.map(k=>[time(k.frame),{...k,frame:time(k.frame)}])).values()].sort((a,b)=>a.frame-b.frame);for(const [field,keys] of Object.entries(l.keys??{}))l.keys[field]=[...new Map(keys.map(k=>[time(k.frame),{...k,frame:time(k.frame)}])).values()].sort((a,b)=>a.frame-b.frame);next.layers[map.get(id)]=l;}
 validateHierarchy(next.layers);return {document:next,id:map.get(checked.rootId)??''};
}
