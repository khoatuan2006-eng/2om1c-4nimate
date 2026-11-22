import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attachLayer,worldMatrix,multiply,detachLayer} from './scene-graph.mjs';
import {calibrateSocket,bindSocket} from './attachment-sockets.mjs';
import {cameraPreset,parallaxMatrix} from './parallax.mjs';
import {captureAssembly,instantiateAssembly} from './assembly-library.mjs';
import {shiftAssembly,trimAssembly} from './assembly-timing.mjs';
import {validateDocument} from './model.mjs';
import {captureLayout,pasteLayout} from './assembly-clipboard.mjs';
const actor='S/shot-0/actor',sword='S/shot-0/sword';
const a={name:'Actor',type:'characters',poseKey:'pose-a',left:300,top:200,width:200,height:400,from:0,to:60,parts:[{src:'library-assets/'+'a'.repeat(64)+'.png',left:0,top:0,width:200,height:400}]};
const fixture=()=>({version:1,revision:0,layers:{[actor]:{asset:{...a}},[sword]:{asset:{...a,name:'Sword',type:'props',left:600,width:40,height:200}}}});
const point=(m,x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
const near=(a,b)=>{assert.ok(Math.abs(a.x-b.x)<1e-7,`${a.x} != ${b.x}`);assert.ok(Math.abs(a.y-b.y)<1e-7,`${a.y} != ${b.y}`);};
function bound(){let d=calibrateSocket(fixture(),actor,'hand-right',{x:.8,y:.4,rotation:10});d=attachLayer(d,sword,actor,0);return bindSocket(d,sword,'hand-right',{x:.5,y:.15},0);}
test('prop grip follows its authored socket through animated rotation, scale and both flips',()=>{
 const d=bound();d.layers[actor].keys={x:[{frame:0,value:0,easing:'linear'},{frame:59,value:120,easing:'linear'}],rotation:[{frame:0,value:0,easing:'linear'},{frame:59,value:90,easing:'linear'}],scale:[{frame:0,value:1,easing:'linear'},{frame:59,value:2,easing:'linear'}]};
 for(const flipX of [false,true])for(const flipY of [false,true]){d.layers[actor].base={flipX,flipY};for(const f of [0,15,29,59])near(point(worldMatrix(d.layers,sword,f),20,30),point(worldMatrix(d.layers,actor,f),160,160));}
});
test('switching pose automatically repositions and rotates prop to that pose socket; independent keys still apply',()=>{
 let d=bound();d.layers[actor].asset.poseKey='pose-b';d=calibrateSocket(d,actor,'hand-right',{x:.2,y:.6,rotation:85});near(point(worldMatrix(d.layers,sword,0),20,30),point(worldMatrix(d.layers,actor,0),40,240));
 assert.ok(Math.abs(worldMatrix(d.layers,sword,0)[1]-Math.sin(75*Math.PI/180))<1e-7);
 d.layers[sword].keys={x:[{frame:0,value:d.layers[sword].base.x,easing:'linear'},{frame:59,value:d.layers[sword].base.x+30,easing:'linear'}]};assert.notDeepEqual(worldMatrix(d.layers,sword,0),worldMatrix(d.layers,sword,59));validateDocument(d,60);
});
test('automatic parallax varies near and far planes while attached prop inherits parent depth',()=>{
 let d=cameraPreset(bound(),actor,'pan-right');d.layers[actor].depth=.25;
 assert.equal(parallaxMatrix(d.layers,actor,59)[4],-40);assert.equal(parallaxMatrix(d.layers,sword,59)[4],-40);
 d.layers[sword].depth=1.5;assert.equal(parallaxMatrix(d.layers,sword,59)[4],-240);
 d=cameraPreset(d,actor,'push-in');assert.ok(parallaxMatrix(d.layers,sword,59)[0]>parallaxMatrix(d.layers,actor,59)[0]);validateDocument(d,60);
});
test('reusable template retains calibrated poses and camera, remaps parent links, and does not mutate source',()=>{
 let d=cameraPreset(bound(),actor,'pan-right');d.layers[actor].layoutLocked=true;
 const t=captureAssembly(d,actor,'Actor with sword');let count=0;const n=instantiateAssembly({version:1,revision:0,layers:{}},t,'DEST',20,140,()=>String(++count));validateDocument(n.document,150);
 const root=n.document.layers[n.id],child=Object.values(n.document.layers).find(l=>l.parentId);assert.equal(root.camera.keys.x[0].frame,20);assert.equal(root.layoutLocked,true);assert.equal(root.sockets['hand-right']['pose-a'].x,.8);assert.equal(child.socketBinding.name,'hand-right');root.sockets['hand-right']['pose-a'].x=.1;assert.equal(d.layers[actor].sockets['hand-right']['pose-a'].x,.8);
});
test('moving a timeline group shifts every child and camera; trimming preserves valid camera endpoints',()=>{
 const d=cameraPreset(bound(),actor,'pan-right'),n=shiftAssembly(d,actor,20,100);assert.equal(n.layers[sword].asset.from,20);assert.equal(n.layers[actor].camera.keys.x[0].frame,20);near(point(worldMatrix(d.layers,sword,10),20,30),point(worldMatrix(n.layers,sword,30),20,30));validateDocument(n,100);
 const trimmed=trimAssembly(n,actor,30,70);validateDocument(trimmed,100);assert.equal(trimmed.layers[actor].camera.keys.x.at(-1).frame,69);
});
test('invalid socket and camera inputs fail validation before persistence',()=>{
 for(const patch of [{depth:-1},{sockets:{'hand-right':{'pose-a':{x:Infinity,y:.5}}}},{camera:{enabled:true,base:{x:0,y:0,scale:0},keys:{}}}]){const d=fixture();Object.assign(d.layers[actor],patch);assert.throws(()=>validateDocument(d,60));}
 const d=bound();d.layers[sword].socketBinding.reference.x=2;assert.throws(()=>validateDocument(d,60));
});
test('detach retains socket and parallax motion at every visible integer frame',()=>{
 const d=cameraPreset(bound(),actor,'push-in');d.layers[actor].depth=.25;d.layers[actor].keys={rotation:[{frame:0,value:0,easing:'linear'},{frame:59,value:270,easing:'linear'}]};const detached=detachLayer(d,sword);validateDocument(detached,60);assert.equal(detached.layers[sword].parentId,undefined);
 for(let f=0;f<60;f++){const before=multiply(parallaxMatrix(d.layers,sword,f),worldMatrix(d.layers,sword,f)),after=multiply(parallaxMatrix(detached.layers,sword,f),worldMatrix(detached.layers,sword,f));for(let i=0;i<6;i++)assert.ok(Math.abs(before[i]-after[i])<1e-7);}
});
test('layout copy/paste retains parent links, socket poses, locks and current camera snapshot',()=>{
 const d=cameraPreset(bound(),actor,'pan-right');d.layers[actor].layoutLocked=true;const clipboard=captureLayout(d,20);let count=0;const n=pasteLayout({version:1,revision:0,layers:{}},clipboard,'DEST',30,90,()=>String(++count));validateDocument(n,100);
 const root='DEST/shot-30/user-1',child='DEST/shot-30/user-2';assert.equal(n.layers[child].parentId,root);assert.equal(n.layers[root].layoutLocked,true);assert.equal(n.layers[root].sockets['hand-right']['pose-a'].x,.8);
 const before=multiply(parallaxMatrix(d.layers,sword,20),worldMatrix(d.layers,sword,20)),after=multiply(parallaxMatrix(n.layers,child,30),worldMatrix(n.layers,child,30));assert.deepEqual(after,before);
});
