import {realpath,readdir,readFile} from 'node:fs/promises';
import {resolve,join,extname,dirname} from 'node:path';
import {createHash} from 'node:crypto';
export async function runtimeIdentity({dataDirectory,frontendDirectory,editorDirectory=import.meta.dirname}){
 const paths=await Promise.all([editorDirectory,dataDirectory,frontendDirectory].map(async path=>{
  let canonical;try{canonical=await realpath(path);}catch(error){if(error.code!=='ENOENT')throw error;canonical=resolve(path);}
  return process.platform==='win32'?canonical.toLowerCase():canonical;
 }));
 return createHash('sha256').update(JSON.stringify(paths)).digest('hex');
}
// Hash application inputs, never mutable projects, media, credentials or QA output.
const excluded=new Set(['node_modules','data','dist','evidence','test-fixtures','tests','fixtures','history','created-scenes','renders','backup','backups','.git']);
const sourceExtensions=new Set(['.mjs','.js','.ts','.tsx','.jsx','.css','.html','.py','.ps1']);
export async function runtimeVersion({editorDirectory=import.meta.dirname,frontendDirectory=resolve(editorDirectory,'dist'),sourceDirectories=[editorDirectory,resolve(editorDirectory,'../backend'),resolve(editorDirectory,'../preproduction/nhat-thanh/EP01')],dependencyFiles=[resolve(editorDirectory,'../package.json'),resolve(editorDirectory,'../package-lock.json'),resolve(editorDirectory,'../../motion_intro/package.json'),resolve(editorDirectory,'../../motion_intro/package-lock.json'),resolve(process.env.ASSET_ROOT??resolve(process.env.WORKSPACE_ROOT??resolve(editorDirectory,'../..'),'asset_browser'),'psd_bridge.py')]}={}){
 const hash=createHash('sha256');
 async function file(label,path,imports=false){
  const content=await readFile(path);hash.update(JSON.stringify([label,content.length]));hash.update(content);
  // Composition JSON imported into a bundle is an application input, unlike
  // saved-edits.json, catalogs or job records read from mutable storage.
  if(imports)for(const match of content.toString('utf8').matchAll(/^[ \t]*import[ \t]+(?:[^;\r\n]*?\bfrom[ \t]*)?['"](\.[^'"\r\n]+\.json)['"]/gm))await file(label+'::'+match[1],resolve(dirname(path),match[1]));
 }
 async function tree(root,label,compiled=false){
  let entries;try{entries=await readdir(root,{withFileTypes:true});}catch(error){if(error.code!=='ENOENT')throw error;hash.update(JSON.stringify([label,'missing']));return;}
  for(const entry of entries.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
   const path=join(root,entry.name),key=label+'/'+entry.name;
   if(entry.isDirectory()){if(compiled||!excluded.has(entry.name))await tree(path,key,compiled);}
   else if(entry.isFile()&&(compiled||(sourceExtensions.has(extname(entry.name))&&!entry.name.includes('.test.')&&!entry.name.startsWith('test-'))))await file(key,path,!compiled&&['.mjs','.js','.ts','.tsx','.jsx'].includes(extname(entry.name)));
  }
 }
 for(let i=0;i<sourceDirectories.length;i++)await tree(sourceDirectories[i],'source/'+i);
 for(let i=0;i<dependencyFiles.length;i++)try{await file('dependency/'+i,dependencyFiles[i]);}catch(error){if(error.code!=='ENOENT')throw error;hash.update(JSON.stringify(['dependency/'+i,'missing']));}
 await tree(frontendDirectory,'frontend',true);
 return hash.digest('hex');
}
export function matchingRuntime(health,identity,version,pid){
 return typeof version==='string'&&version.length===64&&health?.status==='ready'&&health.runtime==='standalone'&&health.identity===identity&&health.version===version&&(pid===undefined||health.pid===pid);
}
