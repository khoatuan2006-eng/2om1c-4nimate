/** Compile an attention edit into existing authoring operations; no identity or episode constants. */
export function compileAttentionCut({document,actorLayerId,backgroundLayerId,neutralLayerId,from,to,faceEnd,targets,actorPlacement}){
 const actor=document.layers[actorLayerId]?.asset,bg=document.layers[backgroundLayerId]?.asset;
 if(actor?.type!=='characters'||bg?.type!=='backgrounds'||actor.from!==from||actor.to!==to||bg.from!==from||bg.to!==to)throw Error('Attention cut cần actor/background cùng khoảng task');
 if(!Number.isInteger(faceEnd)||faceEnd<=from||faceEnd>=to||!Array.isArray(targets)||!targets.length)throw Error('Thiếu nhịp mặt/mục tiêu');
 let cursor=faceEnd;for(const t of targets){if(t.from!==cursor||!Number.isInteger(t.to)||t.to<=t.from||t.to>to||![t.u,t.v,t.scale].every(Number.isFinite)||t.u<0||t.u>1||t.v<0||t.v>1||t.scale<1||t.scale>5)throw Error('Mục tiêu không liên tục hoặc sai khung');cursor=t.to;}if(cursor!==to)throw Error('Mục tiêu chưa phủ hết nhịp');
 const commands=[{op:'replace-from-layer',layerId:actorLayerId,sourceLayerId:neutralLayerId},{op:'transform',layerId:actorLayerId,values:{rotation:0,flipX:false}},{op:'place',layerId:actorLayerId,placement:actorPlacement},{op:'set-range',layerId:actorLayerId,from,to:faceEnd},{op:'transform',layerId:backgroundLayerId,frame:from,values:{x:0,y:0,scale:1},easing:'hold'}];
 for(const t of targets){
  if(bg.width*t.scale<1920||bg.height*t.scale<1080)throw Error('Khung mục tiêu chưa phủ viewport');
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  commands.push({op:'transform',layerId:backgroundLayerId,frame:t.from,values:{scale:t.scale,x:clamp(960-(t.u-.5)*bg.width*t.scale,1920-bg.width*t.scale/2,bg.width*t.scale/2)-(bg.left+bg.width/2),y:clamp(540-(t.v-.5)*bg.height*t.scale,1080-bg.height*t.scale/2,bg.height*t.scale/2)-(bg.top+bg.height/2)},easing:'hold'});
 }
 return {commands,limitations:['Dựng sự chú ý bằng cắt mặt sang mục tiêu; không có pose ngước đầu thật.','Điểm mục tiêu phải được chọn và kiểm tra trên ảnh, không suy ra từ tên file.'],reviewFrames:[from,faceEnd,...targets.map(t=>t.to-1)]};
}
