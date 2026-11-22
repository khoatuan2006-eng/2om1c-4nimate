import {easings,valueAt} from './model.mjs';
/** Camera motion is authored once on a root and weighted by each plane's depth. */
export function parallaxMatrix(layers,id,frame){
 const l=layers[id];let root=id;while(layers[root]?.parentId)root=layers[root].parentId;
 const camera=layers[root]?.camera;if(!camera?.enabled)return [1,0,0,1,0,0];
 let ancestor=id;while(layers[ancestor]?.depth===undefined&&layers[ancestor]?.parentId)ancestor=layers[ancestor].parentId;
 const v=valueAt({base:camera.base,keys:camera.keys},frame),depth=layers[ancestor]?.depth??1,s=1+(v.scale-1)*depth;
 return [s,0,0,s,960*(1-s)-v.x*depth,540*(1-s)-v.y*depth];
}
export function cameraPreset(document,id,kind){
 const next=structuredClone(document),l=next.layers[id];if(!l?.asset||l.parentId)throw Error('Chọn lớp gốc của bối cảnh');const from=l.asset.from,to=l.asset.to-1;
 const end=kind==='pan-right'?{x:160,y:0,scale:1}:kind==='pan-left'?{x:-160,y:0,scale:1}:kind==='push-in'?{x:0,y:0,scale:1.15}:{x:0,y:0,scale:1};
 l.camera={enabled:kind!=='off',base:{x:0,y:0,scale:1},keys:Object.fromEntries(['x','y','scale'].map(field=>[field,[{frame:from,value:field==='scale'?1:0,easing:'smooth'},...(to>from?[{frame:to,value:end[field],easing:'smooth'}]:[])]]))};return next;
}
export function validateParallax(layer){
 if(layer.depth!==undefined&&(!Number.isFinite(layer.depth)||layer.depth<0||layer.depth>2))throw Error('Độ sâu parallax cần từ 0 đến 2');
 if(layer.camera!==undefined){const c=layer.camera;if(!c||typeof c.enabled!=='boolean'||layer.parentId||!layer.asset)throw Error('Camera phải nằm trên lớp gốc');for(const field of ['x','y','scale']){const valid=v=>Number.isFinite(v)&&(field==='scale'?v>=1&&v<=2:Math.abs(v)<=2000);if(!valid(c.base?.[field]))throw Error('Thông số camera không hợp lệ');if(!Array.isArray(c.keys?.[field])||c.keys[field].length>108000)throw Error('Keyframe camera không hợp lệ');const frames=new Set();for(const k of c.keys[field]){if(!Number.isInteger(k.frame)||k.frame<layer.asset.from||k.frame>=layer.asset.to||frames.has(k.frame)||!valid(k.value)||!easings.includes(k.easing))throw Error('Keyframe camera không hợp lệ');frames.add(k.frame);}}}
}
