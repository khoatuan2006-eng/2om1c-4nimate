import test from 'node:test';
import assert from 'node:assert/strict';
import {productionCodexArgs,disabledProductionFeatures,productionStudioTools} from './production-client.mjs';
test('production invocation pins read-only MXC, never escalation, isolated cwd and bound MCP; it does not inherit user tool config',()=>{
 const args=productionCodexArgs({projectId:'project-a',workingDirectory:'C:/Temp/fixture',task:'Inspect saved state'});
 const configs=args.flatMap((a,i)=>a==='-c'?[args[i+1]]:[]);
 assert(configs.includes('default_permissions=":read-only"'));assert(configs.includes('windows.sandbox="mxc"'));assert(configs.includes('approval_policy="never"'));
 assert(configs.includes('mcp_servers.studio.env.STUDIO_PROJECT_ID="project-a"'));assert(args.includes('--ignore-user-config'));assert(args.includes('--ignore-rules'));
 assert(!args.includes('--add-dir'));assert(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
 assert(configs.includes('web_search="disabled"'));
 assert(configs.includes('mcp_servers.studio.enabled_tools='+JSON.stringify(productionStudioTools)));
 assert(configs.includes('mcp_servers.studio.default_tools_approval_mode="prompt"'));
 for(const name of productionStudioTools)assert(configs.includes('mcp_servers.studio.tools.'+name+'.approval_mode="approve"'));
 assert(!productionStudioTools.some(name=>name.includes('grant')||name.includes('authorize')||name.includes('claim')));
 for(const feature of ['apps','plugins','browser_use','computer_use','image_generation','multi_agent','hooks']){
  assert(disabledProductionFeatures.includes(feature));assert(args.some((arg,i)=>arg==='--disable'&&args[i+1]===feature));
 }
 assert.throws(()=>productionCodexArgs({projectId:'../wrong',workingDirectory:'C:/Temp',task:'Task'}));
 assert.throws(()=>productionCodexArgs({projectId:'p',baseUrl:'http://example.com',workingDirectory:'C:/Temp',task:'Task'}));
});
