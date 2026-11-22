// Beats: one structure for "what this scene must tell". Each beat ties a quote of the
// narration to who does what, the frames that show it, the layers that carry it, and a review.
// Intended to replace scriptPlan.tasks + document.storyboard + storyChains over time.
export const BEAT_VERSION=1;
export const reviewStatuses=Object.freeze(['pending','ok','issue']);
const text=(value,max,name,required=false)=>{
  if(value===undefined&&!required)return;
  if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error('Beat: '+name+' không hợp lệ');
};

/** Structural validation, run on every document save. Layer links must point at layers of this document. */
export function validateBeats(beats,duration,layers={}){
  if(beats===undefined)return;
  if(!beats||beats.version!==BEAT_VERSION||!Array.isArray(beats.items)||beats.items.length>500)throw Error('Danh sách beat không hợp lệ');
  const ids=new Set();
  for(const beat of beats.items){
    if(!beat||typeof beat!=='object'||Array.isArray(beat))throw Error('Beat không hợp lệ');
    if(typeof beat.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(beat.id)||ids.has(beat.id))throw Error('Beat id trùng hoặc không hợp lệ: '+beat.id);ids.add(beat.id);
    for(const key of Object.keys(beat))if(!['id','quote','actor','action','before','after','from','to','layerIds','review'].includes(key))throw Error('Beat có trường lạ: '+key);
    text(beat.quote,2000,'quote',true);text(beat.actor,200,'actor',true);text(beat.action,1000,'action',true);
    text(beat.before,1000,'before');text(beat.after,1000,'after');
    if(!Number.isInteger(beat.from)||!Number.isInteger(beat.to)||beat.from<0||beat.to>duration||beat.from>=beat.to)throw Error('Beat '+beat.id+': khoảng frame không hợp lệ');
    if(!Array.isArray(beat.layerIds)||beat.layerIds.length>50||beat.layerIds.some(id=>typeof id!=='string'||!layers[id]))throw Error('Beat '+beat.id+': layerIds phải trỏ tới layer có thật');
    if(beat.review!==undefined){
      const r=beat.review;if(!r||typeof r!=='object'||!reviewStatuses.includes(r.status))throw Error('Beat '+beat.id+': review không hợp lệ');
      for(const key of Object.keys(r))if(!['status','note','by','at'].includes(key))throw Error('Beat review có trường lạ: '+key);
      text(r.note,2000,'review.note');text(r.by,100,'review.by');text(r.at,40,'review.at');
      if(r.status==='issue'&&!r.note?.trim())throw Error('Beat '+beat.id+': review "issue" cần ghi chú lỗi');
    }
  }
}

/** Content check for publishing. Returns blocking errors and non-blocking warnings; never approves by itself. */
export function inspectBeats(scene){
  const beats=scene.document?.beats?.items??[],errors=[],warnings=[];
  if(!beats.length){errors.push('chưa có beat');return {errors,warnings,beats:0,reviewed:0};}
  const sorted=[...beats].sort((a,b)=>a.from-b.from);
  if(sorted[0].from>0)warnings.push('frame 0–'+sorted[0].from+' không thuộc beat nào');
  for(let i=1;i<sorted.length;i++)if(sorted[i].from>sorted[i-1].to)warnings.push('khoảng trống frame '+sorted[i-1].to+'–'+sorted[i].from);
  const end=Math.max(...sorted.map(b=>b.to));if(Number.isInteger(scene.duration)&&end<scene.duration)warnings.push('frame '+end+'–'+scene.duration+' không thuộc beat nào');
  for(const beat of beats){
    if(!beat.layerIds.length)errors.push('beat '+beat.id+' chưa gắn layer');
    const status=beat.review?.status??'pending';
    if(status==='pending')errors.push('beat '+beat.id+' chưa review');
    if(status==='issue')errors.push('beat '+beat.id+' còn lỗi: '+beat.review.note);
  }
  return {errors,warnings,beats:beats.length,reviewed:beats.filter(b=>b.review?.status==='ok').length};
}

/** Draft beats from what a scene already has: one beat per narration cue, linked to every visible layer in its range.
 *  Actor/action are placeholders the author must rewrite; review starts pending. */
export function draftBeatsFromScene(scene){
  const cues=(scene.cues??[]).filter(c=>c.text?.trim());
  const layers=Object.entries(scene.document?.layers??{});
  return {version:BEAT_VERSION,items:cues.map((cue,i)=>({id:'b'+(i+1),quote:cue.text.trim(),actor:'?',action:'(cần viết lại) '+cue.text.trim(),
    from:Math.max(0,cue.from),to:Math.min(scene.duration,cue.to),
    layerIds:layers.filter(([,l])=>l.asset&&l.asset.from<cue.to&&l.asset.to>cue.from).map(([id])=>id),review:{status:'pending'}}))};
}
