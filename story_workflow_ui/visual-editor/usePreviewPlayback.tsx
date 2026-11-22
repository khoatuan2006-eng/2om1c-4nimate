import {useEffect,useRef} from 'react';
import {attachPlaybackReporter} from './playback-reporter.mjs';
export function usePreviewPlayback({player,enabled,projectId,sceneId,documentRevision,scope,onError,onRecord,onFailure}:any){
 const listeners=useRef({onRecord,onFailure});listeners.current={onRecord,onFailure};
 useEffect(()=>{
  const p=player.current;if(!enabled||!p)return;
  return attachPlaybackReporter(p,{sceneId,documentRevision,onError:()=>{listeners.current.onFailure?.();onError('Chưa ghi nhận được lượt xem bản đã lưu. Phát lại cảnh để kiểm tra.');},post:async(body:any)=>{
   const response=await fetch('/api/preview-playback/'+projectId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await response.json();if(!response.ok)throw Error(data.error);await listeners.current.onRecord?.(data);return data;
  }});
 },[player,enabled,projectId,sceneId,documentRevision,scope,onError]);
}
