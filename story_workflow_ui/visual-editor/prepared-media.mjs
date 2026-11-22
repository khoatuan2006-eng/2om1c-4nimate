import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {atomicWriteBytes} from './atomic-write.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function verify(bytes,id){
 if(digest(bytes)!==id)throw Object.assign(Error('Ảnh đã thay đổi hoặc bị hỏng. Làm mới kho tài nguyên và chọn lại ảnh.'),{code:'ASSET_CHANGED'});
 if(bytes.length<24||bytes.toString('hex',0,8)!=='89504e470d0a1a0a'||!bytes.readUInt32BE(16)||!bytes.readUInt32BE(20))throw Error('Ảnh PNG không hợp lệ. Chọn tài nguyên khác.');
}
export async function readLibraryImage(source,id){
 let bytes;try{bytes=await readFile(source);}catch(error){if(error.code==='ENOENT')throw Object.assign(Error('Không còn tìm thấy ảnh nguồn. Làm mới kho tài nguyên và chọn lại.'),{code:'ASSET_CHANGED'});throw error;}
 verify(bytes,id);return bytes;
}
// The URL names the content, not a mutable source path. Publish only complete bytes.
export async function prepareLibraryImage(source,id,mediaRoot){
 if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw Error('Mã ảnh không hợp lệ. Làm mới kho tài nguyên.');
 const src='library-assets/'+id+'.png',target=resolve(mediaRoot,src);
 try{verify(await readFile(target),id);return {src};}catch(error){if(error.code!=='ENOENT')throw error;}
 const bytes=await readLibraryImage(source,id);await atomicWriteBytes(target,bytes);return {src};
}
