import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renderFastFrames} from './fast-preview.mjs';

test('renderFastFrames composites 1920x1080 PNG frames with watermark and respects layer timing/opacity',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'fast-preview-test-'));
  try{
    mkdirSync(join(dir,'library-assets'),{recursive:true});
    const bgBuf=await sharp({create:{width:1920,height:1080,channels:4,background:{r:40,g:90,b:140,alpha:1}}}).png().toBuffer();
    const charBuf=await sharp({create:{width:200,height:400,channels:4,background:{r:220,g:50,b:50,alpha:1}}}).png().toBuffer();
    writeFileSync(join(dir,'library-assets/bg.png'),bgBuf);
    writeFileSync(join(dir,'library-assets/char.png'),charBuf);

    const document={
      version:1,revision:0,
      beats:{version:1,items:[{id:'b1',from:0,to:30}]},
      layers:{
        's/shot-0/op-bg':{
          asset:{type:'backgrounds',name:'BG',from:0,to:30,left:0,top:0,width:1920,height:1080,parts:[{src:'library-assets/bg.png',left:0,top:0,width:1920,height:1080}]},
          base:{x:0,y:0,scale:1,opacity:1},
        },
        's/shot-0/op-hero':{
          asset:{type:'characters',name:'Hero',from:10,to:30,left:860,top:340,width:200,height:400,parts:[{src:'library-assets/char.png',left:0,top:0,width:200,height:400}]},
          base:{x:0,y:0,scale:1,flipX:true,opacity:1},
        },
      },
    };

    const {buffers,elapsedMs}=await renderFastFrames({document,frames:[5,15],mediaDirectory:dir});
    assert.equal(buffers.length,2);
    assert(elapsedMs<5000,'fast preview renders quickly: '+elapsedMs+'ms');
    const meta0=await sharp(buffers[0]).metadata();
    assert.equal(meta0.width,1920);assert.equal(meta0.height,1080);

    // At frame 5, center pixel (960, 540) should be blue BG; at frame 15, red Hero covers center.
    const px=async buf=>{
      const {data}=await sharp(buf).extract({left:960,top:540,width:1,height:1}).raw().toBuffer({resolveWithObject:true});
      return [data[0],data[1],data[2]];
    };
    const c5=await px(buffers[0]),c15=await px(buffers[1]);
    assert(c5[2]>100&&c5[0]<80,'frame 5 center is blue background: '+c5);
    assert(c15[0]>180&&c15[2]<80,'frame 15 center is red character: '+c15);
  }finally{
    rmSync(dir,{recursive:true,force:true});
  }
});
