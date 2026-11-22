import {audioReference} from './audio-reference.mjs';
import {readFile,readdir,mkdir,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {atomicWriteBytes} from './atomic-write.mjs';
import {legacyMediaSelection,relativeProductionMedia,expectedProductionMediaHash} from './production-inputs.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const within=(root,path)=>{const rel=relative(root,path);return rel!==''&&!isAbsolute(rel)&&!rel.startsWith('..');};
function safePath(root,path){
 if(typeof path!=='string'||path.includes('\\')||path.split('/').some(p=>!p||p==='..'||p.startsWith('.')))throw Error('Đường dẫn tài nguyên xuất không hợp lệ.');
 const target=resolve(root,path);if(!within(resolve(root),target))throw Error('Tài nguyên xuất nằm ngoài kho.');return target;
}
async function nativePaths(root,path,paths,selection){
 let entries;try{entries=await readdir(resolve(root,path),{withFileTypes:true});}catch(error){if(error.code==='ENOENT')throw Error('Thiếu thư mục tài nguyên dựng gốc: '+path);throw error;}
 for(const entry of entries){const child=path+'/'+entry.name;if(entry.isSymbolicLink()){if(!selection||selection.includes(child)||selection.mayDescend(child))throw Error('Không xuất tài nguyên qua symbolic link: '+child);continue;}if(entry.isDirectory()){if(!selection||selection.mayDescend(child))await nativePaths(root,child,paths,selection);}else if(entry.isFile()&&!paths.has(child)&&(!selection||selection.includes(child)))paths.set(child,null);}
}
export async function freezeExportMedia(project,mediaRoot,targetRoot){
 const paths=new Map();
 for(const scene of project.scenes){
  for(const layer of Object.values(scene.document?.layers??{}))for(const part of layer.asset?.parts??[]){if(!/^library-assets\/[a-f0-9]{64}\.png$/.test(part.src))throw Error('Ảnh trong bản dựng không hợp lệ.');paths.set(part.src,part.src.slice(15,-4));}
  for(const cue of scene.cues??[]){
   // Authored scenes also carry subtitle-only cues. Their audio is supplied
   // by the composition and captured from the native audio directory below.
   if(scene.kind==='authored'&&cue.publicPath==null&&cue.contentHash==null)continue;
   const {path,expected}=audioReference(cue);if(paths.has(path)&&paths.get(path)!==expected)throw Error('Cùng một audio có hai hash khác nhau.');paths.set(path,expected);
  }
  for(const track of scene.audioTracks??[]){const {path,expected}=audioReference(track);if(paths.has(path)&&paths.get(path)!==expected)throw Error('Cùng một audio có hai hash khác nhau.');paths.set(path,expected);}
  for(const image of Object.values(scene.document?.casting?.images??{}))if(image.src){const path=relativeProductionMedia(image.src);paths.set(path,expectedProductionMediaHash(path));}
 }
 const selection=legacyMediaSelection(project);
 if(selection){for(const path of selection.exact)if(!paths.has(path)&&(selection.required.includes(path)||existsSync(resolve(mediaRoot,path))))paths.set(path,expectedProductionMediaHash(path));if(selection.images)await nativePaths(mediaRoot,'images',paths,selection);if(selection.audio)await nativePaths(mediaRoot,'audio',paths,selection);}
 else if(project.scenes.some(scene=>scene.kind==='authored')){await nativePaths(mediaRoot,'images',paths);await nativePaths(mediaRoot,'audio',paths);}
 await mkdir(targetRoot,{recursive:true});const records=[];
 if(!paths.size)return records;
 const canonicalRoot=await realpath(mediaRoot);
 for(const [path,expected] of paths){
  let bytes;try{const source=safePath(mediaRoot,path);if(!within(canonicalRoot,await realpath(source)))throw Error('Tài nguyên xuất trỏ ra ngoài kho.');bytes=await readFile(source);}catch(error){if(error.code==='ENOENT')throw Error('Thiếu tài nguyên trước khi xuất: '+path);throw error;}
  const sha256=hash(bytes);if(expected&&sha256!==expected)throw Error('Tài nguyên đã thay đổi hoặc bị hỏng: '+path);
  await atomicWriteBytes(safePath(targetRoot,path),bytes);records.push({path,sha256,bytes:bytes.length});
 }
 return records;
}
export async function verifyExportMedia(root,records){
 const canonicalRoot=await realpath(root);
 for(const record of records){const path=safePath(root,record.path);if(!within(canonicalRoot,await realpath(path)))throw Error('Bản sao xuất trỏ ra ngoài kho.');const bytes=await readFile(path);if(bytes.length!==record.bytes||hash(bytes)!==record.sha256)throw Error('Tài nguyên trong bản xuất đã thay đổi: '+record.path);}
}
