import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gridTarget} from './grid-navigation.mjs';
test('large image groups navigate directly and retain bounded focus at edges',()=>{
  assert.equal(gridTarget('End',0,146),145);
  assert.equal(gridTarget('ArrowRight',145,146),145);
  assert.equal(gridTarget('ArrowLeft',0,146),0);
  assert.equal(gridTarget('Home',145,146),0);
  assert.equal(gridTarget('Enter',0,146),null);
  assert.equal(gridTarget('Tab',0,146),null);
});
test('responsive pose rows support vertical navigation and incomplete rows',()=>{
  assert.equal(gridTarget('ArrowDown',2,7,3),5);
  assert.equal(gridTarget('ArrowDown',5,7,3),6);
  assert.equal(gridTarget('ArrowUp',5,7,3),2);
  assert.equal(gridTarget('ArrowDown',0,52,2),2);
  assert.equal(gridTarget('End',0,0,2),null);
  assert.equal(gridTarget('ArrowRight',-1,52,2),null);
});
