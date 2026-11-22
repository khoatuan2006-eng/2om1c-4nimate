import React,{useState} from 'react';
import type {EditDocument} from './Editable';
import {socketFor,calibrateSocket,bindSocket,poseKey} from './attachment-sockets.mjs';
import {layoutLocked} from './scene-graph.mjs';
type Point={x:number;y:number;rotation?:number};
function PointPreview({layer,point,label,onPoint,disabled}:{layer:any;point?:Point;label:string;onPoint:(point:Point)=>void;disabled:boolean}){
 const a=layer.asset;
 return <svg role="img" aria-label={label} viewBox={`0 0 ${a.width} ${a.height}`} className="socket-preview" style={{aspectRatio:`${a.width}/${a.height}`}} onPointerDown={e=>{e.stopPropagation();if(disabled)return;const matrix=e.currentTarget.getScreenCTM();if(!matrix)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());onPoint({x:Math.max(0,Math.min(1,p.x/a.width)),y:Math.max(0,Math.min(1,p.y/a.height)),rotation:point?.rotation??0});}}>
 {a.parts.map((p:any,i:number)=><image key={i} href={'/'+p.src} x={p.left} y={p.top} width={p.width} height={p.height} preserveAspectRatio="none"/>)}
 {point&&<g pointerEvents="none"><circle cx={point.x*a.width} cy={point.y*a.height} r={Math.max(a.width,a.height)*.025} fill="#ffcb47" stroke="#111" strokeWidth={Math.max(a.width,a.height)*.006}/><path d={`M ${point.x*a.width} ${point.y*a.height} l ${Math.cos((point.rotation??0)*Math.PI/180)*a.width*.15} ${Math.sin((point.rotation??0)*Math.PI/180)*a.width*.15}`} stroke="#ffcb47" strokeWidth={Math.max(a.width,a.height)*.01}/></g>}
 </svg>;
}
export function SocketEditor({document,id,frame,disabled,onChange}:{document:EditDocument;id:string;frame:number;disabled:boolean;onChange:(next:EditDocument)=>void}){
 const [socket,setSocket]=useState('hand-right'),[error,setError]=useState('');const layer=document.layers[id];if(!layer?.asset)return null;
 const parent=document.layers[layer.parentId],protectedChild=layoutLocked(document.layers,id),point=socketFor(layer,socket),grip=layer.socketBinding?.grip??{x:.5,y:.5};
 const apply=(fn:()=>EditDocument)=>{try{onChange(fn());setError('');}catch(e){setError(e instanceof Error?e.message:'Chưa cập nhật được điểm gắn');}};
 return <details className="assembly-panel socket-editor"><summary>Điểm cầm theo pose</summary>
 <label>Điểm gắn<select aria-label="Điểm gắn" value={socket} onChange={e=>setSocket(e.target.value)}><option value="hand-right">Tay phải</option><option value="hand-left">Tay trái</option><option value="belt">Thắt lưng</option></select></label>
 {layer.asset.type==='characters'&&<><p>Chọn từng pose rồi nhấp vào tay trên ảnh này một lần. Điểm đã lưu sẽ tự áp dụng khi đổi lại pose.</p><p>{point?'Đã lưu điểm cho pose này':'Pose này chưa có điểm gắn'} · {layer.asset.name}</p><PointPreview layer={layer} point={point} label="Định vị tay trên pose" disabled={disabled||protectedChild||!!layer.layoutLocked} onPoint={p=>apply(()=>calibrateSocket(document,id,socket,p))}/><label>Góc cầm (độ)<input aria-label="Góc điểm gắn" type="number" value={point?.rotation??0} disabled={disabled||protectedChild||!!layer.layoutLocked||!point} onChange={e=>{const rotation=Number(e.target.value);if(Number.isFinite(rotation))apply(()=>calibrateSocket(document,id,socket,{...point,rotation}));}}/></label><small>{Object.keys(layer.sockets?.[socket]??{}).length} pose đã định vị</small></>}
 {parent&&<><p>Chọn vị trí chuôi trên đạo cụ. Chuôi sẽ bám vào điểm gắn của cha.</p><PointPreview layer={layer} point={grip} label="Định vị chuôi đạo cụ" disabled={disabled||protectedChild} onPoint={p=>apply(()=>bindSocket(document,id,socket,p,frame))}/><button disabled={disabled||protectedChild||!socketFor(parent,socket)} onClick={()=>apply(()=>bindSocket(document,id,socket,grip,frame))}>Bám vào điểm gắn của cha</button>{layer.socketBinding&&!socketFor(parent,layer.socketBinding.name)&&<p role="alert">Pose của cha chưa định vị điểm cầm. Mở khóa thiết kế, chọn cha và định vị pose này.</p>}<small>{layer.socketBinding?`Đã bám: ${layer.socketBinding.name}`:'Chưa bám vào điểm gắn'}</small></>}
 {error&&<p role="alert">{error}</p>}
 </details>;
}
