import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAudit,normalizeContext} from './agent-search.mjs';
test('named-character mismatches cannot receive a high suitability percentage',()=>{
 const raw={scores:{appearance:95,style:95,scene:95},reason:'Có phong cách hoạt hình',description:'Nam tóc đen',missing:['Tóc xanh','Ba kiếm'],match:'unrelated'};
 assert.equal(normalizeAudit(raw,{namedEntity:'Zoro'}).score,39);
 assert.equal(normalizeAudit({...raw,match:'approximate'},{namedEntity:'Zoro'}).score,59);
 assert.equal(normalizeAudit({...raw,match:'exact'},{namedEntity:'Zoro'}).score,69);
 assert.equal(normalizeAudit({...raw,missing:[],match:'exact'},{namedEntity:'Zoro'}).score,95);
});
test('invalid or absent image judgments do not become fabricated zero/high scores',()=>{
 assert.equal(normalizeAudit(null,{}),null);
 assert.equal(normalizeAudit({scores:{appearance:'90',style:90,scene:90},match:'exact'},{}),null);
 assert.equal(normalizeAudit({scores:{appearance:110,style:90,scene:90},match:'exact'},{}),null);
});
test('scene context is bounded and cannot select arbitrary filesystem paths',()=>{
 const context=normalizeContext({scene:'../../keys.txt',frame:-3,objects:Array(50).fill('x'.repeat(500)),selected:'a'.repeat(1000)});
 assert.equal(context.scene,null);assert.equal(context.frame,0);assert.equal(context.objects.length,12);assert.equal(context.objects[0].length,120);assert.equal(context.selected.length,120);
});
