import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {productionTarget,productionStudioTools} from './production-client.mjs';
import {requireStudioProtocol} from './studio-protocol.mjs';

// Capability restriction, not a claim that native Windows has a shell sandbox.
// The model gets no built-in file/command/browser tools; only the bound Studio MCP.
export function productionClaudeArgs({projectId,baseUrl,task,configFile,settingsFile,instructionsFile}){
 productionTarget({projectId,baseUrl,task});
 return ['--restricted','--print','--output-format','stream-json','--verbose','--no-session-persistence',
  '--tools','','--strict-mcp-config','--mcp-config',resolve(configFile),'--no-chrome','--disable-slash-commands',
  '--setting-sources','','--settings',resolve(settingsFile),'--permission-mode','dontAsk','--permission-prompts','none',
  '--allowedTools',...productionStudioTools.map(name=>'mcp__studio__'+name),'--append-system-prompt-file',resolve(instructionsFile),task];
}
export function requireClaudeCapabilities(version,help){
 const match=/\b2\.1\.(\d+)\b/.exec(version);
 if(!match||Number(match[1])<259)throw Error('Claude Code 2.1.259+ in the verified 2.1 CLI family is required; revalidate other versions before use');
 for(const flag of ['--restricted','--tools','--strict-mcp-config','--setting-sources','--permission-prompts'])if(!help.includes(flag))throw Error('Claude CLI lacks required restriction: '+flag);
}
const inspect=async(command,args,cwd)=>{
 const child=spawn(command,args,{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const code=await new Promise((ok,fail)=>{child.once('error',fail);child.once('exit',ok);});return {code,stdout,stderr};
};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const options=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(2,i<0?undefined:i),i<0?true:a.slice(i+1)];}));
  if(!options['task-file'])throw Error('Use --project=<id> --task-file=<text> [--url=http://127.0.0.1:3022] [--check|--run]');
  const task=await readFile(String(options['task-file']),'utf8'),{origin}=productionTarget({projectId:options.project,baseUrl:options.url,task});
  const workingDirectory=await mkdtemp(join(tmpdir(),'doyin-production-claude-')),configFile=join(workingDirectory,'mcp.json'),settingsFile=join(workingDirectory,'settings.json'),instructionsFile=join(workingDirectory,'instructions.txt');
  const documents=['../../AGENTS.md','../../video-system/RESUME.md','../../video-system/PRODUCTION-WORKFLOW.md','../../.agents/skills/studio-storytelling/SKILL.md','../../.agents/skills/studio-storytelling/references/contract.md','../../creative-memory/RESUME.md','../../creative-memory/STYLE-HANDBOOK.md'];
  const instructions=await Promise.all(documents.map(async path=>{const file=resolve(import.meta.dirname,path);return '\nSOURCE '+file+'\n'+await readFile(file,'utf8');}));
  await writeFile(instructionsFile,'Studio production mode. Use only the bound Studio tools. Read studio_state for current revisions; these policy texts are not the workflow cursor. Do not invent approval, playback observations or scores. Missing preview/playback capabilities must be reported, never simulated. Export requires separate owner authorization.\n'+instructions.join('\n'));
  await writeFile(configFile,JSON.stringify({mcpServers:{studio:{command:process.execPath,args:[resolve(import.meta.dirname,'studio-mcp.mjs')],env:{STUDIO_URL:origin,STUDIO_PROJECT_ID:options.project,...(process.env.STUDIO_SESSION_COOKIE?{STUDIO_SESSION_COOKIE:process.env.STUDIO_SESSION_COOKIE}:{})}}}}));
  await writeFile(settingsFile,JSON.stringify({disableAllHooks:true,permissions:{defaultMode:'dontAsk',allow:productionStudioTools.map(name=>'mcp__studio__'+name),deny:['Bash','PowerShell','Read','Write','Edit','NotebookEdit','Agent','WebFetch','WebSearch','Skill']}}));
  const args=productionClaudeArgs({projectId:options.project,baseUrl:origin,task,configFile,settingsFile,instructionsFile}),command=process.env.CLAUDE_CLI??'claude';
  if(!options.check&&!options.run){console.log(JSON.stringify({status:'prepared-not-launched',workingDirectory,command,args,note:'Use --check to validate local CLI/auth, --run for an authenticated client. Not an OS sandbox or proof of model tool inventory.'}));}
  else{
   await requireStudioProtocol(origin,{sessionCookie:process.env.STUDIO_SESSION_COOKIE});
   const version=await inspect(command,['--version'],workingDirectory),help=await inspect(command,['--help'],workingDirectory);if(version.code||help.code)throw Error('Cannot inspect Claude CLI');requireClaudeCapabilities(version.stdout,help.stdout);
   // Some supported options (including prompt-file) are hidden from --help.
   // Parse the complete invocation without requesting a model turn.
   const parsed=await inspect(command,[...args.slice(0,-1),'--version'],workingDirectory);if(parsed.code!==0)throw Error('Claude CLI rejected production flags: '+parsed.stderr.slice(0,1000));
   const auth=await inspect(command,['auth','status'],workingDirectory);let authenticated=false;try{authenticated=JSON.parse(auth.stdout).loggedIn===true;}catch{}
   if(auth.code!==0||!authenticated)throw Error('Claude Code is not authenticated. Owner must sign in outside the production session; no model was launched.');
   if(options.check&&!options.run)console.log(JSON.stringify({status:'cli-and-auth-ready-not-model-verified',version:version.stdout.trim(),workingDirectory}));
   else{const child=spawn(command,args,{cwd:workingDirectory,windowsHide:true,stdio:['ignore','inherit','inherit']});process.exitCode=await new Promise((ok,fail)=>{child.once('error',fail);child.once('exit',code=>ok(code??1));});}
  }
 }catch(error){console.error(error.message);process.exitCode=1;}
}
