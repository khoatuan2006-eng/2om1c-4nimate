import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layerRole,effectiveZ} from './layer-order.mjs';
test('background and subtitle roles reserve their order unless explicitly unlocked',()=>{
 assert.equal(layerRole('IMG',{objectFit:'cover',width:1920,height:1080}),'background');
 assert.equal(layerRole('DIV',{bottom:58,textAlign:'center',fontWeight:700}),'subtitle');
 assert.equal(layerRole('DIV',{bottom:58}),'object');
 assert.equal(effectiveZ('background',{base:{z:20}},20),0);
 assert.equal(effectiveZ('subtitle',{keys:{z:[{frame:0,value:1}]}},1),10000);
 assert.equal(effectiveZ('subtitle',{zOrderUnlocked:true,base:{z:20}},20),20);
 assert.equal(effectiveZ('object',{base:{z:10000}},10000),9999);
 assert.equal(effectiveZ('object',{},0,4),4);
});
