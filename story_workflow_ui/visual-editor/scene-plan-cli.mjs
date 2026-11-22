// node visual-editor/scene-plan-cli.mjs <plan.json> --out=<dir> [--fast=0,40,80] [--render=0,40,80] [--stage=<stage.json>]
// Compiles a scene plan against the real catalog into <dir>/document.json (+ report.json).
// --fast renders Tier-1 layout check PNGs via sharp (~1s, NOT for review/approval).
// --render renders Tier-2 canonical frames through the Studio Remotion composition.
// It never writes to Studio data: saving is a separate, revision-checked API call.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {catalog,catalogFilePath} from './library-server.mjs';
import {prepareLibraryImage} from './prepared-media.mjs';
import {prepareCatalogSelections} from './catalog-selection.mjs';
import {buildScene} from './scene-plan.mjs';

const [,,planFile,...rest]=process.argv;
const flags=Object.fromEntries(rest.filter(a=>a.startsWith('--')).map(a=>{const [k,...v]=a.slice(2).split('=');return [k,v.join('=')||true];}));
try{
  if(!planFile||!flags.out)throw Error('usage: scene-plan-cli.mjs <plan.json> --out=<dir> [--render=0,40,80] [--stage=<file>]');
  const out=resolve(flags.out),plan=JSON.parse(readFileSync(planFile,'utf8').replace(/^\uFEFF/,'')),stage=flags.stage?JSON.parse(readFileSync(flags.stage,'utf8')):undefined;
  const mediaDir=resolve(out,'media');
  mkdirSync(resolve(mediaDir,'library-assets'),{recursive:true});
  const current=await catalog();
  const scene=await buildScene(plan,{catalog:current,stage,mediaDirectory:mediaDir,prepareSelections:requests=>prepareCatalogSelections(requests,{catalogReader:async()=>current,prepare:async id=>{const file=catalogFilePath(id);if(!file)throw Error('Ảnh không thuộc kho: '+id);return prepareLibraryImage(file,id,mediaDir);}})});
  writeFileSync(resolve(out,'document.json'),JSON.stringify({source:scene.source,document:scene.document},null,1));
  writeFileSync(resolve(out,'report.json'),JSON.stringify({location:scene.resolved.location,uses:scene.resolved.uses,warnings:scene.warnings,duration:scene.source.duration},null,1));
  console.log(JSON.stringify({document:resolve(out,'document.json'),duration:scene.source.duration,layers:Object.keys(scene.document.layers).length,beats:scene.document.beats.items.length,warnings:scene.warnings,uses:scene.resolved.uses.map(u=>u.beat+':'+u.who+'='+u.pose+(u.face?'+'+u.face:''))}));
  if(flags.fast){
    const {renderFastFrames}=await import('./fast-preview.mjs'),frames=String(flags.fast).split(',').map(Number);
    const {buffers,elapsedMs}=await renderFastFrames({document:scene.document,frames,mediaDirectory:resolve(out,'media')});
    frames.forEach((f,i)=>writeFileSync(resolve(out,'fast-'+String(f).padStart(4,'0')+'.png'),buffers[i]));
    console.log('fast-preview',frames.join(','),'in',elapsedMs+'ms');
  }
  if(flags.render){
    const {captureCompositionFrames}=await import('./preview-evidence.mjs'),frames=String(flags.render).split(',').map(Number);
    const full={...scene.source,document:scene.document,from:0,to:scene.source.duration};
    const project={id:'plan-preview',title:plan.title??plan.id,revision:0,fps:30,width:1920,height:1080,sceneOrder:[full.id],lockedPrefix:[],duration:full.duration,scenes:[full]};
    mkdirSync(resolve(out,'work'),{recursive:true});
    const images=await captureCompositionFrames({project,scene:full,frames,workDirectory:resolve(out,'work'),mediaDirectory:resolve(out,'media')});
    frames.forEach((f,i)=>writeFileSync(resolve(out,'frame-'+String(f).padStart(4,'0')+'.png'),images[i]));console.log('rendered',frames.join(','));
  }
}catch(error){console.error(error.message);process.exitCode=1;}
process.exit(process.exitCode??0);
