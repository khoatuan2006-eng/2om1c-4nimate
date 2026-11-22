import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProjectStore } from './project-store.mjs';
import { upsertStoryScene, renderSceneCV } from './story-scene-builder.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = __dirname;
const CONFIG_PATH = path.join(ROOT_DIR, 'wall_quad_config.json');
const MEDIA_DIR = path.join(ROOT_DIR, 'data', 'media', 'library-assets');
const PROJECT_ID = 'project-f8fdfc00-b366-4b97-83a1-8e1e77337530';
const SCENE_ID = 'NEW-scene-ep02-s05';

export async function applyWallHudToScene(customConfig = null) {
  if (customConfig) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(customConfig, null, 2), 'utf8');
  }

  // 1. Run python HUD generator
  const pyScript = path.join(ROOT_DIR, 'render_wall_hud.py');
  execSync(`python "${pyScript}"`, { stdio: 'inherit' });

  // 2. Read hashes of generated assets
  const getHash = (name) => {
    const p = path.join(MEDIA_DIR, `prop_wall_hud_${name}.png`);
    const buf = fs.readFileSync(p);
    return import('crypto').then(c => c.createHash('sha256').update(buf).digest('hex'));
  };

  const hashGrid = await getHash('grid');
  const hashBrackets = await getHash('brackets');
  const hashArrow = await getHash('arrow');
  const hashLaser = await getHash('laser');

  const arrowMetaPath = path.join(ROOT_DIR, 'wall_arrow_meta.json');
  const arrowMeta = fs.existsSync(arrowMetaPath)
    ? JSON.parse(fs.readFileSync(arrowMetaPath, 'utf8'))
    : { left: 789, top: 351, width: 96, height: 461 };

  console.log('HUD Assets for Scene 5:');
  console.log('  - Grid:', hashGrid);
  console.log('  - Brackets:', hashBrackets);
  console.log('  - Arrow:', hashArrow);
  console.log('  - Laser:', hashLaser);

  // 3. Upsert Scene 5 in SQLite with smooth, synchronized keyframe choreography
  const s05 = await upsertStoryScene({
    projectId: PROJECT_ID,
    sceneId: SCENE_ID,
    title: 'Bờ tường hai mét & Bật nhảy',
    narrationText: 'bức tường bên trái chỉ cao chừng hai mét.',
    durationFrames: 70,
    backgroundName: 'Con hẻm đá tường thấp bên trái',
    layers: [
      // 0. Background alley
      {
        layerKey: 'bg-alley-s05',
        asset: 'bg:alley_wall',
        name: 'Bờ tường đá hai mét bên trái',
        type: 'backgrounds',
        from: 0,
        to: 70,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 0, x: 0, y: 0, scale: 1.08 },
        keys: {
          scale: [
            { frame: 0, value: 1.08, easing: 'smooth' },
            { frame: 69, value: 1.15, easing: 'smooth' }
          ],
          x: [
            { frame: 0, value: 0, easing: 'smooth' },
            { frame: 69, value: -25, easing: 'smooth' }
          ]
        }
      },
      // 1. Holographic Perspective Grid (z: 5, behind character)
      {
        layerKey: 'prop-wall-grid-s05',
        asset: {
          hash: hashGrid,
          name: 'Lưới phối cảnh 3D bức tường',
          type: 'props',
          width: 1920,
          height: 1080
        },
        name: 'Lưới phối cảnh 3D bức tường',
        type: 'props',
        from: 0,
        to: 48,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 5, x: 0, y: 0, scale: 1.08 },
        keys: {
          scale: [
            { frame: 0, value: 1.08, easing: 'smooth' },
            { frame: 24, value: 1.095, easing: 'smooth' },
            { frame: 48, value: 1.13, easing: 'smooth' }
          ],
          x: [
            { frame: 0, value: 0, easing: 'smooth' },
            { frame: 48, value: -18, easing: 'smooth' }
          ]
        }
      },
      // 2. Corner Brackets & Telemetry HUD (z: 6)
      {
        layerKey: 'prop-wall-brackets-s05',
        asset: {
          hash: hashBrackets,
          name: 'Khung định vị mục tiêu bờ tường',
          type: 'props',
          width: 1920,
          height: 1080
        },
        name: 'Khung định vị mục tiêu bờ tường',
        type: 'props',
        from: 0,
        to: 48,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 6, x: 0, y: 0, scale: 1.08 },
        keys: {
          scale: [
            { frame: 0, value: 1.08, easing: 'smooth' },
            { frame: 48, value: 1.13, easing: 'smooth' }
          ],
          x: [
            { frame: 0, value: 0, easing: 'smooth' },
            { frame: 48, value: -18, easing: 'smooth' }
          ]
        }
      },
      // 3. Dynamic Laser Scan Sweep (z: 8, sweeps across from frame 0 to 18)
      {
        layerKey: 'prop-wall-laser-s05',
        asset: {
          hash: hashLaser,
          name: 'Tia quét laser bờ tường',
          type: 'props',
          width: 1920,
          height: 1080
        },
        name: 'Tia quét laser bờ tường',
        type: 'props',
        from: 0,
        to: 18,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 8, x: -700, y: 0, scale: 1.08 },
        keys: {
          x: [
            { frame: 0, value: -700, easing: 'ease-out' },
            { frame: 8, value: 0, easing: 'smooth' },
            { frame: 17, value: 850, easing: 'ease-in' }
          ],
          scale: [
            { frame: 0, value: 1.08, easing: 'smooth' },
            { frame: 17, value: 1.10, easing: 'smooth' }
          ]
        }
      },
      // 4. Character Part 1 (0..35): Đứng quan sát trầm tĩnh đo chiều cao
      {
        layerKey: 'char-nt-measure-s05',
        asset: 'hero:calm',
        name: 'Nhật Thành · Đứng áp sát chân tường đo chiều cao',
        type: 'characters',
        from: 0,
        to: 35,
        left: 200,
        top: 140,
        width: 480,
        height: 850,
        base: { z: 10, x: -80, y: 120, scale: 1.25, flipX: false },
        keys: {
          x: [
            { frame: 0, value: -80, easing: 'ease-out' },
            { frame: 34, value: -60, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: 120, easing: 'smooth' },
            { frame: 34, value: 120, easing: 'smooth' }
          ]
        }
      },
      // 5. Dimension Arrow (2M Callout) with Spring Expansion (z: 15, from 10 to 48)
      // Tight bounding box matching arrow dimensions (NOT 1920x1080) so user can edit other objects!
      {
        layerKey: 'prop-wall-dim-s05',
        asset: {
          hash: hashArrow,
          name: 'Mũi tên kích thước 2m (HUD)',
          type: 'props',
          width: arrowMeta.width,
          height: arrowMeta.height
        },
        name: 'Mũi tên kích thước 2m (HUD)',
        type: 'props',
        from: 10,
        to: 48,
        left: arrowMeta.left,
        top: arrowMeta.top,
        width: arrowMeta.width,
        height: arrowMeta.height,
        base: { z: 15, x: 0, y: 0, scale: 0.1 },
        keys: {
          // Spring expansion as laser completes the scan
          scale: [
            { frame: 10, value: 0.1, easing: 'ease-out' },
            { frame: 18, value: 1.14, easing: 'ease-out' },
            { frame: 23, value: 1.08, easing: 'smooth' },
            { frame: 47, value: 1.13, easing: 'smooth' }
          ],
          x: [
            { frame: 10, value: 0, easing: 'smooth' },
            { frame: 47, value: -18, easing: 'smooth' }
          ]
        }
      },
      // 6. Character Part 2 (35..70): Vươn hai tay bám gờ nóc tường và nhún chân bật nhảy!
      {
        layerKey: 'char-nt-reach-s05',
        asset: 'hero:reach',
        name: 'Nhật Thành · Bám gờ tường 2m và nhún chân bật nhảy',
        type: 'characters',
        from: 35,
        to: 70,
        left: 200,
        top: 75,
        width: 1024,
        height: 1536,
        base: { z: 10, x: -60, y: 70, scale: 0.65, flipX: false },
        keys: {
          y: [
            { frame: 35, value: 70, easing: 'smooth' },
            { frame: 48, value: 82, easing: 'smooth' },
            { frame: 69, value: 30, easing: 'smooth' }
          ],
          scale: [
            { frame: 35, value: 0.65, easing: 'smooth' },
            { frame: 69, value: 0.67, easing: 'smooth' }
          ]
        }
      }
    ]
  });

  console.log('✅ Đã cập nhật Scene 5 với đầy đủ 5 tầng hiệu ứng công nghệ và animation mượt mà!');

  // 4. Render updated CV Storyboards
  try {
    renderSceneCV({ projectId: PROJECT_ID, sceneId: SCENE_ID });
    console.log('✅ Đã cập nhật Storyboard CV cho Scene 5.');
  } catch (e) {
    console.warn('Lỗi xuất CV:', e.message);
  }

  return { success: true, hashGrid, hashBrackets, hashArrow, hashLaser };
}

if (process.argv[1] && process.argv[1].endsWith('apply-wall-hud-to-s05.mjs')) {
  applyWallHudToScene().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
