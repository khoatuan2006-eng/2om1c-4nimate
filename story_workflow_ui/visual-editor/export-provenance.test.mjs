import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exportProvenance,exportFreshness,validExportProvenance} from './export-provenance.mjs';
test('preview provenance identifies exactly which project and scene revisions were exported',()=>{
 const project={id:'P',title:'Film',revision:3,duration:90,sceneOrder:['A','B'],scenes:[{id:'A',document:{revision:8}},{id:'B',document:{revision:2}}]};
 const source=exportProvenance(project);assert.equal(source.purpose,'editor-preview');assert.equal(exportFreshness(source,project),'current');
 for(const change of [p=>p.title='Changed',p=>p.revision++,p=>p.duration++,p=>p.sceneOrder.reverse(),p=>p.scenes[0].document.revision++,p=>p.id='Other']){
  const changed=structuredClone(project);change(changed);assert.equal(exportFreshness(source,changed),'older');
 }
 project.scenes[0].document.revision=9;project.sceneOrder.reverse();assert.equal(source.scenes[0].revision,8);assert.deepEqual(source.sceneOrder,['A','B']);
});
test('source identity compares fields and scene identities, not JSON serialization order',()=>{
 const project={id:'P',title:'Film',revision:3,duration:90,sceneOrder:['A','B'],scenes:[{id:'A',document:{revision:8}},{id:'B',document:{revision:2}}]};
 const source=exportProvenance(project);
 const reordered=Object.fromEntries(Object.entries(source).reverse());
 reordered.scenes=source.scenes.slice().reverse().map(({id,revision})=>({revision,id}));
 reordered.diagnostic='extra metadata';
 assert.equal(exportFreshness(reordered,project),'current');
 for(const change of [s=>delete s.sceneOrder,s=>s.sceneOrder=['A','A'],s=>s.scenes=[s.scenes[0],s.scenes[0]],s=>s.scenes[1].id='C',s=>s.frames=NaN,s=>s.projectRevision=-1,s=>s.scenes[0].revision=-1,s=>s.scenes=null,s=>s.title=null]){
  const broken=structuredClone(source);change(broken);
  assert.equal(validExportProvenance(broken),false);
  assert.equal(exportFreshness(broken,project),'unknown');
 }
 const incomplete=structuredClone(project);delete incomplete.scenes[0].document.revision;
 assert.equal(exportFreshness(source,incomplete),'unknown');
});
test('historical or incomplete receipts never claim current export or approval',()=>{
 const project={id:'P',title:'Film',duration:1,sceneOrder:['A'],scenes:[{id:'A'}]};
 for(const provenance of [null,{},exportProvenance(project),{version:1,purpose:'editor-preview',projectRevision:1,scenes:null}])assert.equal(exportFreshness(provenance,project),'unknown');
 assert.equal(exportFreshness(exportProvenance(project),null),'unknown');
 assert.equal('approved' in exportProvenance(project),false);
});
