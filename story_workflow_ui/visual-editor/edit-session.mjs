import {validateDocument} from './model.mjs';
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
async function readReply(response){
 const invalid=()=>Object.assign(Error('Chưa nhận được xác nhận hợp lệ từ máy chủ. Chỉnh sửa được giữ nguyên; kiểm tra kết nối rồi thử lại.'),{status:response.status,code:'INVALID_RESPONSE'});
 const data=await response.json().catch(()=>{throw invalid();});
 if(!data||typeof data!=='object'||Array.isArray(data))throw invalid();
 if(!response.ok)throw Object.assign(Error(typeof data.error==='string'?data.error:'Máy chủ chưa xử lý được yêu cầu. Hãy thử lại.'),{status:response.status,...(typeof data.code==='string'?{code:data.code}:{})});
 return data;
}
function checkDocument(document,scene,duration){
 try{validateDocument(document,duration);if(!Number.isSafeInteger(document.revision)||Object.keys(document.layers).some(id=>!id.startsWith(scene+'/shot-')))throw Error('Foreign scene');}
 catch{throw Object.assign(Error('Bản chỉnh sửa trả về không hợp lệ hoặc không thuộc scene này. Chỉnh sửa hiện tại được giữ nguyên.'),{code:'INVALID_RESPONSE'});}
 return document;
}
export class EditSession {
 constructor(){this.key=null;this.epoch=0;this.busy=false;}
 select(key){if(this.key!==key){this.key=key;this.epoch++;}}
 capture(){const epoch=this.epoch;return ()=>this.epoch===epoch;}
 async exclusive(task){
  if(this.busy)throw Error('Chờ thao tác hiện tại hoàn tất.');
  this.busy=true;try{return await task();}finally{this.busy=false;}
 }
}
export async function saveEdits({session,projectId,scene,document,revision,duration=Number.MAX_SAFE_INTEGER,onSaved,onError,fetcher=fetch}){
 const current=session.capture(),snapshot=structuredClone(document);
 try{
  const response=await fetcher(`/api/edits?scene=${encodeURIComponent(scene)}&project=${encodeURIComponent(projectId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...snapshot,revision}),signal:AbortSignal.timeout(15000)});
  const data=checkDocument(await readReply(response),scene,duration);
  if(data.revision!==revision+1||stable(data.layers)!==stable(snapshot.layers))throw Object.assign(Error('Máy chủ chưa xác nhận đúng bản chỉnh sửa vừa gửi. Nháp được giữ nguyên; thử lưu lại để kiểm tra bản mới.'),{code:'INVALID_SAVE_ACK'});
  if(current())onSaved(data,snapshot);return {ok:true,current:current()};
 }catch(error){if(current())onError(error);return {ok:false,current:current(),error};}
}
export async function loadLatestEdits({session,projectId,scene,duration=Number.MAX_SAFE_INTEGER,fetcher=fetch}){
 const current=session.capture();
 const response=await fetcher(`/api/edits?scene=${encodeURIComponent(scene)}&project=${encodeURIComponent(projectId)}`,{signal:AbortSignal.timeout(15000),cache:'no-store'});
 const document=checkDocument(await readReply(response),scene,duration);
 return {document,current:current()};
}
export function prepareConflictResolution({choice,local,server,archive}){
 if(!['local','server'].includes(choice))throw Error('Chọn bản cần giữ.');
 if(!Number.isSafeInteger(server?.revision)||server.revision<0)throw Error('Cần đọc bản mới trước khi giải quyết xung đột.');
 const snapshot=structuredClone(local);
 if(archive(snapshot)!==true)throw Error('Chưa lưu được bản nháp dự phòng. Chỉnh sửa hiện tại được giữ nguyên; kiểm tra bộ nhớ trình duyệt rồi thử lại.');
 return {...structuredClone(choice==='local'?snapshot:server),revision:server.revision};
}
export function isSceneLockedError(error){
 return error?.code==='SCENE_LOCKED'||(error?.status===409&&!error?.code&&error?.message?.includes('Scene đã được duyệt và khóa'));
}
export function isRevisionConflict(error){
 return error?.status===409&&!isSceneLockedError(error)&&(!error.code||error.code==='REVISION_CONFLICT'||error.code==='INVALID_RESPONSE');
}
export function saveFailureMessage(error,operation='save'){
 if(isSceneLockedError(error))return 'Scene đã được duyệt và khóa. Bản gốc được bảo vệ; chỉnh sửa chưa lưu vẫn được giữ trong nháp. Không thể ghi đè bằng cách chọn bản cần giữ.';
 if(isRevisionConflict(error))return 'Scene đã thay đổi ở cửa sổ khác. Chỉnh sửa của bạn vẫn được giữ; xem bản mới trước khi chọn bản cần lưu.';
 if(error.name==='TypeError'||error.name==='TimeoutError'||error.name==='AbortError')return operation==='read'?'Chưa kết nối được để đọc bản mới. Nháp và chỉnh sửa hiện tại được giữ nguyên; kiểm tra kết nối rồi thử lại.':'Chưa kết nối được để lưu. Chỉnh sửa vẫn ở trong phiên này; kiểm tra kết nối rồi thử lưu lại.';
 return error.message||'Chưa lưu được chỉnh sửa. Hãy thử lại.';
}
export async function restoreEdits({session,projectId,scene,revision,restoreRevision,duration=Number.MAX_SAFE_INTEGER,fetcher=fetch}){
 const current=session.capture();
 const response=await fetcher(`/api/projects/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(scene)}/restore`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,restoreRevision}),signal:AbortSignal.timeout(15000)});
 const document=checkDocument(await readReply(response),scene,duration);
 if(document.revision!==revision+1)throw Object.assign(Error('Chưa xác nhận được phiên bản khôi phục. Bản hiện tại được giữ nguyên; đọc lại bản mới trước khi tiếp tục.'),{code:'INVALID_RESTORE_ACK'});
 return {document,current:current()};
}
