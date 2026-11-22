import {useCallback,useRef,useState} from 'react';
import type React from 'react';
import type {LayerInfo} from './Editable';
export function useSelection(stage:React.RefObject<HTMLDivElement|null>){
 const [selected,setSelected]=useState('');
 const registry=useRef(new Map<string,LayerInfo>());
 const register=useCallback((info:LayerInfo)=>{registry.current.set(info.id,info)},[]);
 const unregister=useCallback((id:string,element:HTMLElement)=>{if(registry.current.get(id)?.element===element)registry.current.delete(id)},[]);
 const visible=(info:LayerInfo)=>{if(!info.element.isConnected)return false;const r=info.element.getBoundingClientRect(),s=stage.current?.getBoundingClientRect();if(!s||r.width<2||r.height<2||r.right<=s.left||r.left>=s.right||r.bottom<=s.top||r.top>=s.bottom)return false;for(let p:HTMLElement|null=info.element;p&&p!==stage.current;p=p.parentElement){const c=getComputedStyle(p);if(c.display==='none'||c.visibility==='hidden'||Number(c.opacity)<.02)return false;}return true;};
 const layers=[...registry.current.values()].filter(visible).reverse();
 const info=registry.current.get(selected);
 const bounds=info&&visible(info)&&stage.current?(()=>{const r=info.element.getBoundingClientRect(),s=stage.current!.getBoundingClientRect();return {left:r.left-s.left,top:r.top-s.top,width:r.width,height:r.height}})():null;
 return {selected,setSelected,registry,register,unregister,visible,layers,bounds};
}
