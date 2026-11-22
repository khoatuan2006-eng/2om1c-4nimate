// HTTP API for On-Demand PSD Archive (search 7,697+ PSDs, preview embedded composite thumb, lazy extract into Studio imports/).
import {getPsdArchive,getPsdThumbnail,extractPsdAsset} from './psd-archive.mjs';
import {invalidateImportedCatalog} from './discovery-server.mjs';
import {isLocalWrite,jsonResponse} from './http-policy.mjs';

async function readJson(req,limit=2e5){
  let raw='';
  for await(const chunk of req){raw+=chunk;if(raw.length>limit)throw Object.assign(Error('Payload quá lớn'),{status:413});}
  try{return JSON.parse(raw||'{}');}catch{throw Object.assign(Error('JSON không hợp lệ'),{status:400});}
}

export function psdArchivePlugin({archive:providedArchive,thumbDir,importsRoot}={}){
  return {
    name:'psd-archive-api',
    configureServer({middlewares}){
      const getArchive=()=>providedArchive??getPsdArchive();
      middlewares.use(async(req,res,next)=>{
        const url=new URL(req.url??'/','http://127.0.0.1');
        if(!url.pathname.startsWith('/api/psd-archive/'))return next();
        try{
          if(url.pathname==='/api/psd-archive/search'&&req.method==='GET'){
            const q=url.searchParams.get('q')??'';
            const type=url.searchParams.get('type')||undefined;
            const limit=Math.min(50,Math.max(1,Number(url.searchParams.get('limit')??20)||20));
            const offset=Math.max(0,Number(url.searchParams.get('offset')??0)||0);
            return jsonResponse(res,200,getArchive().search(q,{type,limit,offset}));
          }
          if(url.pathname==='/api/psd-archive/thumb'&&req.method==='GET'){
            const id=url.searchParams.get('id')??'';
            if(!/^psd_[a-f0-9]{20}$/.test(id))return jsonResponse(res,400,{error:'Invalid PSD id'});
            const {bytes}=await getPsdThumbnail(id,{archive:getArchive(),...(thumbDir?{thumbDir}:{})});
            res.writeHead(200,{'Content-Type':'image/png','Content-Length':bytes.length,'Cache-Control':'public, max-age=3600'});
            res.end(bytes);
            return;
          }
          if(url.pathname==='/api/psd-archive/scan'&&req.method==='POST'){
            if(!isLocalWrite(req))return jsonResponse(res,403,{error:'Origin không hợp lệ'});
            return jsonResponse(res,200,getArchive().scan());
          }
          if(url.pathname==='/api/psd-archive/extract'&&req.method==='POST'){
            if(!isLocalWrite(req))return jsonResponse(res,403,{error:'Origin không hợp lệ'});
            const body=await readJson(req);
            if(!/^psd_[a-f0-9]{20}$/.test(body.id??''))return jsonResponse(res,400,{error:'Invalid PSD id'});
            if(body.type!==undefined&&!['characters','backgrounds','props','effects'].includes(body.type)){
              return jsonResponse(res,400,{error:'Invalid asset type'});
            }
            const result=await extractPsdAsset(body.id,{
              type:body.type,
              label:body.label,
              archive:getArchive(),
              ...(importsRoot?{importsRoot}:{}),
              onExtracted:()=>invalidateImportedCatalog(),
            });
            return jsonResponse(res,200,result);
          }
          return jsonResponse(res,405,{error:'Method not allowed'});
        }catch(e){
          return jsonResponse(res,e.status??500,{error:e.message});
        }
      });
    },
  };
}
