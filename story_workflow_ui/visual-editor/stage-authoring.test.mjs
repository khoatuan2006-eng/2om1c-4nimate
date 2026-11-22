import test from 'node:test';import assert from 'node:assert/strict';import {authorStages} from './stage-authoring.mjs';import {valueAt} from './model.mjs';
test('stages share existing operations, preserve timeline and reject uncovered ranges',()=>{
 const selections={hero:{name:'hero',type:'characters',width:100,height:200,parts:[{src:'library-assets/'+'a'.repeat(64)+'.png',left:0,top:0,width:100,height:200}]}},stages=[{from:0,to:30,sprites:[{asset:'hero',x:600,y:900,height:400,move:{x:300,y:-40}}]}];
 const {document,stageLayers}=authorStages({id:'S',duration:30,stages,selections}),layer=document.layers[stageLayers[0][0]];assert.equal(valueAt(layer,29).x-valueAt(layer,0).x,300);assert.equal(layer.asset.to,30);assert.throws(()=>authorStages({id:'S',duration:31,stages,selections}),/incomplete/);assert.throws(()=>authorStages({id:'S',duration:30,stages:[{...stages[0],from:1}],selections}),/gaps/);
});
