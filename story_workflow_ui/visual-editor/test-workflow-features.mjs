import test from 'node:test';
import assert from 'node:assert/strict';
import { splitLayerAtFrame } from './assembly-timing.mjs';
import { attachLayer, detachLayer } from './scene-graph.mjs';

const hash = 'a'.repeat(64);

function createMockDoc() {
  return {
    version: 1,
    revision: 1,
    layers: {
      'S01/shot-0/char-main': {
        asset: {
          name: 'Nhật Thành',
          type: 'characters',
          from: 0,
          to: 120,
          left: 100,
          top: 200,
          width: 300,
          height: 600,
          parts: [{ src: `library-assets/${hash}.png`, left: 0, top: 0, width: 300, height: 600 }]
        },
        base: { x: 50, y: 100, scale: 1, rotation: 0, flipX: false, flipY: false, z: 100 },
        keys: {
          x: [
            { frame: 0, value: 50, easing: 'smooth' },
            { frame: 60, value: 150, easing: 'smooth' },
            { frame: 120, value: 300, easing: 'smooth' }
          ]
        }
      },
      'S01/shot-0/prop-sword': {
        asset: {
          name: 'Thanh kiếm',
          type: 'props',
          from: 0,
          to: 120,
          left: 200,
          top: 300,
          width: 100,
          height: 200,
          parts: [{ src: `library-assets/${hash}.png`, left: 0, top: 0, width: 100, height: 200 }]
        },
        base: { x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, z: 110 }
      }
    }
  };
}

test('splitLayerAtFrame cleanly cuts a clip into two sequential parts', () => {
  const doc = createMockDoc();
  const cutFrame = 60;
  const result = splitLayerAtFrame(doc, 'S01/shot-0/char-main', cutFrame, 150, () => 'part2');

  const part1 = result.document.layers['S01/shot-0/char-main'];
  const part2 = result.document.layers[result.newLayerId];

  assert.ok(part1, 'Part 1 exists');
  assert.ok(part2, 'Part 2 exists');
  assert.equal(part1.asset.from, 0);
  assert.equal(part1.asset.to, 60);
  assert.equal(part2.asset.from, 60);
  assert.equal(part2.asset.to, 120);

  // Keyframes check: part 1 should have keys < 60, part 2 should have keys >= 60
  assert.ok(part1.keys.x.every(k => k.frame < 60), 'Part 1 keys are before cut');
  assert.ok(part2.keys.x.every(k => k.frame >= 60), 'Part 2 keys are at or after cut');
  assert.equal(part2.base.x, 150, 'Part 2 base x matches value at cut frame');
});

test('attachLayer and detachLayer work smoothly for parent-child objects', () => {
  const doc = createMockDoc();
  // Attach sword to character at frame 0
  const attached = attachLayer(doc, 'S01/shot-0/prop-sword', 'S01/shot-0/char-main', 0);
  const sword = attached.layers['S01/shot-0/prop-sword'];

  assert.equal(sword.parentId, 'S01/shot-0/char-main', 'Sword is attached to character');
  assert.ok(Array.isArray(sword.parentInverse), 'parentInverse matrix calculated');

  // Detach sword
  const detached = detachLayer(attached, 'S01/shot-0/prop-sword');
  const swordDetached = detached.layers['S01/shot-0/prop-sword'];

  assert.equal(swordDetached.parentId, undefined, 'Sword is detached and independent');
  assert.ok(swordDetached.keys.x.length > 0, 'Baked motion keys exist after detach');
});

test('splitLayerAtFrame on child preserves parent connection if parent covers cut frame', () => {
  const doc = createMockDoc();
  const attached = attachLayer(doc, 'S01/shot-0/prop-sword', 'S01/shot-0/char-main', 0);
  const result = splitLayerAtFrame(attached, 'S01/shot-0/prop-sword', 40, 150, () => 'sw2');

  const swordPart2 = result.document.layers[result.newLayerId];
  assert.equal(swordPart2.parentId, 'S01/shot-0/char-main', 'Child part 2 retains parent link');
});

