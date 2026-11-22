import {getProjectStore} from './project-store.mjs';
import {captureAssembly} from './assembly-library.mjs';
import {isLocalWrite,jsonResponse} from './http-policy.mjs';
export function assemblyPlugin(){return {name:'assembly-library',configureServer(server){
 const store=getProjectStore();server.middlewares.use(async(req,res,next)=>{
  const path=new URL(req.url,'http://localhost').pathname;if(path!=='/api/assemblies'&&!path.startsWith('/api/assemblies/'))return next();
  try{
   if(req.method!=='GET'&&!isLocalWrite(req))return jsonResponse(res,403,{error:'Origin không hợp lệ'});
   if(path==='/api/assemblies'&&req.method==='GET')return jsonResponse(res,200,store.listAssemblies());
   if(path==='/api/assemblies'&&req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2e6)throw Error('Bộ quá lớn');}const input=JSON.parse(raw);const template=captureAssembly(input.document,input.rootId,input.name);return jsonResponse(res,201,store.saveAssembly(template));}
   const match=/^\/api\/assemblies\/([a-f0-9-]{36})$/.exec(path);if(match&&req.method==='GET')return jsonResponse(res,200,store.getAssembly(match[1]));
   return jsonResponse(res,404,{error:'Không tìm thấy bộ'});
  }catch(e){jsonResponse(res,e.status??400,{error:e.message});}
 });
}};}
