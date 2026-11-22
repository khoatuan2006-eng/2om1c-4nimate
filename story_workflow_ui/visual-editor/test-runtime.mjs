import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,relative,isAbsolute,basename} from 'node:path';
// Each node:test file runs in a separate process; configure before importing route modules.
export async function testRuntime(options={}){
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-'));
 process.env.EDITOR_DATA_DIR=join(folder,'data');process.env.EDITOR_SKIP_LEGACY_MIGRATION='1';
 process.env.EDITOR_LIBRARY_DIR=join(folder,'library');process.env.EDITOR_FILM_LIBRARY_DIR=join(folder,'film-library');process.env.EDITOR_IMPORTS_DIR=join(folder,'imports');
 const frontendRoot=join(folder,'frontend');await mkdir(frontendRoot,{recursive:true});
 await writeFile(join(frontendRoot,'index.html'),'<!doctype html><title>Isolated editor fixture</title>');
 await mkdir(join(folder,'data','media','images'),{recursive:true});
 const {createEditorRuntime}=await import('./runtime-server.mjs');
 const {getProjectStore}=await import('./project-store.mjs');
 const app=await createEditorRuntime({frontendRoot,log:()=>{},...options}),address=await app.listen(0),base=`http://127.0.0.1:${address.port}`,store=getProjectStore();
 const request=(path,body,method='POST',origin=base)=>fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 return {folder,frontendRoot,base,store,app,request,async close(){await app.close();store.close();await removeTestFolder(folder);}};
}
export async function removeTestFolder(folder){
 const target=resolve(folder),rel=relative(resolve(tmpdir()),target);
 if(isAbsolute(rel)||rel.startsWith('..')||!basename(target).startsWith('doyin-editor-test-'))throw Error('Refusing to remove a folder outside isolated test storage.');
 await rm(target,{recursive:true,force:true});
}
