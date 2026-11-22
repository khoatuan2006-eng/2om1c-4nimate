// Prepare the exact owner request; this does NOT grant export authorization.
export async function prepareExportOwnerRequest(projectId,request,fetchImpl=fetch){
 if(!/^[a-zA-Z0-9-]{1,150}$/.test(projectId??'')||!/^[a-f0-9-]{36}$/.test(request?.requestId??'')||![1,.5].includes(request?.scale))throw Error('Yêu cầu xuất không hợp lệ.');
 const path='/api/production-workflows/'+projectId;
 const response=await fetchImpl(path),state=await response.json();if(!response.ok)throw Error(state.error);
 if(!(state.canPublish??state.canExpand))throw Error('Cần hoàn tất kiểm tra bản dựng trước khi xin xác nhận xuất.');
 // The backend rechecks current evidence and races; GET canExpand alone is not
 // the durable complete receipt required by the independent owner console.
 const transition=await fetchImpl(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.projectRevision,action:'complete'})}),saved=await transition.json();
 if(!transition.ok)throw Error(saved.error);
 if(!saved.receipt||saved.receipt.action!=='complete'||saved.receipt.fingerprint!==saved.fingerprint)throw Error('Chưa xác nhận được phiên bản nguồn để xuất.');
 return {command:'authorize-export',projectId,revision:saved.projectRevision,fingerprint:saved.fingerprint,requestId:request.requestId,scale:request.scale};
}
