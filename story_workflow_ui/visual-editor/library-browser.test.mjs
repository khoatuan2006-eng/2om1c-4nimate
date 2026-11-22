import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterLibrary,libraryPage} from './library-browser.mjs';
const assets=[{id:'nt',name:'Nhật Thành',type:'characters',collection:'film'},{id:'canis',name:'Canis',type:'characters',collection:'imports'}, {id:'crate',name:'Thùng gỗ',type:'props'}];
test('project scope excludes shared/imported assets and whole library includes both',()=>{
 assert.deepEqual(filterLibrary(assets,{type:'characters',collection:'film'}).map(a=>a.id),['nt']);
 assert.deepEqual(filterLibrary(assets,{type:'characters',collection:'all'}).map(a=>a.id),['nt','canis']);
});
test('multiword Vietnamese search works without accents and respects type',()=>{
 assert.equal(filterLibrary(assets,{type:'characters',collection:'all',query:'nhat thanh'})[0].id,'nt');
 assert.equal(filterLibrary(assets,{type:'characters',collection:'all',query:'thung go'}).length,0);
});
test('pagination clamps after filtering and bounds large pose or face lists',()=>{
 const faces=Array.from({length:146},(_,i)=>i);
 assert.deepEqual(libraryPage(faces,12).items,[144,145]);
 assert.equal(libraryPage(faces,99).page,12);
 assert.deepEqual(libraryPage([],12),{items:[],page:0,count:1,total:0});
 assert.equal(libraryPage([1],NaN).page,0);
});
