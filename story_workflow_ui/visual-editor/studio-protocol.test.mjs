import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {requireStudioProtocol,studioAgentProtocol} from './studio-protocol.mjs';
import {createStudioMcp} from './studio-mcp.mjs';
const healthy={status:'ready',runtime:'standalone',identity:'a'.repeat(64),version:'b'.repeat(64),agentProtocol:studioAgentProtocol};
test('health/auth, wrong runtime and unsupported protocol fail closed; no historical fallback',async()=>{
 assert.equal((await requireStudioProtocol('http://127.0.0.1:3022',{fetchImpl:async()=>Response.json(healthy)})).status,'ready');
 for(const value of [{...healthy,agentProtocol:undefined},{...healthy,agentProtocol:{...studioAgentProtocol,version:2}},{...healthy,runtime:'other'},{}])await assert.rejects(requireStudioProtocol('http://127.0.0.1:3022',{fetchImpl:async()=>Response.json(value)}),/protocol/);
 await assert.rejects(requireStudioProtocol('http://127.0.0.1:3022',{fetchImpl:async()=>Response.json({},{status:401})}),/authentication/);
});
test('MCP refuses a write against an old backend before any mutation endpoint is reached',async()=>{
 const requests=[],server=createStudioMcp({projectId:'fixture',fetchImpl:async(url,options)=>{requests.push({url:String(url),method:options?.method??'GET'});return Response.json({...healthy,agentProtocol:undefined});}}),[clientSide,serverSide]=InMemoryTransport.createLinkedPair(),client=new Client({name:'protocol-probe',version:'1'});
 try{await server.connect(serverSide);await client.connect(clientSide);const result=await client.callTool({name:'studio_author_batch',arguments:{sceneId:'S',batchId:'must-not-write',revision:0,commands:[{op:'transform',layerId:'S/shot-0/object',values:{x:5}}],dryRun:false}});assert.equal(result.isError,true);assert.match(result.structuredContent.error,/protocol/);assert.deepEqual(requests,[{url:'http://127.0.0.1:3022/api/health',method:'GET'}]);}finally{await client.close();await server.close();}
});
