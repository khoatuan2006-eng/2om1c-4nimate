import {existsSync,readFileSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {readProcessIdentitySync,validProcessBirth} from './process-identity.mjs';
import {renameSyncWithRetry} from './atomic-write.mjs';
export function recoverInterruptedRestore(dataDirectory,{inspectProcess=readProcessIdentitySync}={}){
 const target=resolve(dataDirectory),file=target+'.restore-journal.json';if(!existsSync(file))return {status:'none'};
 const journal=JSON.parse(readFileSync(file,'utf8'));
 if(journal.version!==1||!/^[a-f0-9-]{36}$/.test(journal.id)||!Number.isSafeInteger(journal.pid)||journal.pid<=0||journal.target!==target||journal.stage!==target+'.restore-'+journal.id||journal.rollback!==target+'.rollback-'+journal.id)throw Error('Journal phục hồi không hợp lệ. Giữ nguyên dữ liệu để kiểm tra.');
 const owner=inspectProcess(journal.pid);if(owner.state!=='gone'&&!(owner.state==='alive'&&validProcessBirth(journal.birth)&&validProcessBirth(owner.birth)&&owner.birth!==journal.birth))throw Error('Một tiến trình đang phục hồi dữ liệu hoặc chưa xác minh được danh tính. Hãy chờ hoàn tất.');
 let status;
 if(!existsSync(target)&&existsSync(journal.rollback)){renameSyncWithRetry(journal.rollback,target);status='rolled-back';}
 else if(existsSync(target)&&existsSync(journal.rollback)){
  let receipt;try{receipt=JSON.parse(readFileSync(resolve(target,'restore-receipt.json'),'utf8'));}catch{}
  if(receipt?.restoreId!==journal.id)throw Error('Chưa xác định được bản dữ liệu sau phục hồi. Giữ nguyên thư mục rollback để kiểm tra.');status='committed';
 }else if(existsSync(target)&&!existsSync(journal.rollback))status='original-preserved';
 else throw Error('Không tìm thấy dữ liệu gốc hoặc rollback sau phục hồi.');
 unlinkSync(file);return {status};
}
