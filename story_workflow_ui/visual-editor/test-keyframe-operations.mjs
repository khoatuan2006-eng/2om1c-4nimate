import test from 'node:test';
import assert from 'node:assert/strict';
import { trackKeys, editTrackKey, valueAt } from './model.mjs';

function createLayerWithKeys() {
  return {
    base: { x: 100, y: 200, scale: 1 },
    keys: {
      x: [
        { frame: 0, value: 100, easing: 'linear' },
        { frame: 30, value: 250, easing: 'smooth' },
        { frame: 60, value: 400, easing: 'linear' }
      ],
      y: [
        { frame: 0, value: 200, easing: 'linear' },
        { frame: 30, value: 350, easing: 'smooth' },
        { frame: 60, value: 200, easing: 'linear' }
      ]
    }
  };
}

test('trackKeys gathers combined position keys for x and y', () => {
  const layer = createLayerWithKeys();
  const keys = trackKeys(layer, 'position');
  assert.equal(keys.length, 3);
  assert.deepEqual(keys.map(k => k.frame), [0, 30, 60]);
  assert.equal(keys[1].easing, 'smooth');
});

test('editTrackKey updates position keyframe frame and easing', () => {
  const layer = createLayerWithKeys();
  // Move keyframe from 30 to 35
  const updated = editTrackKey(layer, 'position', 30, { frame: 35, easing: 'hold' });
  const keys = trackKeys(updated, 'position');
  assert.deepEqual(keys.map(k => k.frame), [0, 35, 60]);
  assert.equal(updated.keys.x.find(k => k.frame === 35).easing, 'hold');
  assert.equal(updated.keys.y.find(k => k.frame === 35).easing, 'hold');
});

test('editTrackKey removes position keyframe when remove: true', () => {
  const layer = createLayerWithKeys();
  const updated = editTrackKey(layer, 'position', 30, { remove: true });
  const keys = trackKeys(updated, 'position');
  assert.deepEqual(keys.map(k => k.frame), [0, 60]);
  assert.equal(updated.keys.x.length, 2);
  assert.equal(updated.keys.y.length, 2);
});

test('valueAt interpolates values between keyframes accurately', () => {
  const layer = createLayerWithKeys();
  const valAt15 = valueAt(layer, 15);
  // Linear between 0 (100) and 30 (250) is ~175
  assert.ok(valAt15.x > 100 && valAt15.x < 250);
  assert.ok(valAt15.y > 200 && valAt15.y < 350);
});

