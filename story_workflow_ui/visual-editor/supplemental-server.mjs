import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {getProjectStore,mediaRoot} from './project-store.mjs';
import {registerSupplement,digest} from './supplemental-catalog.mjs';
import {atomicWriteBytes} from './atomic-write.mjs';
import {isLocalWrite,jsonResponse} from './http-policy.mjs';
function decode(value,max){
 if(typeof value!=='string'||value.length>Math.ceil(max/3)*4||value.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('Invalid or oversized upload');
 const bytes=Buffer.from(value,'base64');if(!bytes.length||bytes.length>max||bytes.toString('base64')!==value)throw Error('Invalid or oversized upload');return bytes;
}
export async function registerUploadedSupplement(store,projectId,input,{mediaDirectory=mediaRoot}={}){
 store.get(projectId);
 const record=structuredClone(input.record);
 if(!record||typeof record!=='object'||Array.isArray(record)||record.sourceFile!==undefined||record.projectId&&record.projectId!==projectId)throw Error('Upload cannot select server files or a different project');
 if(record.review?.status!=='candidate')throw Error('Agent uploads enter the catalog as candidates; no automatic asset approval');
 const image=decode(input.pngBase64,8*1024*1024),sha256=digest(image);
 if(image.length<24||image.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Upload must be a PNG');
 const width=image.readUInt32BE(16),height=image.readUInt32BE(20);if(!width||!height||width>16384||height>16384||width*height>40000000)throw Error('PNG dimensions exceed catalog limits');
 if(record.sha256!==undefined&&record.sha256!==sha256)throw Error('Uploaded image hash mismatch');
 try{
  const previous=JSON.parse(await readFile(resolve(mediaDirectory,'supplemental/records/'+sha256+'.json'),'utf8'));
  const {recordHash,...data}=previous;if(!recordHash||digest(JSON.stringify(data))!==recordHash)throw Error('Existing supplemental metadata is corrupt');
  if(previous.projectId!==projectId)throw Object.assign(Error('Supplement belongs to a different project; reuse its catalog entry without overwriting ownership'),{status:409});
 }catch(e){if(e.code!=='ENOENT')throw e;}
 if(!Array.isArray(input.attachments??[])||(input.attachments??[]).length>16)throw Error('Too many provenance uploads');
 const attachments=new Map();let total=0;
 for(const item of input.attachments??[]){const bytes=decode(item.base64,512*1024);total+=bytes.length;if(total>2*1024*1024||digest(bytes)!==item.sha256||attachments.has(item.sha256))throw Error('Provenance upload hash/size/identity mismatch');attachments.set(item.sha256,bytes);}
 // Provenance refs use upload:<hash>, never a caller-chosen local path.
 const references=[...(record.provenance?.references??[]),...(record.provenance?.documents??[]),...(record.review?.evidence??[])];
 for(const ref of references){const match=/^upload:([a-f0-9]{64})$/.exec(ref.path??'');if(!match||!attachments.has(match[1])||ref.sha256&&ref.sha256!==match[1])throw Error('Provenance must reference a supplied upload hash');ref.sha256=match[1];ref.path=resolve(mediaDirectory,'supplemental/uploads/'+match[1]+'.bin');}
 const sourceFile=resolve(mediaDirectory,'supplemental/uploads/'+sha256+'.png');
 for(const [hash,bytes] of attachments)await atomicWriteBytes(resolve(mediaDirectory,'supplemental/uploads/'+hash+'.bin'),bytes);
 await atomicWriteBytes(sourceFile,image);
 return registerSupplement({...record,projectId,sha256,sourceFile},mediaDirectory);
}
export function supplementalUploadPlugin({store:providedStore,mediaDirectory=mediaRoot}={}){return {name:'supplemental-upload',configureServer({middlewares}){
 const store=providedStore??getProjectStore();middlewares.use(async(req,res,next)=>{
  const match=/^\/api\/supplements\/([a-zA-Z0-9-]+)$/.exec(req.url?.split('?')[0]??'');if(!match)return next();
  try{
   if(req.method!=='POST')return jsonResponse(res,405,{error:'POST required'});if(!isLocalWrite(req))return jsonResponse(res,403,{error:'Origin không hợp lệ'});
   req.setEncoding('utf8');let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>14*1024*1024)throw Error('Supplement upload too large');}
   jsonResponse(res,201,await registerUploadedSupplement(store,match[1],JSON.parse(raw),{mediaDirectory}));
  }catch(e){jsonResponse(res,e.status??(e.message==='Catalog revision conflict'?409:400),{error:e.message});}
 });
}};}
