import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {requireStudioProtocol} from './studio-protocol.mjs';

// Pin tool surfaces as well as shell permissions. Ignoring user config alone
// still leaves built-in app/browser/plugin defaults enabled in the installed CLI.
export const disabledProductionFeatures=Object.freeze(['apps','plugins','remote_plugin','plugin_discovery_prefetch','browser_use','browser_use_external','computer_use','in_app_browser','image_generation','multi_agent','multi_agent_v2','hooks','skill_search','workspace_dependencies','in_app_local_automation','goals']);
// Explicit capability list. A future MCP tool must not silently inherit approval.
export const productionStudioTools=Object.freeze(['studio_state','studio_scene_read','studio_operations','studio_catalog_search','studio_asset_details','studio_asset_prepare','studio_asset_image','studio_asset_sheet','studio_character_preview','studio_supplement_register','psd_archive_search','psd_archive_thumb','psd_archive_extract','scene_plan_preview','scene_plan_apply','studio_plan_import','studio_author_batch','studio_document_save','studio_episode_read','studio_episode_save','studio_episode_build','studio_transition','studio_preview_capture','studio_capture_image','studio_playback_records','studio_preview_play','studio_preview_status','studio_export_jobs','studio_export_request','studio_preview_location']);

export function productionTarget({projectId,baseUrl='http://127.0.0.1:3022',task}){
 if(!/^[a-zA-Z0-9-]{1,150}$/.test(projectId??''))throw Error('Select an existing Studio project ID');
 const url=new URL(baseUrl);if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.pathname!=='/'||url.username||url.password||url.search||url.hash)throw Error('Studio must be a loopback origin');
 if(typeof task!=='string'||!task.trim())throw Error('Production task is required');
 return {projectId,origin:url.origin};
}
export function productionCodexArgs({projectId,baseUrl='http://127.0.0.1:3022',workingDirectory,task}){
 const {origin}=productionTarget({projectId,baseUrl,task});
 const setting=(key,value)=>['-c',key+'='+JSON.stringify(value)];
 return ['exec','--ignore-user-config','--ignore-rules','--skip-git-repo-check','--ephemeral','--json','-C',resolve(workingDirectory),
  ...setting('default_permissions',':read-only'),...setting('windows.sandbox','mxc'),...setting('approval_policy','never'),
  ...setting('web_search','disabled'),...disabledProductionFeatures.flatMap(name=>['--disable',name]),
  ...setting('mcp_servers.studio.command',process.execPath),...setting('mcp_servers.studio.args',[resolve(import.meta.dirname,'studio-mcp.mjs')]),...setting('mcp_servers.studio.env.STUDIO_URL',origin),...setting('mcp_servers.studio.env.STUDIO_PROJECT_ID',projectId),...setting('mcp_servers.studio.required',true),
  ...setting('mcp_servers.studio.env_vars',['STUDIO_SESSION_COOKIE']),
  ...setting('mcp_servers.studio.enabled_tools',productionStudioTools),...setting('mcp_servers.studio.default_tools_approval_mode','prompt'),
  ...productionStudioTools.flatMap(name=>setting('mcp_servers.studio.tools.'+name+'.approval_mode','approve')),
  'Production mode. Use Studio MCP for saved data mutations. Read D:/Doyin/AGENTS.md and D:/Doyin/video-system/RESUME.md, then read the bound Studio state. Preserve locked scenes and use current revisions. Inspect actual composition/playback and record concrete defects; do not fabricate reviews or approvals. Engine/schema/validator development belongs to a separate development session. If a required operation is unavailable, report the capability gap. Native rendering/export requires its separate authorization. Task:\n'+task];
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.platform!=='win32')throw Error('This launcher has only been designed for the verified Windows MXC profile');
  const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(2,i<0?undefined:i),i<0?true:a.slice(i+1)];}));
  if(!args['task-file'])throw Error('Use --project=<id> --task-file=<text> [--url=http://127.0.0.1:3022] [--run]');
  const workingDirectory=await mkdtemp(resolve(tmpdir(),'doyin-production-agent-')),task=await readFile(String(args['task-file']),'utf8');
  const invocation=productionCodexArgs({projectId:args.project,baseUrl:args.url,workingDirectory,task});
  if(!args.run){console.log(JSON.stringify({status:'prepared-not-launched',workingDirectory,command:'codex',args:invocation,note:'Use --run to launch. MXC startup fails closed when unsupported. This is not proof of client/MCP acceptance.'}));}
  else{
   await requireStudioProtocol(args.url??'http://127.0.0.1:3022',{sessionCookie:process.env.STUDIO_SESSION_COOKIE});
   for(const [script,extra] of [['verify-production-sandbox.mjs',['--backend=mxc']],['verify-production-network.mjs',[]]]){
    const probe=spawn(process.execPath,[resolve(import.meta.dirname,'scripts',script),...extra],{stdio:['ignore','inherit','inherit'],windowsHide:true});
    const probeCode=await new Promise((ok,fail)=>{probe.once('error',fail);probe.once('exit',ok);});if(probeCode!==0)throw Error('OS canary probe did not pass ('+script+'); production agent not launched');
   }
   const child=spawn(process.env.CODEX_CLI??'codex',invocation,{stdio:['ignore','inherit','inherit'],windowsHide:true,env:{...process.env,STUDIO_SESSION_COOKIE:process.env.STUDIO_SESSION_COOKIE??''}});
   process.exitCode=await new Promise((ok,fail)=>{child.once('error',fail);child.once('exit',code=>ok(code??1));});
  }
 }catch(e){console.error(e.message);process.exitCode=1;}
}
