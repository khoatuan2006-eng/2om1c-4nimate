import {createReadStream} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import {resolve,relative,extname,isAbsolute} from 'node:path';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.mp4':'video/mp4','.woff2':'font/woff2','.ico':'image/x-icon'};
const contained=(root,file)=>{const rel=relative(root,file);return rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel);};
export function byteRange(value,size){
 const match=/^bytes=(\d*)-(\d*)$/.exec(value??'');if(!match||!match[1]&&!match[2])return null;
 const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
 const end=match[1]&&match[2]?Math.min(size-1,Number(match[2])):size-1;
 return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<=end&&start<size?{start,end}:null;
}
export async function sendFile(req,res,root,pathname,{immutable=false}={}){
 if(!['GET','HEAD'].includes(req.method))return false;
 let decoded;try{decoded=decodeURIComponent(pathname);}catch{return false;}
 if(decoded.includes('\0')||decoded.includes('\\')||decoded.split('/').some(part=>part==='..'||part.startsWith('.')))return false;
 const file=resolve(root,'.'+(decoded.startsWith('/')?decoded:'/'+decoded));if(!contained(root,file))return false;
 let canonical,info;try{canonical=await realpath(file);const canonicalRoot=await realpath(root);if(!contained(canonicalRoot,canonical))return false;info=await stat(canonical);if(!info.isFile())return false;}catch(e){if(['ENOENT','ENOTDIR','EACCES'].includes(e.code))return false;throw e;}
 const headers={'Content-Type':types[extname(file).toLowerCase()]??'application/octet-stream','Content-Length':info.size,'Accept-Ranges':'bytes','Cache-Control':immutable?'public,max-age=31536000,immutable':'no-cache','X-Content-Type-Options':'nosniff'};
 let range;if(req.headers.range){range=byteRange(req.headers.range,info.size);if(!range){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return true;}Object.assign(headers,{'Content-Length':range.end-range.start+1,'Content-Range':`bytes ${range.start}-${range.end}/${info.size}`});}
 res.writeHead(range?206:200,headers);if(req.method==='HEAD'){res.end();return true;}
 const stream=createReadStream(canonical,range??{});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return true;
}
export function mediaMiddleware(root){return async(req,res,next)=>{
 if(req.url.startsWith('/api/'))return next();
 if(!await sendFile(req,res,root,req.url.split('?')[0],{immutable:/\/[a-f0-9]{64}\./.test(req.url)}))next();
};}
