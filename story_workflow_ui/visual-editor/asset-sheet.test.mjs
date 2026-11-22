import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {buildSheet,SHEET_LIMIT} from './asset-sheet.mjs';

const sprite=(w,h)=>sharp({create:{width:w,height:h,channels:4,background:{r:200,g:30,b:30,alpha:1}}}).png().toBuffer();

test('sheet grids numbered cells, keeps Chinese/markup-unsafe names and enforces limits',async()=>{
  const cells=await Promise.all([1,2,3,4,5,6,7].map(async n=>({n,name:n===3?'逃跑 <&>':'站立',bytes:await sprite(40+n*10,120)})));
  const png=await buildSheet(cells);const meta=await sharp(png).metadata();
  assert.equal(meta.format,'png');assert.equal(meta.width,6*226+6);assert.equal(meta.height,2*254+6);
  await assert.rejects(buildSheet([]),/1–36/);
  await assert.rejects(buildSheet(Array.from({length:SHEET_LIMIT+1},()=>cells[0])),/1–36/);
});

test('composeParts layers cropped parts at their PSD positions; pickFromGroup accepts cell numbers or ids',async()=>{
  const {composeParts,pickFromGroup}=await import('./asset-sheet.mjs');
  const pose={bbox:[100,0,300,400],width:200,height:400,bytes:await sprite(200,400)};
  const face={bbox:[150,50,250,120],width:100,height:70,bytes:await sharp({create:{width:100,height:70,channels:4,background:{r:0,g:0,b:255,alpha:1}}}).png().toBuffer()};
  const out=await composeParts([pose,face],[900,1200]);const meta=await sharp(out).metadata();
  assert.deepEqual([meta.width,meta.height],[200,400],'output cropped to union box');
  const {data,info}=await sharp(out).raw().toBuffer({resolveWithObject:true});
  const px=(x,y)=>[...data.subarray((y*info.width+x)*4,(y*info.width+x)*4+4)];
  assert.deepEqual(px(60,60),[0,0,255,255],'face drawn over pose at bbox offset (150-100,50-0)');
  assert.deepEqual(px(10,10),[200,30,30,255],'pose visible outside face');
  const list=[{id:'a'},{id:'b'}];
  assert.deepEqual(pickFromGroup(list,[2,'a','1'],'Pose').map(i=>i.id),['b','a','a']);
  assert.throws(()=>pickFromGroup(list,[3],'Pose'),/Pose not found: 3/);
});
