import {readFile,writeFile} from 'node:fs/promises';
import {compileScriptPlan} from './script-plan.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(2,i),a.slice(i+1)];}));
if(!args.plan||(!args.project&&!args.title))throw Error('Use --plan=<file> --project=<id> or --title=<new project title> [--receipt=<file>]');
const base=args.url??'http://127.0.0.1:3022',plan=JSON.parse(await readFile(args.plan,'utf8'));compileScriptPlan(plan);if(!plan.document.production)throw Error('Plan mới cần production contract version1');
async function api(route,body){const response=await fetch(base+route,body?{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const result=await response.json();if(!response.ok)throw Error(result.error);return result;}
let projectId=args.project;
if(!projectId){const matches=(await api('/api/projects')).projects.filter(p=>p.title===args.title);if(matches.length>1)throw Error('Multiple projects match title; use --project');projectId=matches[0]?.id??(await api('/api/projects',{title:args.title})).id;}
const before=await api('/api/projects/'+projectId),result=await api('/api/script-plans/import',{projectId,revision:before.revision,plan}),after=await api('/api/projects/'+projectId);
const receipt={projectId,sceneId:result.scene.id,revision:after.revision,documentRevision:after.scenes.find(s=>s.id===result.scene.id).document.revision,reused:result.reused,digest:result.scene.scriptPlan.digest,url:base,at:new Date().toISOString()};
if(args.receipt)await writeFile(args.receipt,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
