// Event adapter only: the server verifies saved identity, elapsed time and ranges.
export function attachPlaybackReporter(player,{post,sceneId,documentRevision,onError=()=>{},now=Date.now}){
 let active=null;
 const sample=(ended=false)=>{
  const current=active;if(!current)return;
  const stamp=now();if(!ended&&stamp-current.lastSend<700)return;current.lastSend=stamp;
  const frame=player.getCurrentFrame();if(ended)active=null;
  current.chain=current.chain.then(()=>post({playbackId:current.id,frame,ended})).catch(e=>{if(active===current)active=null;onError(e);});
 };
 const begin=()=>{
  if(active)sample(true);
  const current={lastSend:now(),id:null};active=current;
  current.chain=post({sceneId,documentRevision,frame:player.getCurrentFrame()}).then(result=>{current.id=result.playbackId;}).catch(e=>{if(active===current)active=null;onError(e);});
 };
 const frame=()=>{if(player.isPlaying())sample();},end=()=>sample(true);
 player.addEventListener('play',begin);player.addEventListener('frameupdate',frame);player.addEventListener('pause',end);player.addEventListener('ended',end);
 if(player.isPlaying())begin();
 return ()=>{end();player.removeEventListener('play',begin);player.removeEventListener('frameupdate',frame);player.removeEventListener('pause',end);player.removeEventListener('ended',end);};
}
