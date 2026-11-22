import {createAuth} from './auth.mjs';
import {installEditorApi} from './editor-api.mjs';
import {defineConfig} from 'vite';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const require=createRequire(resolve(import.meta.dirname,'../../motion_intro/package.json'));
import {mediaRoot,dataRoot} from './project-store.mjs';
import {acquireDataLease} from './data-lease.mjs';
const legacyScenesTarget=existsSync(resolve(import.meta.dirname,'legacy-scenes.local.tsx'))
 ?resolve(import.meta.dirname,'legacy-scenes.local.tsx')
 :resolve(import.meta.dirname,'legacy-scenes.ts');
export default defineConfig({root:import.meta.dirname,publicDir:mediaRoot,
 build:{copyPublicDir:false},
 resolve:{alias:{react:dirname(require.resolve('react/package.json')),'react-dom':dirname(require.resolve('react-dom/package.json')),remotion:dirname(require.resolve('remotion/package.json')),'@remotion/player':dirname(require.resolve('@remotion/player/package.json')),'@legacy-scenes':legacyScenesTarget}},
 server:{host:'127.0.0.1',port:3022,strictPort:true,fs:{allow:[resolve(import.meta.dirname,'../..')]},watch:{ignored:['**/visual-editor/data/**','**/visual-editor/saved-edits.json','**/visual-editor/history/**','**/visual-editor/created-scenes/**','**/visual-editor/evidence/**']}},
 plugins:[{name:'editor-api',configureServer:server=>{const auth=createAuth();server.middlewares.use((req,res,next)=>{if(!auth.handle(req,res))next();});const release=acquireDataLease(dataRoot,{allowSameProcess:true});try{installEditorApi(server.middlewares);server.httpServer?.once('close',release);}catch(error){release();throw error;}}}],
});
