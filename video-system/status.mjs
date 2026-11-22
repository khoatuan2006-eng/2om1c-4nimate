import {readLiveWorkflow,auditCommand} from './status-core.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=process.argv.slice(2).find(a=>a.startsWith('--project='));
const id=arg?.slice('--project='.length);
const index=JSON.parse(await fs.readFile(path.join(root,'video-system/projects.json'),'utf8'));
if(!id||!Object.hasOwn(index.projects,id)){console.error('Choose --project='+Object.keys(index.projects).join('|'));process.exitCode=1;}else{
 const selected=index.projects[id];
 const profilePath=path.join(root,selected.profile),checkpointPath=path.join(root,selected.checkpoint);
 const profile=JSON.parse(await fs.readFile(profilePath,'utf8')),work=JSON.parse(await fs.readFile(checkpointPath,'utf8'));
 const liveWorkflow=await readLiveWorkflow(profile.studio);
 // Checkpoints are historical hints, never the current production cursor.
 const checkpoint={status:work.status,currentStep:work.currentStep??work.latestStep,resumeCommand:work.resumeCommand,authority:'historical hint; verify against liveWorkflow'};
 const currentStep=liveWorkflow.projectRevision!==undefined?`Studio project revision ${liveWorkflow.projectRevision}; ${liveWorkflow.sceneCount} scenes; ${liveWorkflow.nextAction}.`:'Read live Studio state before authoring; no current revision confirmed.';
 const resumeCommand='Read video-system/RESUME.md and run status; follow liveWorkflow.nextAction. Do not infer current state from checkpoint history.';
 console.log(JSON.stringify({projectId:id,liveWorkflow,profilePath,checkpointPath,checkpoint,systemGoal:'Reusable production system; current episode is a test case',priority:profile.priority,acceptedTechniques:profile.acceptedTechniques,status:liveWorkflow.status,currentStep,preview:profile.studio?.url,studio:profile.studio,production:profile.production?{...profile.production,auditCommand:auditCommand(profile)}:undefined,history:work.history,integrationGuide:path.join(root,'video-system/STUDIO-INTEGRATION.md'),currentReview:null,resumeCommand,sharedLibrary:path.join(root,'story_workflow_ui/visual-editor/SCRIPT-PLANS.md'),note:'Read current checkpoint together with current project preferences. Old fine-polish/continuous-motion blockers must be reassessed under the latest user direction; no approval or score inferred.'},null,2));
}
