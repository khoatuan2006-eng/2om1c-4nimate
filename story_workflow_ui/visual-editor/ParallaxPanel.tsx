import React,{useState} from 'react';
import type {EditDocument} from './Editable';
import {cameraPreset} from './parallax.mjs';
import {layoutLocked} from './scene-graph.mjs';
export function ParallaxPanel({document,id,disabled,onChange}:{document:EditDocument;id:string;disabled:boolean;onChange:(next:EditDocument)=>void}){
 const [preset,setPreset]=useState('pan-right');const layer=document.layers[id];if(!layer?.asset)return null;const locked=disabled||layoutLocked(document.layers,id);
 return <details className="assembly-panel"><summary>Máy quay & parallax</summary><p>Máy quay đặt trên gốc của bộ. Lớp gần dịch chuyển nhiều hơn lớp xa; thứ tự che nhau vẫn do Z quyết định.</p>
 <label>Độ gần của lớp<select aria-label="Độ gần parallax" disabled={locked} value={layer.depth??1} onChange={e=>{const next=structuredClone(document);next.layers[id].depth=Number(e.target.value);onChange(next);}}><option value={0}>Chân trời · đứng yên</option><option value={.25}>Xa · 0.25</option><option value={.5}>Trung cảnh · 0.5</option><option value={1}>Gần · 1</option><option value={1.5}>Tiền cảnh · 1.5</option><option value={2}>Sát máy · 2</option></select></label>
 {!layer.parentId&&<><label>Chuyển động máy quay<select aria-label="Chuyển động máy quay" value={preset} onChange={e=>setPreset(e.target.value)}><option value="pan-right">Lia phải</option><option value="pan-left">Lia trái</option><option value="push-in">Tiến gần</option><option value="off">Tắt chuyển động</option></select></label><button disabled={disabled} onClick={()=>onChange(cameraPreset(document,id,preset))}>Áp dụng máy quay cho bộ</button><p>{layer.camera?.enabled?'Máy quay đang hoạt động trên suốt thời gian của bộ':'Máy quay đang tắt'}</p></>}
 </details>;
}
