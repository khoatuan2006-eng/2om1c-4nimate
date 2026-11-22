import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createAuth} from './auth.mjs';
import {testRuntime} from './test-runtime.mjs';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {resolve,join} from 'node:path';
let fixture,stamp=100000;
const password='studio-test-password-only';
before(async()=>{fixture=await testRuntime({authOptions:{password,sessionMs:5000,now:()=>stamp}});});
after(async()=>{await fixture?.close();});
const login=(value=password,origin=fixture.base)=>fetch(fixture.base+'/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password:value}),redirect:'manual'});
test('authentication is opt-in and rejects empty/weak configuration',()=>{
 assert.equal(createAuth({password:undefined}).enabled,false);
 for(const password of ['', 'short', 'a'.repeat(1025)])assert.throws(()=>createAuth({password}),/EDITOR_PASSWORD/);
});
test('unauthenticated API, static and media requests are blocked; HTML redirects to login',async()=>{
 for(const path of ['/api/projects','/api/health','/generated/audio/private.mp3','/assets/app.js'])assert.equal((await fetch(fixture.base+path)).status,401);
 const response=await fetch(fixture.base,{headers:{Accept:'text/html'},redirect:'manual'});assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/auth/login');
 const page=await fetch(fixture.base+'/auth/login');assert.equal(page.status,200);assert.match(await page.text(),/Đăng nhập Studio/);
});
test('wrong passwords and foreign origins fail; health-only probe does not grant other API access',async()=>{
 assert.equal((await login('wrong')).status,401);assert.equal((await login(password,'https://evil.example')).status,403);
 const headers={Authorization:'Bearer '+password};assert.equal((await fetch(fixture.base+'/api/health',{headers})).status,200);assert.equal((await fetch(fixture.base+'/api/projects',{headers})).status,401);
});
test('login establishes HttpOnly SameSite session, rotation revokes old session, logout revokes current session',async()=>{
 const first=await login();assert.equal(first.status,303);const value=first.headers.get('set-cookie');assert.match(value,/HttpOnly/);assert.match(value,/SameSite=Strict/);const cookie=value.split(';')[0];
 assert.equal((await fetch(fixture.base+'/api/projects',{headers:{Cookie:cookie}})).status,200);
 const rotated=await fetch(fixture.base+'/auth/login',{method:'POST',headers:{Origin:fixture.base,Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password}),redirect:'manual'});
 const nextCookie=rotated.headers.get('set-cookie').split(';')[0];assert.notEqual(nextCookie,cookie);assert.equal((await fetch(fixture.base+'/api/projects',{headers:{Cookie:cookie}})).status,401);
 const response=await fetch(fixture.base+'/auth/logout',{method:'POST',headers:{Origin:fixture.base,Cookie:nextCookie},redirect:'manual'});assert.equal(response.status,303);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await fetch(fixture.base+'/api/projects',{headers:{Cookie:nextCookie}})).status,401);
});
test('expired and forged sessions cannot access data',async()=>{
 const response=await login(),cookie=response.headers.get('set-cookie').split(';')[0];stamp+=5001;
 for(const Cookie of [cookie,'studio_session=forged'])assert.equal((await fetch(fixture.base+'/api/projects',{headers:{Cookie}})).status,401);
});
test('repeated failures are rate limited and recover after the cooldown',async()=>{
 for(let i=0;i<5;i++)assert.equal((await login('wrong')).status,401);
 assert.equal((await login()).status,429);stamp+=60001;assert.equal((await login()).status,303);
});
test('launcher reuses authenticated runtime with matching password and rejects a mismatched password',async()=>{
 for(const [credential,expectedCode] of [[password,0],['different-password',1]]){
  const child=fork(resolve(import.meta.dirname,'launch-editor.mjs'),[],{windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,EDITOR_DATA_DIR:join(fixture.folder,'data'),EDITOR_FRONTEND_DIR:fixture.frontendRoot,EDITOR_PORT:new URL(fixture.base).port,EDITOR_PASSWORD:credential,EDITOR_NO_BROWSER:'1'}});
  let ready;child.on('message',message=>{if(message.type==='ready')ready=message;});child.stdout.resume();child.stderr.resume();
  const timer=setTimeout(()=>child.kill(),15000);try{await once(child,'exit');}finally{clearTimeout(timer);}
  assert.equal(child.exitCode,expectedCode);assert.equal(!!ready,expectedCode===0);if(ready)assert.equal(ready.reused,true);
 }
});
