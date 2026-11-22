import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {dataRoot} from './project-store.mjs';
import {createBackup,listBackups,verifyBackup,restoreBackup} from './backup-service.mjs';
const args=process.argv.slice(2),command=args[0],option=name=>args.find(arg=>arg.startsWith('--'+name+'='))?.slice(name.length+3);
const root=resolve(option('data-root')??dataRoot),id=option('id');
try{
 if(id&&!/^[a-f0-9-]{36}$/.test(id))throw Error('Mã sao lưu không hợp lệ.');
 const folder=option('backup')?resolve(option('backup')):id?resolve(root,'backups',id):null;
 let result;
 if(command==='create'){
  const db=new DatabaseSync(resolve(root,'projects.sqlite'),{readOnly:true});try{result=await createBackup({db},root);}finally{db.close();}
  result={id:result.id,folder:result.folder,files:result.files.length,totalBytes:result.totalBytes,database:result.database};
 }else if(command==='list')result=await listBackups(root);
 else if(command==='verify'&&folder){const verified=await verifyBackup(folder);result={id:verified.id,status:'verified',files:verified.files.length,database:verified.database};}
 else if(command==='restore'&&folder)result=await restoreBackup(folder,root);
 else throw Error('Dùng create | list | verify --id=<id> | restore --id=<id>. Đóng editor trước khi restore.');
 console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
