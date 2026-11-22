import {valueAt,setValue} from './model.mjs';
/** Declared visual landmarks on intact sprites; solve prop grip without cutting limbs. */
export function bindProp(layer,actor,{actorPoint,propPoint,frames}){
 if(['rotation','scale','flipX','flipY'].some(f=>actor.keys?.[f]?.length))throw Error('Prop binding v1 cần hướng/scale actor cố định');
 let next=structuredClone(layer);const world=(l,uv,f)=>{const a=l.asset,v=valueAt(l,f),x=(uv.x-.5)*a.width*v.scale*(v.flipX?-1:1),y=(uv.y-.5)*a.height*v.scale*(v.flipY?-1:1),r=v.rotation*Math.PI/180;return {x:a.left+a.width/2+v.x+x*Math.cos(r)-y*Math.sin(r),y:a.top+a.height/2+v.y+x*Math.sin(r)+y*Math.cos(r)};};
 if(!frames?.length||[actorPoint,propPoint].some(p=>![p?.x,p?.y].every(v=>Number.isFinite(v)&&v>=0&&v<=1)))throw Error('Điểm gắn đạo cụ không hợp lệ');
 for(const frame of frames){if(!Number.isInteger(frame)||frame<Math.max(layer.asset.from,actor.asset.from)||frame>=Math.min(layer.asset.to,actor.asset.to))throw Error('Frame gắn ngoài khoảng');const hand=world(actor,actorPoint,frame),grip=world(next,propPoint,frame),v=valueAt(next,frame);next=setValue(next,frame,{x:v.x+hand.x-grip.x,y:v.y+hand.y-grip.y},true);for(const f of ['x','y'])next.keys[f]=next.keys[f].map(k=>k.frame===frame?{...k,easing:actor.keys?.[f]?.find(a=>a.frame===frame)?.easing??'linear'}:k);}
 return next;
}
