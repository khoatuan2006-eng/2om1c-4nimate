/**
 * story-scene-builder.test.mjs
 * Kiểm thử toàn diện thư viện story-scene-builder.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  KNOWN_ASSETS,
  resolveAsset,
  sanitizeKeyframes,
  createLayer,
  buildSceneDefinition,
  upsertStoryScene,
  renderSceneCV
} from './story-scene-builder.mjs';

const TEST_PROJECT_ID = 'isolated-plan-fixture';

describe('story-scene-builder module', () => {
  it('phân giải chính xác các alias tài nguyên đã biết', async () => {
    const bg = await resolveAsset('bg:alley_wall');
    assert.equal(bg.type, 'backgrounds');
    assert.equal(bg.hash, KNOWN_ASSETS['bg:alley_wall'].hash);
    assert.ok(bg.src.startsWith('library-assets/'));

    const hero = await resolveAsset('hero:frown');
    assert.equal(hero.type, 'characters');
    assert.equal(hero.hash, KNOWN_ASSETS['hero:frown'].hash);
  });

  it('chuẩn hóa keyframe: tự động gán easing và loại bỏ trùng lặp frame', () => {
    const rawKeys = [
      { frame: 20, value: 100 },
      { frame: 0, value: 50 },
      { frame: 20, value: 120 }, // Trùng frame 20
      { frame: 10, value: 80, easing: 'linear' }
    ];
    const sanitized = sanitizeKeyframes(rawKeys, 'x');
    assert.equal(sanitized.length, 3);
    assert.equal(sanitized[0].frame, 0);
    assert.equal(sanitized[0].easing, 'smooth');
    assert.equal(sanitized[1].frame, 10);
    assert.equal(sanitized[1].easing, 'linear');
    assert.equal(sanitized[2].frame, 20);
  });

  it('tạo layer đúng định dạng Studio và vượt qua regex layer ID', async () => {
    const { id, layer } = await createLayer({
      sceneId: 'NEW-scene-test',
      shotIndex: 0,
      layerKey: 'hero-action',
      asset: 'hero:reach',
      duration: 100,
      base: { x: 100, y: 200, scale: 0.9 },
      keys: {
        y: [{ frame: 0, value: 200 }, { frame: 50, value: 150 }]
      }
    });

    assert.equal(id, 'NEW-scene-test/shot-0/user-hero-action');
    assert.equal(layer.asset.to, 100);
    assert.equal(layer.base.x, 100);
    assert.equal(layer.keys.y.length, 2);
    assert.equal(layer.keys.y[1].easing, 'smooth');
  });

  it('xây dựng cấu trúc scene hoàn chỉnh với kind=created và tính thời lượng tự động', async () => {
    const sampleText = 'Đây là câu thoại kiểm tra tự động dựng cảnh.';
    const { source, document } = await buildSceneDefinition({
      projectId: TEST_PROJECT_ID,
      sceneId: 'NEW-scene-builder-test',
      title: 'Kiểm thử Scene Builder',
      durationFrames: 90,
      backgroundName: 'Hẻm quán rượu',
      layers: [
        {
          layerKey: 'bg',
          asset: 'bg:alley_wall'
        },
        {
          layerKey: 'hero',
          asset: 'hero:frown',
          base: { x: 200, y: 150 }
        }
      ]
    });

    assert.equal(source.kind, 'created', 'Bắt buộc phải có kind=created để Remotion hiển thị');
    assert.ok(source.duration > 0);
    assert.deepEqual(source.cues, []);
    assert.equal(source.duration, 90);
    assert.equal(Object.keys(document.layers).length, 2);
  });

  it('refuses legacy direct writes before touching storage or generating audio', async () => {
    await assert.rejects(upsertStoryScene({projectId:TEST_PROJECT_ID,narrationText:'Must not invoke a provider'}), {code:'DIRECT_SCENE_WRITE_DISABLED'});
  });

  it('refuses evidence from an alternate renderer', () => {
    assert.throws(()=>renderSceneCV({projectId:TEST_PROJECT_ID,sceneId:'fixture'}), {code:'ALTERNATE_RENDERER_DISABLED'});
  });
});
