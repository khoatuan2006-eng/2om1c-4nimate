import {createContext,useContext,useEffect,useRef,useState} from 'react';
import type {PlayerRef} from '@remotion/player';
export function useTransport({ready,totalFrames,scope,onSeek}:{ready:boolean;totalFrames:number;scope:string;onSeek:()=>void}){
 const player=useRef<PlayerRef>(null);
 const [frame,setFrame]=useState(0),[playing,setPlaying]=useState(false);
 useEffect(()=>{const p=player.current;if(!p||!ready)return;
  setFrame(p.getCurrentFrame());setPlaying(p.isPlaying());
  const update=(e:{detail:{frame:number}})=>setFrame(e.detail.frame),play=()=>setPlaying(true),pause=()=>setPlaying(false);
  p.addEventListener('frameupdate',update);p.addEventListener('play',play);p.addEventListener('pause',pause);p.addEventListener('ended',pause);
  return()=>{p.removeEventListener('frameupdate',update);p.removeEventListener('play',play);p.removeEventListener('pause',pause);p.removeEventListener('ended',pause);};
 },[ready,scope]);
 const seek=(target:number)=>{if(!Number.isFinite(target))return;player.current?.pause();player.current?.seekTo(Math.max(0,Math.min(totalFrames-1,Math.round(target))));onSeek();};
 return {player,frame,setFrame,playing,setPlaying,seek,totalFrames};
}
export const TransportContext=createContext<ReturnType<typeof useTransport>|null>(null);
export function useTransportContext(){const context=useContext(TransportContext);if(!context)throw Error('Transport provider missing');return context;}
