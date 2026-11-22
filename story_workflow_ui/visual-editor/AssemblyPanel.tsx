import React,{useState} from 'react';
import {attachLayer,detachLayer,hierarchy,layoutLocked,subtree} from './scene-graph.mjs';
import type {EditDocument} from './Editable';
export function AssemblyPanel({document,id,frame,disabled,onChange}:{document:EditDocument;id:string;frame:number;disabled:boolean;onChange:(next:EditDocument)=>void}){
 const [parent,setParent]=useState(''),[error,setError]=useState('');const layer=document.layers[id];if(!layer?.asset)return null;
 const protectedChild=layoutLocked(document.layers,id),children=subtree(document.layers,id).length-1;
 const apply=(fn:()=>EditDocument)=>{try{onChange(fn());setError('');}catch(e){setError(e instanceof Error?e.message:'Chưa thay đổi được nhóm');}};
 return <section className="assembly-panel"><h4>Nhóm & chiều sâu</h4><p>{children?`${children} đối tượng con · di chuyển cùng nhóm`:'Gắn đạo cụ hoặc lớp nền vào một đối tượng cha.'}</p>
 {layer.parentId?<><p>Thuộc: <strong>{document.layers[layer.parentId]?.asset?.name}</strong></p><button disabled={disabled||protectedChild} onClick={()=>apply(()=>detachLayer(document,id))}>Tách khỏi cha · giữ chuyển động</button></>:<><label>Đối tượng cha<select aria-label="Đối tượng cha" disabled={disabled||protectedChild} value={parent} onChange={e=>setParent(e.target.value)}><option value="">Chọn đối tượng…</option>{Object.entries(document.layers).filter(([key,l])=>l.asset&&key!==id&&!hierarchy(document.layers,key).includes(id)).map(([key,l])=><option key={key} value={key}>{l.asset.name}</option>)}</select></label><button disabled={disabled||!parent||protectedChild} onClick={()=>apply(()=>attachLayer(document,id,parent,frame))}>Gắn vào cha · giữ vị trí</button></>}
 <label><input type="checkbox" checked={!!layer.layoutLocked} disabled={disabled||protectedChild} onChange={e=>{const next=structuredClone(document);next.layers[id].layoutLocked=e.target.checked;onChange(next);}}/>Khóa thiết kế các đối tượng con</label>
 {protectedChild&&<p>Thiết kế đang khóa. Chọn cha để mở khóa; cha vẫn có thể di chuyển.</p>}
 <label>Thứ tự chiều sâu Z<input aria-label="Chiều sâu nhóm Z" type="number" value={layer.base?.z??0} disabled={disabled||protectedChild||!!layer.keys?.z?.length} onChange={e=>{const z=Number(e.target.value);if(!Number.isInteger(z)||Math.abs(z)>100000)return;const next=structuredClone(document);next.layers[id].base={...layer.base,z};next.layers[id].zOrderUnlocked=true;onChange(next);}}/></label><small>Z lớn hơn nằm phía trước. Con giữ Z riêng; X/Y và xoay của con đi theo hệ tọa độ cha.</small>
 {error&&<p role="alert">{error}</p>}</section>;
}
