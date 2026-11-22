// Real Claude CLI and real Studio MCP/API, deterministic LOCAL model stub.
// This verifies client transport/tool restrictions, never Claude reasoning or art.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {runtimeIdentity} from '../runtime-identity.mjs';

const options=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(2,i),a.slice(i+1)];}));
if(!options.manifest||!options.cli||!options.out)throw Error('Use --manifest=<isolated-acceptance.json> --cli=<official-claude-executable> --out=<evidence-folder>');
const manifest=JSON.parse(await readFile(options.manifest,'utf8')),folder=resolve(manifest.folder),rel=relative(resolve(tmpdir()),folder);
if(isAbsolute(rel)||rel.startsWith('..')||!basename(folder).startsWith('doyin-editor-test-')||manifest.projectId!=='story-acceptance')throw Error('Only the disposable story-acceptance fixture is permitted');
const url=new URL(manifest.base);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/')throw Error('Fixture must use loopback');
const health=await (await fetch(url.origin+'/api/health')).json();
assert.equal(health.identity,await runtimeIdentity({dataDirectory:join(folder,'data'),frontendDirectory:resolve(import.meta.dirname,'../dist')}),'Refuse a runtime that does not own the isolated fixture storage');
const canary=join(folder,'claude-client-canary.txt'),taskFile=join(folder,'claude-transport-task.txt');await writeFile(canary,'unchanged');
await writeFile(taskFile,'Local deterministic transport fixture. Do not render or export; this is not a storytelling or model quality review.');
const out=resolve(options.out);await mkdir(out,{recursive:true});
let stage=0,failure,inventory=[],state,transitionResult,writeResult;const requests=[],protocolPlaceholders=[];
const send=(res,model,block)=>{
 res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});
 const emit=(type,value)=>res.write('event: '+type+'\ndata: '+JSON.stringify({type,...value})+'\n\n');
 emit('message_start',{message:{id:'msg_fixture_'+stage,type:'message',role:'assistant',model,content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}});
 emit('content_block_start',{index:0,content_block:block.type==='tool_use'?{...block,input:{}}:{type:'text',text:''}});
 emit('content_block_delta',{index:0,delta:block.type==='tool_use'?{type:'input_json_delta',partial_json:JSON.stringify(block.input)}:{type:'text_delta',text:block.text}});
 emit('content_block_stop',{index:0});emit('message_delta',{delta:{stop_reason:block.type==='tool_use'?'tool_use':'end_turn',stop_sequence:null},usage:{output_tokens:1}});emit('message_stop',{});res.end();
};
const tool=(name,input)=>({type:'tool_use',id:'tool_fixture_'+stage,name,input});
const lastResult=body=>body.messages.flatMap(m=>Array.isArray(m.content)?m.content:[]).findLast(b=>b.type==='tool_result');
const resultText=result=>typeof result?.content==='string'?result.content:JSON.stringify(result?.content);
const server=createServer(async(req,res)=>{
 try{
  if(req.method!=='POST'){res.writeHead(404);res.end('{}');return;}
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2e6)throw Error('Fixture request too large');}const body=JSON.parse(raw);
  if(req.url.startsWith('/v1/messages/count_tokens')){res.setHeader('Content-Type','application/json');res.end('{"input_tokens":1}');return;}
  if(!req.url.startsWith('/v1/messages')){res.writeHead(404);res.end('{}');return;}
  const names=(body.tools??[]).map(t=>t.name);
  if(!names.includes('mcp__studio__studio_state')){send(res,body.model,{type:'text',text:'Local auxiliary request; no operation.'});return;}
  // Claude documents that a defer_loading placeholder may remain even when
  // ToolSearch is omitted from --tools. It is protocol metadata, not a local
  // execution capability. Check the CLI's actual init inventory below too.
  protocolPlaceholders.push(...(body.tools??[]).filter(t=>t.name==='DeferredToolPlaceholder'));
  const available=names.filter(name=>name!=='DeferredToolPlaceholder');
  inventory=available;assert(available.every(name=>name.startsWith('mcp__studio__')||name==='EndConversation'),'Unexpected built-in/external tool exposed: '+available.join(','));
  requests.push({stage,stream:body.stream,tools:names});
  if(stage===0){stage++;send(res,body.model,tool('mcp__studio__studio_state',{}));}
  else if(stage===1){const result=lastResult(body);assert(result&&!result.is_error,'Studio state call must execute');const text=resultText(result),match=text.match(/\{"value":/);assert(match,'Missing structured Studio response');
   // Native CLI may encode a JSON text block in its tool_result.
   const blocks=typeof result.content==='string'?[{text:result.content}]:result.content;
   const value=blocks.map(b=>{try{return JSON.parse(b.text).value;}catch{return null;}}).find(Boolean);assert.equal(value?.project.id,manifest.projectId);assert.equal(value.production.canExpand,false,'Fixture must still require review before testing denial');state=value;
   stage++;send(res,body.model,tool('mcp__studio__studio_transition',{revision:value.project.revision,action:'complete'}));}
  else if(stage===2){transitionResult=lastResult(body);assert.match(resultText(transitionResult),/PRODUCTION_GATE_FAILED|Review chưa đạt/);stage++;send(res,body.model,tool('Write',{file_path:canary,content:'modified'}));}
  else if(stage===3){writeResult=lastResult(body);assert(writeResult?.is_error===true,'Unavailable Write must be a tool error');assert.match(resultText(writeResult),/unknown|no such tool|not.*available|not.*found|unrecognized|does not exist|disabled for this session/i);stage++;send(res,body.model,{type:'text',text:'Local transport fixture complete; no model reasoning, artistic approval, rendering or export.'});}
  else send(res,body.model,{type:'text',text:'The local transport fixture has already finished. No operation.'});
 }catch(error){failure=error;res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({type:'error',error:{type:'invalid_request_error',message:error.message}}));}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|APPDATA|LOCALAPPDATA|TEMP|TMP|HOMEDRIVE|HOMEPATH)$/i.test(key)));
Object.assign(env,{CLAUDE_CLI:resolve(options.cli),ANTHROPIC_API_KEY:'doyin-local-stub-not-a-real-key',ANTHROPIC_BASE_URL:'http://127.0.0.1:'+server.address().port,CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1'});
const child=spawn(process.execPath,[resolve(import.meta.dirname,'../production-claude-client.mjs'),'--project='+manifest.projectId,'--url='+url.origin,'--task-file='+taskFile,'--run'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
const timer=setTimeout(()=>{failure??=Error('Claude fixture exceeded 90 seconds');child.kill();},90000);
let exitCode;try{exitCode=await new Promise((ok,fail)=>{child.once('error',fail);child.once('exit',ok);});}finally{clearTimeout(timer);await new Promise(ok=>server.close(ok));}
await writeFile(join(out,'claude-local-stub-client.jsonl'),stdout);await writeFile(join(out,'claude-local-stub-stderr.txt'),stderr);
const events=stdout.split(/\r?\n/).flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}}),init=events.find(e=>e.type==='system'&&e.subtype==='init');
try{assert(init?.tools.length>0);assert(init.tools.every(name=>name.startsWith('mcp__studio__')));assert.deepEqual(init.mcp_servers.map(s=>[s.name,s.status]),[['studio','connected']]);assert.equal(init.permissionMode,'dontAsk');}catch(error){failure??=error;}
const actualValue=await readFile(canary,'utf8'),passed=!failure&&exitCode===0&&stage===4&&actualValue==='unchanged';
const verification={status:passed?'pass':'not-verified',scope:'Real Claude CLI/production launcher/MCP/backend, deterministic localhost model stub only. No authenticated Claude model, creative review, native render or export.',fixture:{projectId:manifest.projectId,sceneId:manifest.sceneId},stage,exitCode,inventory,clientInit:init?{tools:init.tools,mcp_servers:init.mcp_servers,permissionMode:init.permissionMode}:null,state,transitionResult,writeResult,canary:{path:canary,actualValue},requests,protocolPlaceholders,error:failure?.message,stderr};
await writeFile(join(out,'claude-local-stub-verification.json'),JSON.stringify(verification,null,2));console.log(JSON.stringify({status:verification.status,stage,exitCode,canary:actualValue,error:failure?.message,evidence:out}));if(!passed)process.exitCode=1;
