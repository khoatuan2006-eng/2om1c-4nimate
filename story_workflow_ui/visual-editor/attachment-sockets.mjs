import {valueAt,setValue} from './model.mjs';
import {worldMatrix,inheritedMatrix,inverse,layoutLocked} from './scene-graph.mjs';

export const poseKey=layer=>layer?.asset?.poseKey??layer?.asset?.parts?.[0]?.src?.replace(/^library-assets\//,'').replace(/\.png$/,'')??'default';
export const socketFor=(layer,name)=>layer?.sockets?.[name]?.[poseKey(layer)];
export function socketMatrix(point,asset){const r=(point.rotation??0)*Math.PI/180;return [Math.cos(r),Math.sin(r),-Math.sin(r),Math.cos(r),point.x*asset.width,point.y*asset.height];}
const pointAt=(m,x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
export function calibrateSocket(document,id,name,point){
 if(!document.layers[id]?.asset||layoutLocked(document.layers,id))throw Error('Mở khóa thiết kế trước khi định vị điểm gắn');
 validatePoint(point);if(!['hand-right','hand-left','belt'].includes(name))throw Error('Tên điểm gắn không hợp lệ');
 const next=structuredClone(document),l=next.layers[id];l.sockets??={};l.sockets[name]??={};l.sockets[name][poseKey(l)]={...point};return next;
}
export function bindSocket(document,id,name,grip,frame){
 const l=document.layers[id],parent=document.layers[l?.parentId],socket=socketFor(parent,name);
 if(!l?.asset||!parent?.asset||!socket)throw Error('Định vị điểm gắn trên pose của cha trước');
 if(layoutLocked(document.layers,id))throw Error('Mở khóa thiết kế trước khi gắn vào tay');
 validatePoint(grip);const next=structuredClone(document),child=next.layers[id];
 delete child.socketBinding;
 const m=worldMatrix(next.layers,id,frame),hand=pointAt(worldMatrix(next.layers,l.parentId,frame),socket.x*parent.asset.width,socket.y*parent.asset.height),held=pointAt(m,grip.x*l.asset.width,grip.y*l.asset.height),inv=inverse(inheritedMatrix(next.layers,id,frame)),v=valueAt(child,frame);
 next.layers[id]=setValue(child,frame,{x:v.x+inv[0]*(hand.x-held.x)+inv[2]*(hand.y-held.y),y:v.y+inv[1]*(hand.x-held.x)+inv[3]*(hand.y-held.y)},false);
 next.layers[id].socketBinding={name,grip:{...grip},reference:{...socket}};return next;
}
export function validatePoint(p){if(!p||![p.x,p.y].every(v=>Number.isFinite(v)&&v>=0&&v<=1)||!Number.isFinite(p.rotation??0)||Math.abs(p.rotation??0)>3600)throw Error('Điểm gắn không hợp lệ');}
export function validateSockets(layer){
 if(layer.sockets!==undefined){if(!layer.sockets||typeof layer.sockets!=='object'||Array.isArray(layer.sockets)||Object.keys(layer.sockets).length>3)throw Error('Danh sách điểm gắn không hợp lệ');for(const [name,poses] of Object.entries(layer.sockets)){if(!['hand-right','hand-left','belt'].includes(name)||!poses||typeof poses!=='object'||Array.isArray(poses)||Object.keys(poses).length>200)throw Error('Bộ điểm theo pose không hợp lệ');for(const [key,point] of Object.entries(poses)){if(!key||key.length>300)throw Error('Mã pose không hợp lệ');validatePoint(point);}}}
 if(layer.socketBinding!==undefined){const b=layer.socketBinding;if(!layer.parentId||!['hand-right','hand-left','belt'].includes(b?.name))throw Error('Điểm cầm cần đối tượng cha');validatePoint(b.grip);validatePoint(b.reference);}
}
