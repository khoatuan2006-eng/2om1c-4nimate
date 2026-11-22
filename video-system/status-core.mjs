export async function readLiveWorkflow(studio,{fetchImpl=fetch}={}){
 if(!studio?.url||!studio.projectId)return {status:'unconfigured',source:'Studio API'};
 try{
  const response=await fetchImpl(studio.url.replace(/\/$/,'')+'/api/projects/'+encodeURIComponent(studio.projectId),{signal:AbortSignal.timeout(2500)});
  if(!response.ok)throw Error('Studio API HTTP '+response.status);
  const project=await response.json();
  if(project.id!==studio.projectId)throw Error('Project identity mismatch');
  const scene=project.scenes.find(s=>s.id===studio.sceneId);
  return {status:scene?'ready':studio.sceneId?'selection-missing':'project-ready',source:'Studio API',selectionSource:'project profile; not browser selection',projectId:project.id,projectRevision:project.revision,sceneCount:project.scenes.length,sceneIds:project.scenes.map(s=>s.id),sceneId:studio.sceneId??null,documentRevision:scene?.document.revision??null,lockedPrefix:project.lockedPrefix??[],nextAction:scene?'inspect-current-scene':studio.sceneId?'select-existing-scene':'select-scene-or-read-episode-workflow'};
 }catch(error){return {status:'unavailable',source:'Studio API',reason:error.message,note:'No live revision confirmed; checkpoint history is not a fallback cursor.'};}
}
export function auditCommand(profile){
 if(!profile.production||!profile.studio?.sceneId||!profile.studio.projectId)return null;
 const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
 const args=['--project='+profile.studio.projectId,'--scene='+profile.studio.sceneId];
 if(profile.production.review)args.push('--review='+profile.production.review);
 if(profile.studio.url)args.push('--url='+profile.studio.url.replace(/\/$/,''));
 return 'node visual-editor/production-audit.mjs '+args.map(quote).join(' ');
}
