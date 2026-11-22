export function exportProvenance(project){
 return {version:1,purpose:'editor-preview',projectId:project.id,title:project.title,projectRevision:project.revision??null,frames:project.duration,sceneOrder:[...project.sceneOrder],scenes:project.scenes.map(scene=>({id:scene.id,revision:scene.document?.revision??null}))};
}
// Historical jobs without receipts remain unknown, never silently current.
export function validExportProvenance(source){
 if(source?.version!==1||source.purpose!=='editor-preview'||typeof source.projectId!=='string'||!source.projectId||typeof source.title!=='string'||!Number.isInteger(source.projectRevision)||source.projectRevision<0||!Number.isInteger(source.frames)||source.frames<0||!Array.isArray(source.sceneOrder)||!Array.isArray(source.scenes))return false;
 const ids=source.sceneOrder;
 if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length||source.scenes.length!==ids.length)return false;
 const scenes=source.scenes;
 return scenes.every(scene=>typeof scene?.id==='string'&&ids.includes(scene.id)&&Number.isInteger(scene.revision)&&scene.revision>=0)&&new Set(scenes.map(scene=>scene.id)).size===ids.length;
}
export function exportFreshness(provenance,project){
 if(!project||!validExportProvenance(provenance))return 'unknown';
 const current=exportProvenance(project);
 if(!validExportProvenance(current))return 'unknown';
 const same=provenance.projectId===current.projectId&&provenance.title===current.title&&provenance.projectRevision===current.projectRevision&&provenance.frames===current.frames&&provenance.sceneOrder.length===current.sceneOrder.length&&provenance.sceneOrder.every((id,index)=>id===current.sceneOrder[index])&&provenance.scenes.every(scene=>current.scenes.some(candidate=>candidate.id===scene.id&&candidate.revision===scene.revision));
 return same?'current':'older';
}
