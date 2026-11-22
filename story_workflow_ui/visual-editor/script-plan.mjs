import {inspectProduction} from './production-contract.mjs';
import {createHash} from 'node:crypto';
import {validateDocument} from './model.mjs';
const fail=message=>{throw Error(message);};
const hash=value=>createHash('sha256').update(value).digest('hex');
const span=(s,text)=>s&&Number.isInteger(s.start)&&Number.isInteger(s.end)&&s.start>=0&&s.end>s.start&&text.slice(s.start,s.end)===s.quote;
const range=(v,d)=>Number.isInteger(v.from)&&Number.isInteger(v.to)&&v.from>=0&&v.to<=d&&v.to>v.from;
/** Traceable story units -> existing editor schema. Structural checks never imply visual approval. */
export function compileScriptPlan(plan){
 if(plan?.version!==1||typeof plan.sourceText!=='string'||!plan.sourceText.length)fail('Thiếu nguyên văn kịch bản');
 if(!/^[A-Za-z0-9-]{1,120}$/.test(plan.id)||!plan.title?.trim()||plan.title.length>100)fail('Mã/tên scene không hợp lệ');
 const d=plan.duration;
 if(!Number.isInteger(d)||d<1||d>108000)fail('Thời lượng không hợp lệ');
 if(!Array.isArray(plan.tasks)||!plan.tasks.length||!Array.isArray(plan.cues)||!plan.cues.length)fail('Thiếu nhiệm vụ hoặc lời đọc');
 const aliases=Object.entries(plan.identityAliases??{});
 const spoken=text=>aliases.reduce((value,[from,to])=>value.replaceAll(from,to),text).replace(/\s+/g,' ').trim();
 const cues=new Map();let cursor=0;
 for(const c of plan.cues){
  if(cues.has(c.cueId)||!c.cueId||!range(c,d)||c.from!==cursor||!span(c.source,plan.sourceText)||!c.text?.trim()||!/^audio\/[a-f0-9]{64}\.mp3$/.test(c.publicPath))fail('Cue thiếu, trùng, sai nguồn hoặc thời gian');
  if(spoken(c.source.quote)!==spoken(c.text))fail('Lời đọc không khớp nguyên văn/ánh xạ');
  cues.set(c.cueId,c);cursor=c.to;
 }if(cursor!==d)fail('Audio không phủ hết đoạn');
 const seen=new Map();cursor=0;let sourceEnd=-1;
 for(const t of plan.tasks){
  if(t.screenText!==undefined&&(typeof t.screenText!=='string'||t.screenText.length>1000))fail('Thông tin trên hình không hợp lệ');
  const c=cues.get(t.cueId);
  if(seen.has(t.id)||!t.id||!range(t,d)||t.from!==cursor||!span(t.source,plan.sourceText)||t.source.start<sourceEnd||!c||t.from<c.from||t.to>c.to||t.source.start<c.source.start||t.source.end>c.source.end)fail('Task sai nguồn, thứ tự hoặc cue');
  if(!t.actor||!t.action||!t.before||!t.after||!t.recipe||(!Array.isArray(t.visibleRequirements)||!t.visibleRequirements.length||t.visibleRequirements.some(v=>typeof v!=='string'||!v.trim()))||!Array.isArray(t.dependsOn)||t.dependsOn.some(id=>!seen.has(id)||seen.get(id).to>t.from))fail('Task thiếu diễn biến hoặc phụ thuộc không hợp lệ');
  if(!Array.isArray(t.layerIds)||!t.layerIds.length||t.layerIds.some(id=>!plan.document?.layers?.[id]?.asset||plan.document.layers[id].asset.from>t.from||plan.document.layers[id].asset.to<t.to))fail('Task chưa có layer phủ thời gian');
  for(const gap of t.gaps??[])if(!gap.missing||!gap.solution||!gap.status)fail('Khoảng trống chưa có phương án xử lý');
  seen.set(t.id,t);cursor=t.to;sourceEnd=t.source.end;
 }if(cursor!==d)fail('Task không phủ hết đoạn');
 for(const c of plan.cues)for(let i=c.source.start;i<c.source.end;i++)if(!/\s/.test(plan.sourceText[i])&&!plan.tasks.some(t=>i>=t.source.start&&i<t.source.end))fail('Bỏ sót nội dung nguồn trong cue');
 cursor=0;
 for(const s of plan.shots??[]){if(!range(s,d)||s.from!==cursor||!s.taskIds?.length||s.taskIds.some(id=>!seen.has(id)||seen.get(id).from<s.from||seen.get(id).to>s.to))fail('Shot không khớp task');cursor=s.to;}
 if(cursor!==d||plan.tasks.some(t=>plan.shots.filter(s=>s.taskIds.includes(t.id)).length!==1))fail('Shot thiếu hoặc trùng task');
 const document=validateDocument(structuredClone(plan.document),d);
 if(document.revision!==0||Object.keys(document.layers).some(id=>!id.startsWith(plan.id+'/shot-')))fail('Sai namespace/revision scene nhập');
 if(document.production){const check=inspectProduction(plan.tasks,document);if(!check.ok)fail(check.errors.join('; '));}
 return {source:{id:plan.id,title:plan.title,kind:'created',fps:30,duration:d,cues:plan.cues,shots:plan.shots,subtitleCues:plan.tasks.map(t=>({from:t.from,to:t.to,text:t.subtitle??spoken(t.source.quote)})),scriptPlan:{version:1,productionContractVersion:document.production?.version??null,digest:hash(JSON.stringify(plan)),sourceHash:hash(plan.sourceText),sourceText:plan.sourceText,tasks:plan.tasks.map(t=>({...t,gaps:t.gaps??[]})),resources:plan.resources??[],status:'preview-needs-review',coverage:'source-and-structure-only'}},document};
}
