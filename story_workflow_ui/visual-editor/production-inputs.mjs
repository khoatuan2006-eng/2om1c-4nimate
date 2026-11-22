import {readFileSync,readdirSync,realpathSync,existsSync} from 'node:fs';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {storyHash} from './story-chain.mjs';
import {audioReference} from './audio-reference.mjs';
import {scopedCompositionDependencies,staticCompositionImports} from './composition-dependencies.mjs';
const scopedVersions=new Map();
export function compositionInputGraph(){
 const visited=new Map();
 function visit(file){
  if(visited.has(file))return;const bytes=readFileSync(file);visited.set(file,bytes);
  for(const dependency of staticCompositionImports(bytes,file)){
   const target=resolve(dirname(file),dependency);let found=false;
   for(const suffix of ['', '.tsx','.ts','.mjs','.js','.jsx','.json']){try{readFileSync(target+suffix);visit(target+suffix);found=true;break;}catch(e){if(e.code!=='ENOENT'&&e.code!=='EISDIR')throw e;}}
   if(!found)throw Error('Composition dependency not found: '+target);
  }
 }
 visit(resolve(import.meta.dirname,'export-entry.tsx'));
 for(const file of ['../package-lock.json','../../motion_intro/package-lock.json'])visit(resolve(import.meta.dirname,file));
 return visited;
}
export function compositionScopeSync(project){
 const graph=compositionInputGraph(),all=[...graph].map(([file,bytes])=>[file,storyHash(bytes)]).sort(([a],[b])=>a.localeCompare(b));
 if(!project)return {version:storyHash(all),mediaReferences:null};
 const ids=[...new Set(project.scenes.map(s=>s.id))].sort(),algorithm=storyHash(['production-inputs.mjs','composition-dependencies.mjs','static-media-values.mjs'].map(file=>readFileSync(resolve(import.meta.dirname,file),'utf8'))),key=storyHash({all,ids,algorithm});
 if(scopedVersions.has(key))return scopedVersions.get(key);
 let unsupported;const mediaReferences=[];const scoped=scopedCompositionDependencies(graph,ids,{onUnsupported:reason=>{unsupported=reason;},onMediaReference:reference=>mediaReferences.push(reference)}),locks=all.filter(([file])=>file.endsWith('package-lock.json'));
 if(unsupported?.includes('Dynamic module'))throw Error('Cannot establish current composition dependencies: '+unsupported);
 const version=storyHash({version:2,dependencies:scoped??all,locks,algorithm});
 const scope={version,mediaReferences:scoped?mediaReferences:null};
 if(scopedVersions.size>=64)scopedVersions.clear();scopedVersions.set(key,scope);return scope;
}
export const compositionVersionSync=project=>compositionScopeSync(project).version;
export function relativeProductionMedia(path){
 if(typeof path!=='string')throw Error('Invalid production media path');
 const value=path.split(/[?#]/)[0].replace(/^\//,'');
 if(!value||value.includes('\\')||value.includes(':')||value.split('/').some(p=>!p||p.startsWith('.')))throw Error('Invalid production media path');return value;
}
export const expectedProductionMediaHash=path=>/^(?:library-assets\/([a-f0-9]{64})\.png|audio\/([a-f0-9]{64})\.mp3|images\/cast-([a-f0-9]{64})\.png)$/.exec(path)?.slice(1).find(Boolean)??null;
export function legacyMediaSelection(project,scope){
 // Bare lifecycle snapshots have no declared composition/media source. Keep
 // their pre-existing explicit-file behavior without loading the AST compiler.
 if(!project.scenes.some(s=>s.kind==='authored'||s.kind==='created'))return null;
 if(project.scenes.some(s=>typeof s.id!=='string'))return null;
 const references=(scope??compositionScopeSync(project)).mediaReferences;if(!references)return null;
 const patterns=[],prefixes=[],exact=new Set(),required=new Set();let images=false,audio=false;
 const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 for(const reference of references)for(const tokens of reference.patterns){
  const parts=[];for(const token of tokens){if(token===null){parts.push(null);continue;}const match=/[?#]/.exec(token);parts.push(match?token.slice(0,match.index):token);if(match)break;}
  if(typeof parts[0]==='string')parts[0]=parts[0].replace(/^\//,'');
  const prefix=parts.slice(0,parts.indexOf(null)<0?parts.length:parts.indexOf(null)).join('');
  prefixes.push({prefix,wildcard:parts.includes(null)});
  const mayStart=folder=>folder.startsWith(prefix)||prefix.startsWith(folder);
  images||=mayStart('images/');audio||=mayStart('audio/');
  patterns.push(new RegExp('^'+parts.map(p=>p===null?'[\\s\\S]*':escape(p)).join('')+'$'));
  if(!parts.includes(null)){const path=relativeProductionMedia(parts.join(''));exact.add(path);if(reference.required)required.add(path);}
 }
 return {images,audio,exact:[...exact].sort(),required:[...required].sort(),includes:path=>patterns.some(p=>p.test(path)),mayDescend:path=>prefixes.some(p=>p.prefix.startsWith(path+'/')||p.wildcard&&(path+'/').startsWith(p.prefix))};
}
export function productionInputsDigest(project,mediaDirectory){
 const paths=new Map(),scope=compositionScopeSync(project),selection=legacyMediaSelection(project,scope);
 for(const scene of project.scenes){
  for(const layer of Object.values(scene.document.layers))for(const part of layer.asset?.parts??[]){
   const match=/^library-assets\/([a-f0-9]{64})\.png$/.exec(part.src);if(!match)throw Error('Invalid production image path');paths.set(part.src,match[1]);
  }
  for(const cue of scene.cues??[]){if(scene.kind==='authored'&&!cue.publicPath&&!cue.contentHash)continue;const ref=audioReference(cue);paths.set(ref.path,ref.expected);}
  for(const track of scene.audioTracks??[]){const ref=audioReference(track);paths.set(ref.path,ref.expected);}
  for(const image of Object.values(scene.document.casting?.images??{}))if(image.src){const path=relativeProductionMedia(image.src);paths.set(path,expectedProductionMediaHash(path));}
 }
 // Authored legacy composition also uses staticFile assets outside document.layers.
 const tree=path=>{for(const e of readdirSync(resolve(mediaDirectory,path),{withFileTypes:true})){const child=path+'/'+e.name;if(e.isSymbolicLink()){if(!selection||selection.includes(child)||selection.mayDescend(child))throw Error('Linked production media');continue;}if(e.isDirectory()){if(!selection||selection.mayDescend(child))tree(child);}else if(e.isFile()&&!paths.has(child)&&(!selection||selection.includes(child)))paths.set(child,null);}};
 if(selection){for(const path of selection.exact)if(!paths.has(path)&&(selection.required.includes(path)||existsSync(resolve(mediaDirectory,path))))paths.set(path,expectedProductionMediaHash(path));if(selection.images)tree('images');if(selection.audio)tree('audio');}
 else if(project.scenes.some(s=>s.kind==='authored')){tree('images');tree('audio');}
 const media=[];
 for(const [path,expected] of [...paths].sort(([a],[b])=>a.localeCompare(b))){
  const canonicalRoot=realpathSync(mediaDirectory),file=realpathSync(resolve(mediaDirectory,path)),rel=relative(canonicalRoot,file);
  if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('Production media outside root');
  const sha256=storyHash(readFileSync(file));if(expected&&sha256!==expected)throw Error('Production media hash mismatch: '+path);media.push({path,sha256});
 }
 return storyHash({codeVersion:scope.version,media});
}
