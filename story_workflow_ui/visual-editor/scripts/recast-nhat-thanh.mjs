// Prepare immutable PSD composites, then save casting through revision-checked editor API.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..'),base='http://127.0.0.1:3022',out=resolve(root,'evidence/stabilization/nhat-thanh-recast');
await mkdir(out,{recursive:true});
const request=async(path,options)=>{const r=await fetch(base+path,options);const data=await r.json();if(!r.ok)throw Error(JSON.stringify(data));return data;};
const project=await request('/api/projects/nhat-thanh-ep01');
if(project.lockedPrefix.length)throw Error('Review locked scene inputs before recasting');
const catalog=await request('/api/library/catalog'),character=catalog.find(a=>a.id==='film/psd-1761027148569');
if(!character)throw Error('Missing selected character');
const find=(group,name)=>{const p=character.groups[group].find(p=>p.name===name);if(!p)throw Error('Missing '+name);return p;};
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
const image=async part=>{const buffer=await readFile(part.path);if(digest(buffer)!==part.id)throw Error('Source changed');return buffer;};
const recipes={hero:['站立','无表情'],'hero:calm':['站立','无表情'],'hero:alarm':['站立','惊讶'],'hero:grit':['站立','生气'],'hero:pain':['站立','皱眉'],'s05r30-seated-blue':['坐姿思考','无表情'],'s05r14-sleep-head':['站立','睡觉','head'],'s05r12-hero-hurt':['站立','皱眉'],'s05r12-hero-lying':['站立','睡觉'],'s05r12-hero-awake':['坐姿思考','无表情']};
const images={};
for(const [name,[poseName,faceName,mode]] of Object.entries(recipes)){
 const pose=find('poses',poseName),face=find('faces',faceName),left=Math.min(pose.bbox[0],face.bbox[0]),top=Math.min(pose.bbox[1],face.bbox[1]);
 const width=Math.max(pose.bbox[2],face.bbox[2])-left,height=Math.max(pose.bbox[3],face.bbox[3])-top;
 let composed=await sharp({create:{width,height,channels:4,background:'#0000'}}).composite(await Promise.all([pose,face].map(async p=>({input:await image(p),left:p.bbox[0]-left,top:p.bbox[1]-top})))).png().toBuffer();
 if(mode==='head')composed=await sharp(composed).extract({left:Math.max(0,320-left),top:0,width:Math.min(230,width-Math.max(0,320-left)),height:Math.min(300,height)}).trim().png().toBuffer();
 const old=await sharp(resolve(root,'data/media/images',name.split(':')[0]+'.png')).metadata();
 // Keep the existing authored canvas and transforms; contain preserves the PSD silhouette.
 const png=await sharp(composed).resize(old.width,old.height,{fit:'contain',background:'#0000',position:'centre'}).png().toBuffer();
 const src='images/cast-'+digest(png)+'.png';await writeFile(resolve(root,'data/media',src),png);
 images[name]={src,pose:poseName,face:faceName,poseId:pose.id,faceId:face.id};
}
for(const emotion of ['calm','alarm','grit','pain'])images['s05r15-head-'+emotion]={hidden:true};
const casting={characterId:character.id,name:character.name,source:character.source,images};
await writeFile(resolve(out,'casting.json'),JSON.stringify(casting,null,2));
await writeFile(resolve(out,'before.json'),JSON.stringify(project,null,2));
if(process.argv.includes('--apply')){
 const changed=[];
 for(const scene of project.scenes){
  if(!/^S0[1-6]$/.test(scene.id))continue;
  const document=await request('/api/edits?project='+project.id+'&scene='+scene.id);
  if(JSON.stringify(document)!==JSON.stringify(scene.document))throw Error('Scene changed during preparation: '+scene.id);
  const next=await request('/api/edits?project='+project.id+'&scene='+scene.id,{method:'PUT',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({...document,casting})});
  changed.push({scene:scene.id,before:document.revision,after:next.revision});
 }
 const after=await request('/api/projects/'+project.id);
 for(const scene of after.scenes){const previous=project.scenes.find(s=>s.id===scene.id);if(JSON.stringify(previous.document.layers)!==JSON.stringify(scene.document.layers))throw Error('User layers changed');if(JSON.stringify({...previous,document:null})!==JSON.stringify({...scene,document:null}))throw Error('Timing/audio/source changed');}
 await writeFile(resolve(out,'after.json'),JSON.stringify(after,null,2));
 await writeFile(resolve(out,'applied.json'),JSON.stringify(changed,null,2));console.log(JSON.stringify({changed,unchanged:'timing, audio, user layers/keyframes',casting:character.name}));
}else console.log(JSON.stringify({prepared:true,casting:character.name,images:Object.keys(images).length}));
