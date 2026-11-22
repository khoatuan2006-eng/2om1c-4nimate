// HTTP API for Declarative Scene Plan (Working Layer v2):
//   POST /api/scene-plans/preview — compiles + renders Tier-1 Fast Layout Check (Sharp) without touching SQLite
//   POST /api/scene-plans/apply   — resolves timing (auto-tts|draft), compiles, prepares media and upserts via ProjectStore (with Detach Guard)
import {catalog as readCatalog,catalogFilePath} from './library-server.mjs';
import {prepareLibraryImage} from './prepared-media.mjs';
import {prepareCatalogSelections} from './catalog-selection.mjs';
import {buildScene} from './scene-plan.mjs';
import {renderFastFrames} from './fast-preview.mjs';
import {getProjectStore,mediaRoot} from './project-store.mjs';
import {isLocalWrite,jsonResponse} from './http-policy.mjs';

async function readJsonBody(req,limit=2e6){
  let raw='';
  for await(const chunk of req){raw+=chunk;if(raw.length>limit)throw Object.assign(Error('Plan quá lớn'),{status:413});}
  try{return JSON.parse(raw||'{}');}catch{throw Object.assign(Error('JSON không hợp lệ'),{status:400});}
}

function defaultFramesForBeats(beats){
  return (beats??[]).map(b=>Math.min(b.to-1,b.from+Math.floor((b.to-b.from)/3)));
}

export function scenePlanPlugin({store:providedStore,mediaDirectory=mediaRoot,catalogReader=readCatalog,prepareSelections:providedPrepare,prepareAudio}={}){
  return {
    name:'scene-plan-api',
    configureServer({middlewares}){
      const store=providedStore??getProjectStore();
      const makePrepare=current=>providedPrepare??(requests=>prepareCatalogSelections(requests,{
        catalogReader:async()=>current,
        prepare:async id=>{
          const file=catalogFilePath(id);
          if(!file)throw Error('Ảnh không thuộc kho: '+id);
          return prepareLibraryImage(file,id,mediaDirectory);
        },
      }));

      middlewares.use(async(req,res,next)=>{
        const path=req.url?.split('?')[0];
        if(path!=='/api/scene-plans/preview'&&path!=='/api/scene-plans/apply')return next();
        try{
          if(req.method!=='POST')return jsonResponse(res,405,{error:'POST required'});
          if(!isLocalWrite(req))return jsonResponse(res,403,{error:'Origin không hợp lệ'});
          const input=await readJsonBody(req);
          if(!input.plan||typeof input.plan!=='object')throw Object.assign(Error('Thiếu trường plan'),{status:400});

          const current=await catalogReader();
          const built=await buildScene(input.plan,{
            catalog:current,
            prepareSelections:makePrepare(current),
            prepareAudio,
            mediaDirectory,
            stage:input.stage,
          });

          if(path==='/api/scene-plans/preview'){
            const frames=Array.isArray(input.frames)&&input.frames.length
              ?input.frames.map(Number).filter(f=>Number.isInteger(f)&&f>=0&&f<built.source.duration)
              :defaultFramesForBeats(built.document.beats?.items);
            const {buffers,elapsedMs}=await renderFastFrames({document:built.document,frames,mediaDirectory,watermark:true});
            return jsonResponse(res,200,{
              tier:'tier-1-fast-layout-check',
              notForReview:true,
              duration:built.source.duration,
              timingMode:built.timingMode,
              beats:built.document.beats?.items?.length??0,
              layers:Object.keys(built.document.layers).length,
              warnings:built.warnings,
              uses:built.resolved.uses,
              elapsedMs,
              frames:frames.map((f,i)=>({frame:f,pngBase64:buffers[i].toString('base64')})),
            });
          }

          // /api/scene-plans/apply
          if(!input.projectId)throw Object.assign(Error('Thiếu projectId'),{status:400});
          const result=store.upsertPlanScene(input.projectId,built.source,built.document,{
            revision:input.revision,
            documentRevision:input.documentRevision,
            forceResync:Boolean(input.forceResync),
          });
          return jsonResponse(res,result.created?201:200,{
            created:result.created,
            sceneId:result.scene.id,
            planState:result.scene.planState,
            documentRevision:result.document.revision,
            projectRevision:result.projectRevision,
            duration:result.scene.duration,
            timingMode:built.timingMode,
            cues:result.scene.cues.length,
            warnings:built.warnings,
          });
        }catch(e){
          jsonResponse(res,e.status??400,{error:e.message,code:e.code});
        }
      });
    },
  };
}
