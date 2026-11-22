import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createStudioMcp,WORKING_LAYER_V2_TOOLS} from './studio-mcp.mjs';

const protocolHeader={status:'ready',runtime:'standalone',identity:'a'.repeat(64),version:'b'.repeat(64),agentProtocol:{name:'doyin-studio-production',version:1}};
const okJson=body=>new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});

async function connectMcp({mode='v2',fetchImpl}){
  const server=createStudioMcp({baseUrl:'http://127.0.0.1:3022',projectId:'proj-test',fetchImpl,mode});
  const client=new Client({name:'test-client',version:'1.0.0'});
  const [cT,sT]=InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(sT),client.connect(cT)]);
  return {client,server,close:async()=>{await client.close();await server.close();}};
}

test('MCP mode=v2 exposes only the compact Working Layer v2 toolset (no legacy bloat)',async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{
    const path=new URL(url).pathname;
    calls.push({method:init?.method??'GET',path,body:init?.body?JSON.parse(init.body):null});
    if(path==='/api/health')return okJson(protocolHeader);
    if(path==='/api/scene-plans/preview')return okJson({
      tier:'tier-1-fast-layout-check',notForReview:true,duration:60,timingMode:'draft',beats:1,layers:2,warnings:[],uses:[],elapsedMs:120,
      frames:[{frame:10,pngBase64:Buffer.from('89504e470d0a1a0a','hex').toString('base64')}],
    });
    if(path==='/api/scene-plans/apply')return new Response(JSON.stringify({error:'Scene detached',code:'SCENE_DETACHED'}),{status:409,headers:{'Content-Type':'application/json'}});
    return okJson({});
  };

  const {client,close}=await connectMcp({mode:'v2',fetchImpl});
  try{
    const {tools}=await client.listTools();
    const names=tools.map(t=>t.name).sort();
    assert.deepEqual(names,[...WORKING_LAYER_V2_TOOLS].sort(),'v2 exposes exact compact tool list');
    assert(!names.includes('studio_plan_import'),'legacy script-plan import hidden in v2');
    assert(!names.includes('studio_author_batch'),'legacy raw batch hidden in v2');

    // scene_plan_preview returns PNG image + metadata text
    const prev=await client.callTool({name:'scene_plan_preview',arguments:{plan:{version:1,id:'s1'},frames:[10]}});
    assert.equal(prev.isError,undefined);
    assert.equal(prev.content[0].type,'image');
    assert.equal(prev.content[0].mimeType,'image/png');
    assert.equal(JSON.parse(prev.content[1].text).notForReview,true);

    // scene_plan_apply surfaces 409 SCENE_DETACHED cleanly
    const applied=await client.callTool({name:'scene_plan_apply',arguments:{revision:1,plan:{version:1,id:'s1'}}});
    assert.equal(applied.isError,true);
    assert.equal(applied.structuredContent.code,'SCENE_DETACHED');
    assert.equal(applied.structuredContent.httpStatus,409);
  }finally{
    await close();
  }
});
