// A saved production draft. Existing project scenes remain the playback authority.
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fail=message=>{throw Error(message);};
export function newEpisodeRow(id,text=''){
 return {id,title:'Cảnh mới',text,seconds:8,backgroundId:'',characters:[],assemblyIds:[],camera:'off',before:'',action:'',after:'',notes:''};
}
export function emptyEpisodeWorkflow(){return {version:1,revision:0,step:0,script:'',voiceId:'',audioMode:'silent',rows:[]};}
export function splitEpisodeScript(script,newId,mode='paragraph'){
 const text=script.trim();if(!text)return [];
 // Delimiters are explicit; no inferred direction or invented events.
 const blocks=text.split(mode==='line'?/\r?\n/:/\r?\n\s*\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(blocks.length>100)fail('Tối đa 100 cảnh mỗi tập. Hãy chia kịch bản thành các tập nhỏ hơn.');
 return blocks.map((block,i)=>({...newEpisodeRow(newId(),block),title:'Cảnh '+(i+1)}));
}
export function validateEpisodeWorkflow(input){
 if(!input||input.version!==1||!Number.isSafeInteger(input.revision)||input.revision<0||!Number.isInteger(input.step)||input.step<0||input.step>4)fail('Nháp tập phim không hợp lệ.');
 const text=(v,max)=>typeof v==='string'&&v.length<=max;
 if(!text(input.script,150000)||!text(input.voiceId,100)||!['silent','voice'].includes(input.audioMode)||!Array.isArray(input.rows)||input.rows.length>100)fail('Kịch bản hoặc giọng đọc không hợp lệ.');
 const ids=new Set();
 const rows=input.rows.map(row=>{
  if(!row||!uuid.test(row.id)||ids.has(row.id))fail('Mã cảnh bị trùng hoặc không hợp lệ.');ids.add(row.id);
  if(!text(row.title,100)||!text(row.text,200000)||row.text.split(/\r?\n/).filter(s=>s.trim()).length>100||row.text.split(/\r?\n/).some(s=>s.length>2000))fail('Tên cảnh tối đa 100 ký tự; nội dung tối đa 100 dòng, 2.000 ký tự mỗi dòng.');
  if(!Number.isFinite(row.seconds)||row.seconds<1||row.seconds>600||!text(row.backgroundId,100)||!['off','pan-right','pan-left','push-in'].includes(row.camera))fail('Thời lượng, nền hoặc camera không hợp lệ.');
  if(!Array.isArray(row.characters)||row.characters.length>8||row.characters.some(c=>!c||!text(c.catalogId,250)||!Array.isArray(c.itemIds)||c.itemIds.length<1||c.itemIds.length>2||c.itemIds.some(id=>!text(id,100))))fail('Chọn tối đa 8 nhân vật với pose và khuôn mặt.');
  if(!Array.isArray(row.assemblyIds)||row.assemblyIds.length>12||new Set(row.assemblyIds).size!==row.assemblyIds.length||row.assemblyIds.some(id=>!uuid.test(id)))fail('Bộ đối tượng không hợp lệ.');
  if(['before','action','after','notes'].some(k=>!text(row[k],3000)))fail('Ghi chú cảnh quá dài.');
  return {id:row.id,title:row.title.trim(),text:row.text,seconds:row.seconds,backgroundId:row.backgroundId,characters:structuredClone(row.characters),assemblyIds:[...row.assemblyIds],camera:row.camera,before:row.before,action:row.action,after:row.after,notes:row.notes};
 });
 return {version:1,revision:input.revision,step:input.step,script:input.script,voiceId:input.voiceId,audioMode:input.audioMode,rows};
}
export const episodeSceneId=row=>'EP-'+row.id;
export function episodeReadiness(row,workflow){
 const errors=[];
 if(!row.title.trim())errors.push('Chưa đặt tên cảnh');
 if(!row.text.trim())errors.push('Chưa nhập lời kể / nội dung');
 if(!row.backgroundId&&!row.assemblyIds.length)errors.push('Chưa chọn nền hoặc bộ bối cảnh');
 if(workflow.audioMode==='voice'&&!workflow.voiceId)errors.push('Chưa chọn giọng đọc');
 return errors;
}
