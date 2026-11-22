// Tier-1 Fast Layout Check: composites 1920x1080 preview PNGs directly with sharp (~0.5-1.5s)
// using the exact layer geometry from model.mjs (valueAt).
// IMPORTANT: This is a fast layout/eyeline linter for rapid plan iteration ONLY.
// It never replaces Tier-2 Remotion capture/playback for review, approval or export.
import sharp from 'sharp';
import {resolve} from 'node:path';
import {valueAt} from './model.mjs';
import {visibleInHierarchy} from './scene-graph.mjs';
import {effectiveZ} from './layer-order.mjs';

const CANVAS_W=1920,CANVAS_H=1080;

function watermarkSvg(frame,label){
  const text=`TIER-1 FAST LAYOUT CHECK · NOT FOR REVIEW · f${String(frame).padStart(4,'0')}${label?' · '+label:''}`;
  const safe=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const boxW=Math.min(1880,Math.max(480,safe.length*11+36));
  return Buffer.from(
    `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">`+
    `<rect x="18" y="18" width="${boxW}" height="38" rx="6" fill="rgba(12,16,24,0.78)" stroke="rgba(255,196,61,0.85)" stroke-width="1.5"/>`+
    `<text x="34" y="43" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#ffd166">${safe}</text>`+
    `</svg>`
  );
}

async function applyOpacity(pngBuffer,opacity){
  if(opacity>=0.999)return pngBuffer;
  const {data,info}=await sharp(pngBuffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let i=3;i<data.length;i+=4)data[i]=Math.round(data[i]*opacity);
  return sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
}

/** Compose an asset's multi-part sprite (e.g. pose + face) into one tight RGBA buffer at native asset size. */
async function buildAssetBuffer(asset,mediaDirectory,cache){
  const key=asset.width+'x'+asset.height+'|'+asset.parts.map(p=>`${p.src}@${p.left},${p.top},${p.width},${p.height}`).join(';');
  if(cache.has(key))return cache.get(key);
  const composites=[];
  for(const part of asset.parts??[]){
    const filePath=resolve(mediaDirectory,part.src.replace(/^\/+/,''));
    const pw=Math.max(1,Math.round(part.width)),ph=Math.max(1,Math.round(part.height));
    let partBuf=await sharp(filePath).ensureAlpha().resize(pw,ph,{fit:'fill'}).png().toBuffer();
    const pl=Math.round(part.left??0),pt=Math.round(part.top??0);
    // Clip part against asset canvas
    const x0=Math.max(0,pl),y0=Math.max(0,pt),x1=Math.min(asset.width,pl+pw),y1=Math.min(asset.height,pt+ph);
    if(x1<=x0||y1<=y0)continue;
    if(x0>pl||y0>pt||x1<pl+pw||y1<pt+ph){
      partBuf=await sharp(partBuf).extract({left:x0-pl,top:y0-pt,width:x1-x0,height:y1-y0}).png().toBuffer();
    }
    composites.push({input:partBuf,left:x0,top:y0});
  }
  const buf=await sharp({create:{width:Math.max(1,Math.round(asset.width)),height:Math.max(1,Math.round(asset.height)),channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite(composites).png().toBuffer();
  cache.set(key,buf);
  return buf;
}

/** Render one frame of a Studio document into a 1920x1080 PNG buffer using sharp. */
export async function renderFastFrame({document,frame,mediaDirectory,width=CANVAS_W,height=CANVAS_H,watermark=true,cache=new Map()}){
  const layers=document?.layers??{};
  const active=[];
  for(const [id,layer] of Object.entries(layers)){
    const a=layer?.asset;
    if(!a)continue;
    if(!visibleInHierarchy(layers,id,frame))continue;
    const v=valueAt(layer,frame);
    if(v.opacity<=0.001||v.scale<=0.001)continue;
    const role=a.type==='backgrounds'?'background':'object';
    const authoredZ=role==='background'?0:100;
    const z=effectiveZ(role,layer,v.z,authoredZ);
    active.push({id,layer,asset:a,v,z,order:active.length});
  }
  active.sort((a,b)=>(a.z-b.z)||(a.order-b.order));

  const composites=[];
  for(const {asset,v} of active){
    let buf=await buildAssetBuffer(asset,mediaDirectory,cache);
    const sw=Math.max(1,Math.round(asset.width*v.scale));
    const sh=Math.max(1,Math.round(asset.height*v.scale));
    let pipe=sharp(buf).resize(sw,sh,{fit:'fill'});
    if(v.flipX)pipe=pipe.flop();
    if(v.flipY)pipe=pipe.flip();
    if(v.rotation&&Math.abs(v.rotation)>0.01)pipe=pipe.rotate(v.rotation,{background:{r:0,g:0,b:0,alpha:0}});
    const {data,info}=await pipe.png().toBuffer({resolveWithObject:true});
    let outBuf=await applyOpacity(data,v.opacity);
    const cx=asset.left+asset.width/2+v.x;
    const cy=asset.top+asset.height/2+v.y;
    const left=Math.round(cx-info.width/2);
    const top=Math.round(cy-info.height/2);

    const x0=Math.max(0,left),y0=Math.max(0,top),x1=Math.min(width,left+info.width),y1=Math.min(height,top+info.height);
    if(x1<=x0||y1<=y0)continue;
    if(x0>left||y0>top||x1<left+info.width||y1<top+info.height){
      outBuf=await sharp(outBuf).extract({left:x0-left,top:y0-top,width:x1-x0,height:y1-y0}).png().toBuffer();
    }
    composites.push({input:outBuf,left:x0,top:y0});
  }

  if(watermark){
    const beat=document?.beats?.items?.find(b=>frame>=b.from&&frame<b.to);
    composites.push({input:watermarkSvg(frame,beat?.id??''),left:0,top:0});
  }

  return sharp({create:{width,height,channels:4,background:{r:18,g:20,b:26,alpha:1}}})
    .composite(composites)
    .png({compressionLevel:4})
    .toBuffer();
}

/** Render multiple frames in sequence sharing the decoded sprite cache. */
export async function renderFastFrames({document,frames,mediaDirectory,watermark=true}){
  const cache=new Map(),t0=Date.now(),buffers=[];
  for(const frame of frames){
    buffers.push(await renderFastFrame({document,frame,mediaDirectory,watermark,cache}));
  }
  return {buffers,elapsedMs:Date.now()-t0};
}
