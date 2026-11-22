import {useEffect,useRef} from 'react';
import {attachPreviewControl} from './preview-control-client.mjs';
export function usePreviewControl(context:any){
 const latest=useRef(context);latest.current=context;
 const control=useRef<any>(null),clientId=useRef(crypto.randomUUID());
 useEffect(()=>{
  if(!context.projectId)return;
  const api=async(path:string,body?:any)=>{const response=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined}),data=await response.json();if(!response.ok)throw Object.assign(Error(data.error),{status:response.status});return data;};
  const attached=attachPreviewControl({projectId:context.projectId,clientId:clientId.current,getContext:()=>({...latest.current,canPreview:latest.current.canPreview&&latest.current.canInteract(),player:latest.current.player.current}),request:api,onError:(message:string)=>latest.current.onError(message)});control.current=attached;
  return()=>{attached.stop();if(control.current===attached)control.current=null;};
 },[context.projectId]);
 const listeners=useRef({onRecord:(record:any)=>control.current?.onRecord(record),onFailure:()=>control.current?.onFailure()});
 return listeners.current;
}
