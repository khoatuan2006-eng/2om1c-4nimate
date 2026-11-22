import React,{useState} from 'react';
import {prepareExportOwnerRequest} from './export-owner-request.mjs';
export function ExportOwnerRequest({projectId,request,onPrepared}:any){
 const [text,setText]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 return <details className="export-owner-request"><summary>Xác nhận xuất của chủ Studio</summary><p>Chủ Studio xác nhận đúng bản dựng và độ phân giải trong phiên máy chủ. Xác nhận có hiệu lực 10 phút cho một yêu cầu. Sau đó bấm kiểm tra yêu cầu trước để tiếp tục.</p><button disabled={busy} onClick={async()=>{
  setBusy(true);setMessage('');setText('');try{
   const value=JSON.stringify(await prepareExportOwnerRequest(projectId,request));setText(value);onPrepared?.();
   try{await navigator.clipboard.writeText(value);setMessage('Đã sao chép yêu cầu cho chủ Studio.');}catch{setMessage('Chọn và sao chép yêu cầu bên dưới.');}
  }catch(e:any){setMessage(e.message);}finally{setBusy(false);}
 }}>Chuẩn bị yêu cầu xác nhận</button>{message&&<p role="status">{message}</p>}{text&&<textarea aria-label="Yêu cầu xác nhận xuất cho chủ Studio" readOnly value={text} rows={4}/>}</details>;
}
