import {isLocalWrite} from './http-policy.mjs';
import {storageError} from './storage-error.mjs';
import {patchStoryboard} from './storyboard-model.mjs';
import {getProjectStore,legacyProjectId} from './project-store.mjs';
export function projectPlugin({store:providedStore}={}){return {name:'project-store',configureServer(server){
  const store=providedStore??getProjectStore();
  server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,'http://localhost'),path=url.pathname;
    if(!path.startsWith('/api/projects')&&path!=='/api/edits')return next();
    const send=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    try{
      if(req.method!=='GET'&&!isLocalWrite(req))return send(403,{error:'Origin không hợp lệ'});
      const body=async()=>{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2e6)throw Error('Dữ liệu quá lớn.');}return JSON.parse(raw||'{}');};
      if(path==='/api/edits'){
        const scene=url.searchParams.get('scene'),project=url.searchParams.get('project')||undefined;
        if(req.method==='GET')return send(200,store.getEdits(scene,project));
        if(req.method==='PUT')return send(200,store.saveEdits(scene,await body(),project));
      }
      if(path==='/api/projects'){
        if(req.method==='GET'){const projects=store.list();return send(200,{defaultProjectId:projects.some(p=>p.id===legacyProjectId)?legacyProjectId:projects[0]?.id??null,projects});}
        if(req.method==='POST')return send(201,store.create((await body()).title));
      }
      const match=/^\/api\/projects\/([a-zA-Z0-9-]+)(?:\/scenes\/([a-zA-Z0-9-]+)\/(history|restore|storyboard))?$/.exec(path);
      if(match){const [,id,scene,action]=match;
        if(action==='storyboard'&&req.method==='PATCH'){
          const input=await body(),row=store.scene(scene,id),document=JSON.parse(row.document);
          if(input.revision!==document.revision)return send(409,{error:'Scene đã thay đổi. Đọc lại trước khi lưu storyboard.',code:'REVISION_CONFLICT'});
          return send(200,store.saveEdits(scene,patchStoryboard(JSON.parse(row.source),document,input.taskId,input.changes),id));
        }
        if(action==='history'&&req.method==='GET')return send(200,store.history(scene,id));
        if(action==='restore'&&req.method==='POST')return send(200,store.restore(scene,await body(),id));
        if(!action&&req.method==='GET')return send(200,store.get(id));
        if(!action&&req.method==='PATCH')return send(200,store.update(id,await body()));
        if(!action&&req.method==='DELETE')return send(200,store.delete(id,await body()));
      }
      send(405,{error:'Method not allowed'});
    }catch(e){const failure=storageError(e);send(failure?.status??e.status??400,failure?{error:failure.error,code:failure.code}:{error:e.message,...(typeof e.code==='string'?{code:e.code}:{})});}
  });
}};}
