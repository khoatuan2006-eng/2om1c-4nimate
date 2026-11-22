import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createStaticMediaValues,UNKNOWN_MEDIA_VALUE as U} from './static-media-values.mjs';
const require=createRequire(resolve(import.meta.dirname,'../../motion_intro/package.json')),{parse}=require('@babel/parser'),traverse=require('@babel/traverse').default;
function values(source,json={}){
 const ast=parse(source,{sourceType:'module',plugins:['typescript','jsx']}),activeReferences=new WeakSet(),targets=[];
 traverse(ast,{ReferencedIdentifier(p){activeReferences.add(p.node);},CallExpression(p){if(p.node.callee.name==='staticFile')targets.push(p.get('arguments')[0]);}});
 const read=createStaticMediaValues({activeReferences,aliases:new Map(),jsonForBinding:b=>json[b.path.parent.source.value]??U});
 return targets.map(read);
}
test('media paths follow helper arguments and JSX defaults without evaluating unrelated styles',()=>{
 assert.deepEqual(values('const pic=(name)=>staticFile(`images/${name}.png`);pic("hero");pic("port");'),[['images/hero.png','images/port.png']]);
 assert.deepEqual(values('const Pic=({name="hero",style})=>staticFile(`images/${name}.png`);const scene=<><Pic style={unknown()}/><Pic name="port"/></>;'),[['images/hero.png','images/port.png']]);
});
test('JSON, map callbacks, array indices and arithmetic preserve finite path alternatives',()=>{
 const result=values('import poses from "./poses.json";const names=["a","b"];const scene=poses.map((p,i)=>staticFile(`images/${names[i%names.length]}-${p.pose}.png`));',{'./poses.json':[{pose:'run'},{pose:'look'}]})[0];
 assert.deepEqual(new Set(result),new Set(['images/a-run.png','images/a-look.png','images/b-run.png','images/b-look.png']));
 assert.deepEqual(values('const names=["a","b"];staticFile(`images/${names.reverse()[0]}.png`);'),[['images/b.png']]);
 assert.deepEqual(new Set(values('const names=["a","b"];staticFile(`images/${names.slice(1)[0]}.png`);')[0]),new Set(['images/a.png','images/b.png']));
 assert.deepEqual(values('const scene=Array.from({length:3},(_,i)=>staticFile(`images/pose-${i+1}.png`));'),[['images/pose-1.png','images/pose-2.png','images/pose-3.png']]);
});
test('unknown callers, JSX spread, mutations, computed calls and bounded recursion stay unresolved',()=>{
 for(const source of [
  'const pic=(n)=>staticFile(`images/${n}.png`);external(pic);',
  'const Pic=({name})=>staticFile(`images/${name}.png`);const scene=<Pic {...unknown}/>;',
  'const names=["a"];names[0]="b";staticFile(`images/${names[0]}.png`);',
  'const name=external();staticFile(`images/${name}.png`);',
  'const name=()=>name();staticFile(`images/${name()}.png`);'
 ])assert.deepEqual(values(source),[[U]],source);
});
