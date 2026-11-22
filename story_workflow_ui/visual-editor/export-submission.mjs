const key=projectId=>'doyin:export-pending:'+projectId;
const valid=value=>value&&typeof value.requestId==='string'&&/^[a-f0-9-]{36}$/.test(value.requestId)&&typeof value.projectId==='string'&&[1,.5].includes(value.scale);
export function pendingExport(storage,projectId){
 const raw=storage.getItem(key(projectId));if(raw===null)return null;
 let value;try{value=JSON.parse(raw);}catch{throw Error('Không đọc được yêu cầu xuất đã giữ trên trình duyệt. Giữ nguyên dữ liệu trước khi tiếp tục.');}
 if(!valid(value)||value.projectId!==projectId)throw Error('Yêu cầu xuất đã giữ không hợp lệ. Giữ nguyên dữ liệu trước khi tiếp tục.');
 return value;
}
export function reserveExport(storage,projectId,scale,requestId){
 const existing=pendingExport(storage,projectId);if(existing)return existing;
 const value={requestId,projectId,scale};if(!valid(value))throw Error('Thông tin yêu cầu xuất không hợp lệ.');
 try{storage.setItem(key(projectId),JSON.stringify(value));if(storage.getItem(key(projectId))!==JSON.stringify(value))throw Error('Write not confirmed');}
 catch{throw Error('Trình duyệt chưa giữ được mã yêu cầu xuất. Kiểm tra bộ nhớ trình duyệt rồi thử lại; chưa gửi yêu cầu xuất.');}
 return value;
}
export function acknowledgeExport(storage,request,job){
 if(job.requestId!==request.requestId||job.id!==request.requestId||job.projectId!==request.projectId||job.scale!==request.scale)throw Error('Chưa xác nhận được đúng yêu cầu xuất.');
 const pending=pendingExport(storage,request.projectId);
 if(pending?.requestId===request.requestId)storage.removeItem(key(request.projectId));
}
export function clearPendingExport(storage,projectId){
 storage.removeItem(key(projectId));
}
