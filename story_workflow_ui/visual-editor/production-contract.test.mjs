import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectProduction} from './production-contract.mjs';
const plan=JSON.parse(await readFile(new URL('../script-analysis/EP02/studio-plan.json',import.meta.url),'utf8'));
test('EP02 recipe conditions match authored layers without pretending visual approval',()=>{const result=inspectProduction(plan.tasks,plan.document);assert.equal(result.ok,true);assert.equal(result.reviewRequired,true);assert.equal(result.warnings.length,2);});
for(const [name,edit] of [
 ['missing contract',p=>delete p.document.production],
 ['unknown recipe version',p=>p.document.production.taskBindings.T01.recipeVersion=99],
 ['unacknowledged limits',p=>p.document.production.taskBindings.T07.acceptedLimits=[]],
 ['absent position keys',p=>p.document.layers[p.id+'/shot-0/T05b-hero'].keys={}],
 ['direction changes at different frames',p=>p.document.layers[p.id+'/shot-0/T05b-background'].keys.flipX[1].frame=361],
 ['missing attention target',p=>delete p.document.production.taskBindings.T03.target],
 ['missing contact description',p=>p.document.production.taskBindings.T07.contacts=[]],
 ['orphan task binding',p=>p.document.production.taskBindings.UNKNOWN={recipeId:'stock-hold',recipeVersion:1}]
])test('blocks '+name,()=>{const p=structuredClone(plan);edit(p);assert.equal(inspectProduction(p.tasks,p.document).ok,false);});
