import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {annotateAsset} from './library-server.mjs';

const table=JSON.parse(readFileSync(new URL('./catalog-annotations.json',import.meta.url),'utf8'));
const faces=(n,group)=>Array.from({length:n},(_,i)=>({id:'f'+group+i,name:'x'+i,sourceLayerId:group+'/'+i}));

test('annotateAsset labels each face by its PSD group, even when the style order is reversed',()=>{
  // 老头/灰色古装男-style PSD with groups listed detailed-first is real data; check both orders from the generated table.
  const reversed=Object.entries(table).find(([,e])=>e.faceGroups.length===2&&e.faceGroups[0].style==='detailed');
  assert(reversed,'table must contain a PSD whose first face group is the detailed style');
  const [file,note]=reversed;
  const asset={id:'a',type:'characters',source:'D:/tai-nguyen/oss/'+file,groups:{faces:[...faces(2,note.faceGroups[0].index),...faces(2,note.faceGroups[1].index)]}};
  annotateAsset(asset,table);
  assert.deepEqual(asset.groups.faces.map(f=>f.style),['detailed','detailed','bean','bean']);
  assert.equal(asset.frameSet,note.frameSet);assert(asset.faceStyles.length===2);
  assert.equal(annotateAsset(asset,table),asset,'idempotent');
});

test('annotateAsset leaves unknown sources and non-characters alone',()=>{
  const prop={id:'p',type:'props',source:'x/y.psd',groups:{props:[{id:'1'}]}},unknown={id:'c',type:'characters',source:'x/none.psd',groups:{faces:[{id:'1',sourceLayerId:'1/0'}]}};
  annotateAsset(prop,table);annotateAsset(unknown,table);
  assert.equal(prop.faceStyles,undefined);assert.equal(unknown.groups.faces[0].style,undefined);
});

test('generated annotations cover real PSD structure',()=>{
  const entries=Object.values(table);assert(entries.length>=40);
  for(const e of entries){assert(['base-28','extended-52','custom'].includes(e.frameSet));for(const g of e.faceGroups)assert(['bean','detailed','generic','other'].includes(g.style));}
});
