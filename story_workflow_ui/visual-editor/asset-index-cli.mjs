// node visual-editor/asset-index-cli.mjs sync|stats|search <query> [--type=characters] [--db=path]
import {AssetIndex,defaultIndexPath,parseTranslations,applyNameTranslations} from './asset-index.mjs';
import {readFileSync} from 'node:fs';
const [,,command,...rest]=process.argv;
const flags=Object.fromEntries(rest.filter(a=>a.startsWith('--')).map(a=>{const [k,...v]=a.slice(2).split('=');return [k,v.join('=')||true];}));
const words=rest.filter(a=>!a.startsWith('--'));
const index=new AssetIndex(flags.db??defaultIndexPath());
try{
  if(command==='sync'){
    const {catalog}=await import('./library-server.mjs'); // read-only: scans the same catalog Studio uses
    console.log(JSON.stringify(index.sync(await catalog())),'\n'+JSON.stringify(index.stats(),null,1));
  }else if(command==='translate'){
    const result=applyNameTranslations(index,parseTranslations(readFileSync(new URL('./asset-name-translations.txt',import.meta.url),'utf8')));
    console.log(JSON.stringify({applied:result.applied,unknown:result.unknown},null,1));
  }else if(command==='stats')console.log(JSON.stringify(index.stats(),null,1));
  else if(command==='search')console.log(JSON.stringify(index.search(words.join(' '),{type:flags.type,kind:flags.kind,limit:Number(flags.limit??10)}),null,1));
  else console.error('usage: sync | translate | stats | search <query> [--type=] [--kind=] [--limit=] [--db=]');
}catch(error){console.error(error.stack??error);process.exitCode=1;}
finally{index.close();process.exit(process.exitCode??0);}
