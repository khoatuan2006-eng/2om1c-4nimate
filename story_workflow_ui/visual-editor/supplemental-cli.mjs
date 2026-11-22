import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mediaRoot} from './project-store.mjs';
import {registerSupplement,supplementalCatalog} from './supplemental-catalog.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(2,i),a.slice(i+1)];}));
const root=args['media-root']?resolve(args['media-root']):mediaRoot;
if(args.file){const record=await registerSupplement(JSON.parse(await readFile(args.file,'utf8')),root);console.log(JSON.stringify({id:record.id,revision:record.revision,issues:record.provenance.integrityIssues},null,2));}
else console.log(JSON.stringify(await supplementalCatalog(root),null,2));
