import test from 'node:test';
import assert from 'node:assert/strict';
import {AssetIndex,parseTranslations,applyNameTranslations,fold} from './asset-index.mjs';

const catalog=[{id:'film/a',name:'Người qua đường nữ',type:'characters',collection:'film',groups:{poses:[
  {id:'1'.repeat(64),name:'逃跑',width:900,height:1200},{id:'2'.repeat(64),name:'接电话',width:900,height:1200},
  {id:'3'.repeat(64),name:'惊讶 (Chibi)',width:100,height:100},{id:'4'.repeat(64),name:'图层 1',width:10,height:10}]}}];
const translations=parseTranslations('# c\n逃跑=bỏ chạy|run away,escape\n接电话=nghe điện thoại|phone call\n惊讶=ngạc nhiên|surprised\n');

test('fold strips Vietnamese diacritics',()=>assert.equal(fold('Bỏ chạy, ĐÁNH'),'bo chay, danh'));

test('search finds Chinese-named items by Vietnamese (with/without diacritics) and English',()=>{
  const index=new AssetIndex(':memory:');index.sync(catalog);
  const result=applyNameTranslations(index,translations);
  assert.equal(result.applied,3);assert.deepEqual(result.unknown,['图层 1'],'placeholder names are reported, not guessed');
  for(const query of ['bỏ chạy','bo chay','run away','逃跑'])assert.equal(index.search(query).items[0]?.name,'逃跑',query);
  assert.equal(index.search('phone',{type:'characters'}).total,1);
  assert.equal(index.search('phone',{type:'backgrounds'}).total,0);
  assert(index.search('chibi').items[0].descriptions[0].tags.includes('chibi'));
  assert.equal(index.search('').total,0);index.close();
});

test('sync keeps descriptions, drops vanished items and their search rows',()=>{
  const index=new AssetIndex(':memory:');index.sync(catalog);applyNameTranslations(index,translations);
  assert.equal(index.sync(catalog).removed,0);assert.equal(index.stats().described['name-translation'],3);
  assert.equal(index.sync([{...catalog[0],groups:{poses:catalog[0].groups.poses.slice(1)}}]).removed,1);
  assert.equal(index.search('bo chay').total,0);assert.equal(index.stats().items,3);index.close();
});

test('describe rejects unknown items and empty text; punctuation in queries is safe',()=>{
  const index=new AssetIndex(':memory:');index.sync(catalog);
  assert.throws(()=>index.describe('x',{source:'manual',lang:'vi',text:'a'}),/Unknown item/);
  assert.throws(()=>index.describe('1'.repeat(64),{source:'manual',lang:'vi',text:' '}),/required/);
  index.describe('1'.repeat(64),{source:'vision:test',lang:'en',text:'man running away',tags:['sprint']});
  assert.equal(index.search('"running" (away*) -').items[0].id,'1'.repeat(64));
  assert.deepEqual(index.pending({source:'vision:*'}).map(r=>r.id).includes('1'.repeat(64)),false);index.close();
});

test('addMissing indexes new catalog items without a full sync',()=>{
  const index=new AssetIndex(':memory:');index.sync(catalog);
  const grown=[...catalog,{id:'supplemental-x',name:'MCP upload fixture',type:'props',collection:'supplemental',groups:{props:[{id:'5'.repeat(64),name:'MCP upload fixture'}]}}];
  assert.equal(index.addMissing(grown),1);assert.equal(index.addMissing(grown),0);
  assert.equal(index.search('upload fixture').items[0].id,'5'.repeat(64));index.close();
});

test('face style is stored, searchable and returned',()=>{
  const index=new AssetIndex(':memory:');
  const styled=[{id:'film/s',name:'Hero',type:'characters',collection:'film',groups:{faces:[{id:'7'.repeat(64),name:'感动',style:'bean'},{id:'8'.repeat(64),name:'感动',style:'detailed'}]}}];
  index.sync(styled);
  assert.deepEqual(index.search('感动').items.map(i=>i.style).sort(),['bean','detailed']);
  assert.equal(index.search('style:detailed').items[0].id,'8'.repeat(64));
  assert.equal(index.search('感动 bean').total,1);index.close();
});

test('scoped translations keep repeated placeholder names apart',()=>{
  const index=new AssetIndex(':memory:');
  const cat=['A','B'].map((n,i)=>({id:'film/'+n,name:'Bộ '+n,type:'props',collection:'film',groups:{props:[{id:String(i+1).repeat(64),name:'元件 90001'}]}}));
  index.sync(cat);
  const result=applyNameTranslations(index,parseTranslations('Bộ A::元件 90001=súng lục|pistol\nBộ B::元件 90001=con quay|spinning top\n'));
  assert.equal(result.applied,2);assert.equal(index.search('pistol').items[0].assetId,'film/A');assert.equal(index.search('spinning top').items[0].assetId,'film/B');
  assert.equal(index.search('pistol').total,1);index.close();
});
