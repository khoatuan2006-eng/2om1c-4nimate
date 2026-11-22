// Explicit integration check: existing composition/Remotion, isolated synthetic media and DB.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {ProjectStore} from '../project-store.mjs';
import {storyHash} from '../story-chain.mjs';
import {atomicWriteBytes} from '../atomic-write.mjs';
import {capturePreviewEvidence,verifyPreviewEvidence} from '../preview-evidence.mjs';
const folder=await mkdtemp(join(tmpdir(),'doyin-real-preview-')),mediaDirectory=join(folder,'media'),store=new ProjectStore(join(folder,'projects.sqlite'));
try{
 store.create('Synthetic capture verification','fixture');
 const blue=await sharp({create:{width:1920,height:1080,channels:4,background:'#0000ff'}}).png().toBuffer(),red=await sharp({create:{width:200,height:200,channels:4,background:'#ff0000'}}).png().toBuffer();
 const image=async bytes=>{const src='library-assets/'+storyHash(bytes)+'.png';await atomicWriteBytes(join(mediaDirectory,src),bytes);return src;};
 const asset=(name,type,src,left,top,width,height)=>({name,type,from:0,to:60,left,top,width,height,parts:[{src,left:0,top:0,width,height}]});
 const document={version:1,revision:0,layers:{
  'fixture-scene/shot-0/bg':{base:{z:0},asset:asset('Blue background','backgrounds',await image(blue),0,0,1920,1080)},
  'fixture-scene/shot-0/sprite':{base:{z:100},asset:asset('Red moving square','props',await image(red),100,100,200,200),keys:{x:[{frame:0,value:0,easing:'linear'},{frame:30,value:400,easing:'hold'}]}}
 }};
 store.addScene('fixture',{id:'fixture-scene',title:'Synthetic capture verification',kind:'created',duration:60,cues:[],shots:[{from:0,to:60}]},document);
 const options={mediaDirectory,workDirectory:join(folder,'capture-work')};
 const result=await capturePreviewEvidence(store,'fixture',{sceneId:'fixture-scene',documentRevision:0,frames:[0,30]},options);
 const pixel=async(path,x,y)=>[...await sharp(path).removeAlpha().extract({left:x,top:y,width:1,height:1}).raw().toBuffer()];
 assert.deepEqual(await pixel(result.evidence[0].path,150,150),[255,0,0]);
 assert.deepEqual(await pixel(result.evidence[1].path,150,150),[0,0,255]);
 assert.deepEqual(await pixel(result.evidence[1].path,550,150),[255,0,0]);
 for(const evidence of result.evidence)assert.equal(await verifyPreviewEvidence(store,store.get('fixture'),evidence,options),true);
 const receipt={status:'pass',scope:'Synthetic pixel/position and provenance integration only; no story or native approval',folder,evidence:result.evidence};
 await writeFile(join(folder,'verification.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{store.close();}
