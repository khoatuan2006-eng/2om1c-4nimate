// Extract generated sprite-sheet cells; no limb deformation or repainting.
import sharp from 'sharp';
import {copyFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const source='C:/Users/Khoa/.codex/generated_images/01a11c2c-f9c4-7463-a243-5e4c02e5d338/exec-4379067d-9e02-4e99-9e17-2c161758d0dc.png';
const dir=resolve(root,'data/media/images');
await mkdir(resolve(root,'evidence/s07-locomotion-preview'),{recursive:true});
await copyFile(source,resolve(dir,'s07-locomotion-sheet-v2.png'));
const specs=[
 {key:'heroA',rect:{left:0,top:0,width:615,height:585},head:320},
 {key:'heroB',rect:{left:615,top:0,width:615,height:585},head:285},
 {key:'followerA',rect:{left:0,top:585,width:615,height:693},head:325},
 {key:'followerB',rect:{left:615,top:585,width:615,height:693},head:315}
];
const records={};
for(const s of specs){
 const raw=await sharp(source).extract(s.rect).raw().toBuffer({resolveWithObject:true});
 let l=raw.info.width,t=raw.info.height,r=0,b=0;
 for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++)if(raw.data[(y*raw.info.width+x)*4+3]>32){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
 const scale=1170/(b-t+1),head=s.key.startsWith('hero')?300:350;
 const width=Math.round((r-l+1)*scale),left=Math.round(head-(s.head-l)*scale);
 if(left<0||left+width>900)throw Error('Sprite bounds '+s.key);
 const cell=await sharp(raw.data,{raw:raw.info}).extract({left:l,top:t,width:r-l+1,height:b-t+1}).resize(width,1170).png().toBuffer();
 const src='images/s07-'+s.key+'-walk-v2.png';
 await sharp({create:{width:900,height:1200,channels:4,background:'#0000'}}).composite([{input:cell,left,top:15}]).png().toFile(resolve(root,'data/media',src));
 records[s.key]={src,source:'images/s07-locomotion-sheet-v2.png',rect:s.rect,alphaBounds:[l,t,r,b],headAnchor:head,generated:true};
}
await writeFile(resolve(root,'s07-locomotion.json'),JSON.stringify(records,null,2));
await writeFile(resolve(root,'evidence/s07-locomotion-preview/provenance.json'),JSON.stringify({source,referenceHero:'cast-7a0de23e9c6038ef4466ba5ef81df5e5cb7f579318905b6a4850558d7a391be1.png',referenceFollower:'henchman-b.png',note:'Reference-derived generated poses, not PSD extracts. Two-pose limited locomotion, not a full walk cycle.',records},null,2));
