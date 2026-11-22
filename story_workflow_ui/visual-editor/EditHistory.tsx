import React,{useEffect,useState} from 'react';
import {projectApi} from './ProjectPanels';
export function EditHistory({projectId,scene,revision,onRestore}:any){
  const [versions,setVersions]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{let live=true;projectApi(`/${projectId}/scenes/${scene}/history`).then(data=>{if(live)setVersions(data);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false};},[projectId,scene,revision]);
  return <div className="edit-history"><h3>Lịch sử scene</h3><p>Khôi phục tạo một phiên bản mới. Bạn vẫn có thể quay lại bản trước đó.</p><strong>Đang dùng · bản {revision}</strong>{!versions.length&&<p>Chưa có phiên bản cũ.</p>}{versions.map(v=><div key={v.revision}><span><b>Bản {v.revision}</b><small>{new Date(v.saved_at).toLocaleString('vi-VN')}</small></span><button disabled={busy} onClick={async()=>{setBusy(true);try{await onRestore(v.revision);setError('');}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>Khôi phục</button></div>)}{error&&<p role="alert">{error}</p>}</div>;
}
