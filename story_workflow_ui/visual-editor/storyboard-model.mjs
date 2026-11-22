const statuses=['todo','needs-resource','ready-for-preview'];
export function replaceStoryboardAsset(document,id,selection){
 const previous=document.layers[id]?.asset;
 if(!previous||previous.type!==selection.type||!Number.isFinite(selection.width)||!Number.isFinite(selection.height)||selection.width<=0||selection.height<=0||!Array.isArray(selection.parts)||!selection.parts.length)throw Error('Tài nguyên thay thế không cùng loại hoặc thiếu kích thước');
 const factor=(previous.type==='backgrounds'?Math.max:Math.min)(previous.width/selection.width,previous.height/selection.height);
 const dx=(previous.width-selection.width*factor)/2,dy=previous.type==='characters'?previous.height-selection.height*factor:(previous.height-selection.height*factor)/2;
 const next=structuredClone(document);next.layers[id].asset={...previous,name:selection.name,...(selection.poseKey?{poseKey:selection.poseKey}:{}),parts:selection.parts.map(p=>({...p,left:dx+p.left*factor,top:dy+p.top*factor,width:p.width*factor,height:p.height*factor}))};return next;
}
export function validateStoryboard(value){
 if(value===undefined)return;
 if(!value||value.version!==1||!value.tasks||typeof value.tasks!=='object'||Array.isArray(value.tasks)||Object.keys(value.tasks).length>2000)throw Error('Dữ liệu storyboard không hợp lệ');
 for(const [id,entry] of Object.entries(value.tasks)){
  if(!id||id.length>1500||!entry||typeof entry!=='object'||Array.isArray(entry))throw Error('Việc storyboard không hợp lệ');
  for(const [key,text] of Object.entries(entry))if(!['intent','narrationDraft','notes','resourceRequest','status'].includes(key)||typeof text!=='string'||text.length>4000||(key==='status'&&!statuses.includes(text)))throw Error('Trường storyboard không hợp lệ: '+key);
 }
}
export function storyboardRows(project){return project.scenes.flatMap(scene=>scene.shots.map((shot,index)=>{
 const tasks=(scene.scriptPlan?.tasks??[]).filter(t=>t.from>=shot.from&&t.to<=shot.to);
 const cues=(scene.cues??[]).filter(c=>c.from<shot.to&&c.to>shot.from);
 return {id:scene.id+':'+shot.from,sceneId:scene.id,sceneTitle:scene.title,index,from:shot.from,to:shot.to,label:shot.label??'Shot '+(index+1),tasks,cues,locked:project.lockedPrefix?.includes(scene.id)??false,document:scene.document,source:scene};
}));}
export function patchStoryboard(source,document,taskId,changes){
 if(!source.scriptPlan?.tasks.some(t=>t.id===taskId))throw Error('Không tìm thấy việc trong kịch bản của scene');
 if(!changes||Array.isArray(changes)||typeof changes!=='object')throw Error('Thay đổi không hợp lệ');
 const allowed=['intent','narrationDraft','notes','resourceRequest','status'];
 for(const [key,value] of Object.entries(changes))if(!allowed.includes(key)||typeof value!=='string'||value.length>4000||(key==='status'&&!statuses.includes(value)))throw Error('Trường storyboard không hợp lệ: '+key);
 const next=structuredClone(document);next.storyboard??={version:1,tasks:{}};
 if(next.storyboard.version!==1||!next.storyboard.tasks)throw Error('Storyboard cần phiên bản editor mới hơn');
 next.storyboard.tasks[taskId]={...next.storyboard.tasks[taskId],...changes};validateStoryboard(next.storyboard);return next;
}
