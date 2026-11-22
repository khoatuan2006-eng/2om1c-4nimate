// Presentation only: never infer a save acknowledgement from an activity message.
const routine=/^(?:Đã mở .+ · bản \d+|Đã lưu · bản \d+|Đã dùng bản trên máy chủ · bản \d+\. Nháp trước đó đã được giữ\.|Đã khôi phục bản \d+ · lưu thành bản \d+|Đã khôi phục chỉnh sửa chưa lưu)$/;
export function editorStatus({status,dirty,saving,projectBusy,ready,timelineMode,sceneLabel,revision,projectAvailable,projectLoading}){
 if(projectBusy)return 'Đang cập nhật dự án…';
 if(!projectAvailable&&!projectLoading)return 'Chưa mở được dự án';
 if(saving)return `Đang lưu ${sceneLabel} vào dự án…`;
 if(dirty){
  const description=routine.test(status)?`${sceneLabel} · bản máy chủ ${revision}`:status;
  return '● Chưa lưu · '+description;
 }
 if(ready&&timelineMode==='film'&&routine.test(status))return 'Toàn phim · đang xem bản đã lưu';
 return status;
}
