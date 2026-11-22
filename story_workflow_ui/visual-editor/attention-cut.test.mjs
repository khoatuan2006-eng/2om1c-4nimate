import test from 'node:test';import assert from 'node:assert/strict';
import {compileAttentionCut} from './attention-cut.mjs';import {applyAuthoringOperations} from './authoring-operations.mjs';import {valueAt} from './model.mjs';
const asset=(type,w,h)=>({name:type,type,from:0,to:90,left:0,top:0,width:w,height:h,parts:[{src:'library-assets/'+'a'.repeat(64)+'.png',left:0,top:0,width:w,height:h}]});
test('attention sequence follows supplied order, reuses existing actor and focuses declared image points',()=>{
 const document={version:1,revision:0,layers:{actor:{base:{rotation:-6},asset:asset('characters',200,800)},neutral:{asset:asset('characters',200,800)},bg:{asset:asset('backgrounds',1920,1080)}}};
 const input={document,actorLayerId:'actor',neutralLayerId:'neutral',backgroundLayerId:'bg',from:0,to:90,faceEnd:20,actorPlacement:{x:960,y:1800,height:1700},targets:[{from:20,to:55,u:.3,v:.3,scale:2},{from:55,to:90,u:.7,v:.3,scale:2}]};
 const compiled=compileAttentionCut(input),result=applyAuthoringOperations({id:'S',duration:90},document,compiled.commands).document;
 assert.equal(result.layers.actor.asset.to,20);assert.equal(result.layers.actor.base.rotation,0);assert.equal(document.layers.actor.asset.to,90);
 for(const t of input.targets){const v=valueAt(result.layers.bg,t.from);assert.equal(960+v.x+(t.u-.5)*1920*v.scale,960);assert.equal(540+v.y+(t.v-.5)*1080*v.scale,540);}
 assert.throws(()=>compileAttentionCut({...input,targets:[{...input.targets[0],from:21}]}),/liên tục/);
 assert.throws(()=>applyAuthoringOperations({id:'S',duration:90},document,[{op:'transform',layerId:'actor',values:{skew:0}}]),/Transform/);
});
