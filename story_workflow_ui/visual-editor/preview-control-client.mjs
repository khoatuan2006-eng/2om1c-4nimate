// Bounded commands for the existing Studio Player, not a browser automation or
// rendering implementation. The server owns request identity and range checks.
export function attachPreviewControl({projectId,clientId,getContext,request,onError=message=>{},intervalMs=800,setTimer=setTimeout,clearTimer=clearTimeout}){
 const base='/api/preview-playback/'+projectId+'/requests';let active=null,disposed=false,available=true,timer,reloaded=null;
 const post=(r,body)=>request(base+'/'+r.requestId,{clientId,...body});
 const detach=a=>{a.player.removeEventListener('frameupdate',a.frame);};
 const fail=async(reason)=>{
  const a=active;if(!a)return;active=null;detach(a);try{a.player.pause();}catch{}
  try{await post(a.request,{action:'fail',reason});}catch{}
  if(!disposed)onError(reason);
 };
 const tick=async()=>{
  let candidate;
  try{
   if(disposed||!available)return;const ctx=getContext();
   if(active){
    if(!ctx.canPreview||ctx.sceneId!==active.request.sceneId||ctx.documentRevision!==active.request.documentRevision||ctx.player!==active.player)await fail('Bản dựng hoặc cửa sổ xem đã đổi; lượt phát yêu cầu đã dừng.');
    return;
   }
   if(!ctx.canPreview||!ctx.player||ctx.player.isPlaying())return;
   const pending=await request(base);if(disposed)return;const r=pending.requests[0];if(!r)return;candidate=r;
   if(ctx.sceneId!==r.sceneId||ctx.mode!=='scene'){ctx.selectScene(r.sceneId);return;}
   if(ctx.documentRevision!==r.documentRevision||!ctx.savedDocumentMatches){
    if(reloaded!==r.requestId){reloaded=r.requestId;ctx.reload();}return;
   }
   const claimed=await post(r,{action:'claim',documentRevision:ctx.documentRevision});if(claimed.status!=='claimed')throw Error('Studio preview request is not claimed');
   if(disposed){await post(claimed,{action:'fail',reason:'Studio closed before starting playback'});return;}
   // Recheck local draft/context after the async claim, before touching Player.
   const fresh=getContext();if(!fresh.canPreview||!fresh.savedDocumentMatches||fresh.sceneId!==r.sceneId||fresh.documentRevision!==r.documentRevision||fresh.player!==ctx.player){await post(claimed,{action:'fail',reason:'Studio draft changed while claiming playback'});return;}
   const a={request:claimed,player:fresh.player,playbackId:null,ending:false,frame:null};active=a;
   a.frame=()=>{if(active!==a||a.ending)return;if(a.player.getCurrentFrame()>=r.to-1){a.ending=true;a.player.pause();}};
   a.player.addEventListener('frameupdate',a.frame);a.player.seekTo(r.from);
   await Promise.resolve(a.player.play());
  }catch(error){
   if(active)await fail('Chưa phát được phạm vi yêu cầu: '+error.message);
   else if(candidate){try{await post(candidate,{action:'fail',reason:'Studio could not start requested playback: '+error.message});}catch{}if(!disposed)onError('Phạm vi phát đã thay đổi hoặc chưa khởi động được.');}
   else if(error.status===404)available=false; // Older runtime; no status spam.
   else if(!disposed&&error.status!==401)onError('Chưa kết nối được lượt phát yêu cầu.');
  }finally{if(!disposed&&available)timer=setTimer(()=>void tick(),intervalMs);}
 };
 const onRecord=async(record)=>{
  const a=active;if(!a||record.sceneId!==a.request.sceneId)return;
  try{
   if(!a.playbackId){await post(a.request,{action:'bind',playbackId:record.playbackId});a.playbackId=record.playbackId;}
   if(record.playbackId!==a.playbackId)throw Error('Player started a different playback session');
   if(record.closed){await post(a.request,{action:'finish',playbackId:record.playbackId});if(active===a){active=null;detach(a);}}
  }catch(error){await fail('Phạm vi phát chưa được xác nhận: '+error.message);}
 };
 timer=setTimer(()=>void tick(),intervalMs);
 return {onRecord,onFailure:()=>void fail('Ghi nhận playback bị gián đoạn; cần phát lại phạm vi yêu cầu.'),stop(){disposed=true;clearTimer(timer);void fail('Studio đã đóng hoặc đổi dự án.');}};
}
