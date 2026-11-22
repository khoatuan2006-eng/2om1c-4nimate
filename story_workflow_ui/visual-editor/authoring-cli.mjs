import {readFile,writeFile} from 'node:fs/promises';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(2,i),a.slice(i+1)];}));
if(!args.project||!args.scene||!args.file)throw Error('Use --project=<id> --scene=<id> --file=<batch.json> [--dry-run=true] [--out=<receipt.json>]');
const base=args.url??'http://127.0.0.1:3022',batch=JSON.parse(await readFile(args.file,'utf8'));if(args['dry-run']==='true')batch.dryRun=true;
const started=performance.now(),response=await fetch(base+'/api/authoring/projects/'+args.project+'/scenes/'+args.scene+'/batch',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(batch)}),result=await response.json();if(!response.ok)throw Error(result.error);
const summary={dryRun:result.dryRun??false,reused:result.reused??false,revision:result.document.revision,changes:result.changes??result.receipt?.changes,warnings:result.warnings??result.receipt?.warnings,timings:result.timings,roundTripMs:performance.now()-started};
if(args.out)await writeFile(args.out,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
