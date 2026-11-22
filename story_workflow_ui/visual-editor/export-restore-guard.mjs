import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {recordedWorkerState} from './process-identity.mjs';
const terminal=new Set(['complete','failed','cancelled']);
export async function assertExportsStopped(dataDirectory){
 const root=resolve(dataDirectory,'exports');let ids;
 try{ids=await readdir(root);}catch(error){if(error.code==='ENOENT')return;throw error;}
 for(const id of ids.filter(id=>/^[a-f0-9-]{36}$/.test(id))){
  const folder=resolve(root,id),job=JSON.parse(await readFile(resolve(folder,'job.json'),'utf8'));
  // A queued job without a PID may have been interrupted during spawn. Resolve
  // its state in the editor before replacing the data directory; do not guess.
  if(!terminal.has(job.status))throw Error('Còn phiên xuất chưa kết thúc. Mở editor để kiểm tra/hủy và chờ kết quả trước khi phục hồi dữ liệu.');
  const record=await readFile(resolve(folder,'worker.json'),'utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  if(await recordedWorkerState(job,record)!=='gone')throw Error('Worker xuất vẫn sống hoặc chưa xác minh được danh tính. Giữ dữ liệu hiện tại và chờ worker thoát trước khi phục hồi.');
 }
}
