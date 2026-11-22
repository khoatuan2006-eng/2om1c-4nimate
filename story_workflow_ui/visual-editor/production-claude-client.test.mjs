import test from 'node:test';
import assert from 'node:assert/strict';
import {productionClaudeArgs,requireClaudeCapabilities} from './production-claude-client.mjs';
import {productionStudioTools} from './production-client.mjs';
test('Claude production invocation removes built-ins and inherited MCP/settings without bypass permissions',()=>{
 const args=productionClaudeArgs({projectId:'fixture',task:'Read saved state',configFile:'mcp.json',settingsFile:'settings.json',instructionsFile:'instructions.txt'});
 assert.equal(args[args.indexOf('--tools')+1],'');assert.equal(args[args.indexOf('--setting-sources')+1],'');
 for(const flag of ['--restricted','--strict-mcp-config','--no-chrome','--disable-slash-commands','--no-session-persistence'])assert(args.includes(flag));
 for(const name of productionStudioTools)assert(args.includes('mcp__studio__'+name));assert(!args.includes('--allowedTools=mcp__studio__*'));assert(!args.includes('--dangerously-skip-permissions'));
 assert.throws(()=>productionClaudeArgs({projectId:'../foreign',task:'Task'}));
 assert.throws(()=>productionClaudeArgs({projectId:'fixture',baseUrl:'https://remote.example',task:'Task'}));
});
test('unsupported Claude CLI cannot silently drop production restrictions',()=>{
 const help='--restricted --tools --strict-mcp-config --setting-sources --permission-prompts --append-system-prompt-file';
 requireClaudeCapabilities('2.1.318 (Claude Code)',help);
 assert.throws(()=>requireClaudeCapabilities('2.1.200 (Claude Code)',help));
 assert.throws(()=>requireClaudeCapabilities('3.0.0 (Claude Code)',help));
 assert.throws(()=>requireClaudeCapabilities('2.1.318 (Claude Code)',help.replace('--restricted','')));
});
