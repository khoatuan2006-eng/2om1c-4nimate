/**
 * build-ep02-all-in-one.mjs
 * 
 * LÀM LẠI TỪ ĐẦU - GỘP TẤT CẢ THÀNH 1 CẢNH DUY NHẤT (MASTER SCENE):
 * 
 * Toàn bộ trích đoạn novel/kịch bản được dựng trọn vẹn trong 1 Cảnh duy nhất:
 * ID: NEW-scene-ep02-master
 * Title: "Tập 2 · Con hẻm quanh co & Bờ tường hai mét"
 * Duration: 469 frames (~15.63s @ 30fps)
 * 
 * ĐẦY ĐỦ 5 CÂU THOẠI TRÊN DÒNG THỜI GIAN (5 CUES):
 * 1. "Con hẻm không hề rộng rãi, nhiều nhất chỉ đủ cho ba người đi song song" (0..119)
 * 2. "nhưng lại rất dài và quanh co." (119..179)
 * 3. "Các kiến trúc trong thị trấn này cực kỳ dày đặc," (179..249)
 * 4. "khi nhận ra điểm này, ánh mắt Nhật Thành khẽ chuyển, ngước nhìn lên bức tường rào ở hai bên con hẻm," (249..399)
 * 5. "bức tường bên trái chỉ cao chừng hai mét." (399..469)
 * 
 * DÒNG THỜI GIAN LIÊN TỤC KHÔNG ĐỨT ĐOẠN:
 * - Bối cảnh duy nhất bg:alley_wall trải dài 100% (0..469) với keyframe camera mượt mà.
 * - Nhân vật chính Nhật Thành xuất hiện xuyên suốt hành trình, từ đi qua hẻm, ngắm nhìn, sực nhận ra và bật nhảy!
 * - Nhóm người qua đường xuất hiện đúng câu 1 làm rõ độ hẹp của con hẻm.
 */

import { getProjectStore } from './project-store.mjs';
import { upsertStoryScene, renderSceneCV } from './story-scene-builder.mjs';

const projectId = 'project-f8fdfc00-b366-4b97-83a1-8e1e77337530';
const store = getProjectStore();

async function run() {
  console.log('=== LÀM LẠI TỪ ĐẦU: XÂY DỰNG 1 CẢNH MASTER TOÀN VẸN (469 FRAMES) ===\n');

  const sceneId = 'NEW-scene-ep02-master';

  const masterScene = await upsertStoryScene({
    projectId,
    sceneId,
    title: 'Tập 2 · Con hẻm quanh co & Bờ tường hai mét',
    durationFrames: 469,
    backgroundName: 'Con hẻm đá tường thấp bên trái',
    cues: [
      {
        text: 'Con hẻm không hề rộng rãi, nhiều nhất chỉ đủ cho ba người đi song song',
        from: 0,
        to: 119
      },
      {
        text: 'nhưng lại rất dài và quanh co.',
        from: 119,
        to: 179
      },
      {
        text: 'Các kiến trúc trong thị trấn này cực kỳ dày đặc,',
        from: 179,
        to: 249
      },
      {
        text: 'khi nhận ra điểm này, ánh mắt Nhật Thành khẽ chuyển, ngước nhìn lên bức tường rào ở hai bên con hẻm,',
        from: 249,
        to: 399
      },
      {
        text: 'bức tường bên trái chỉ cao chừng hai mét.',
        from: 399,
        to: 469
      }
    ],
    shots: [
      { from: 0, to: 119, label: 'Hẻm hẹp ba người đi' },
      { from: 119, to: 179, label: 'Hẻm dài và quanh co' },
      { from: 179, to: 249, label: 'Kiến trúc dày đặc bủa vây' },
      { from: 249, to: 399, label: 'Ánh mắt chuyển sang bờ rào' },
      { from: 399, to: 469, label: 'Bức tường hai mét & Bật nhảy' }
    ],
    layers: [
      // =======================================================================
      // 1. BỐI CẢNH DUY NHẤT TRẢI DÀI TOÀN BỘ 469 FRAMES (100% TIMELINE)
      // =======================================================================
      {
        layerKey: 'bg-alley-master',
        asset: 'bg:alley_wall',
        name: 'Con hẻm đá tường thấp bên trái · Nền chính liên tục',
        type: 'backgrounds',
        from: 0,
        to: 469,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 0, x: 0, y: 0, scale: 1.05 },
        keys: {
          scale: [
            { frame: 0, value: 1.05, easing: 'smooth' },
            { frame: 119, value: 1.05, easing: 'smooth' },
            { frame: 178, value: 1.20, easing: 'smooth' },
            { frame: 248, value: 1.32, easing: 'smooth' },
            { frame: 320, value: 1.25, easing: 'smooth' },
            { frame: 398, value: 1.30, easing: 'smooth' },
            { frame: 468, value: 1.15, easing: 'smooth' }
          ],
          x: [
            { frame: 0, value: 0, easing: 'smooth' },
            { frame: 119, value: 0, easing: 'smooth' },
            { frame: 178, value: -50, easing: 'smooth' },
            { frame: 248, value: -110, easing: 'smooth' },
            { frame: 320, value: -30, easing: 'smooth' },
            { frame: 398, value: -40, easing: 'smooth' },
            { frame: 468, value: -25, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: 0, easing: 'smooth' },
            { frame: 119, value: 0, easing: 'smooth' },
            { frame: 178, value: -25, easing: 'smooth' },
            { frame: 248, value: -70, easing: 'smooth' },
            { frame: 320, value: 80, easing: 'smooth' },
            { frame: 398, value: -60, easing: 'smooth' },
            { frame: 468, value: 0, easing: 'smooth' }
          ]
        }
      },

      // =======================================================================
      // 2. NHÂN VẬT CHÍNH: NHẬT THÀNH (XUYÊN SUỐT 0..400 FRAMES)
      // =======================================================================
      {
        layerKey: 'char-nt-main',
        asset: 'hero:frown',
        name: 'Nhật Thành · Diễn xuất chính xuyên suốt con hẻm',
        type: 'characters',
        from: 0,
        to: 400,
        left: 80,
        top: 140,
        width: 480,
        height: 850,
        base: { z: 10, x: -140, y: 70, scale: 1.25, flipX: true },
        keys: {
          x: [
            // Beat 1: Đi trong hẻm hẹp lướt qua người đi đường
            { frame: 0, value: -140, easing: 'smooth' },
            { frame: 80, value: -50, easing: 'smooth' },
            { frame: 119, value: 0, easing: 'smooth' },
            // Beat 2: Bước chậm lại nhìn khúc quanh sâu hun hút
            { frame: 150, value: 25, easing: 'smooth' },
            { frame: 178, value: 35, easing: 'smooth' },
            // Beat 3: Đứng nguyên vị trí bên trái hẻm quan sát các mái nhà
            { frame: 248, value: 35, easing: 'smooth' },
            // Beat 4: Ánh mắt sực nhận ra và quay người cất bước về phía chân tường
            { frame: 280, value: 0, easing: 'smooth' },
            { frame: 320, value: -30, easing: 'smooth' },
            { frame: 399, value: -80, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: 65, easing: 'smooth' },
            { frame: 119, value: 70, easing: 'smooth' },
            { frame: 178, value: 75, easing: 'smooth' },
            { frame: 248, value: 88, easing: 'smooth' },
            { frame: 320, value: 135, easing: 'smooth' },
            { frame: 399, value: 120, easing: 'smooth' }
          ],
          rotation: [
            { frame: 0, value: 2, easing: 'smooth' },
            { frame: 119, value: 0, easing: 'smooth' },
            { frame: 178, value: -2, easing: 'smooth' },
            { frame: 248, value: -10, easing: 'smooth' }, // Ngửa nhìn mái nhà
            { frame: 280, value: 6, easing: 'smooth' },   // Liếc mắt sang bờ rào
            { frame: 399, value: -8, easing: 'smooth' }   // Ngước nhìn mép bờ tường
          ]
        }
      },

      // =======================================================================
      // 3. NHẬT THÀNH: VƯƠN TAY BÁM GỜ TƯỜNG VÀ BẬT NHẢY (400..469 FRAMES)
      // =======================================================================
      {
        layerKey: 'char-nt-reach',
        asset: 'hero:reach',
        name: 'Nhật Thành · Bám gờ tường 2m và nhún chân bật nhảy',
        type: 'characters',
        from: 400,
        to: 469,
        left: 200,
        top: 75,
        width: 1024,
        height: 1536,
        base: { z: 10, x: -60, y: 70, scale: 0.65, flipX: false },
        keys: {
          y: [
            { frame: 400, value: 70, easing: 'smooth' },
            { frame: 425, value: 82, easing: 'smooth' }, // Nhún chân lấy đà
            { frame: 468, value: 30, easing: 'smooth' }  // Bật vươn người bám gờ tường
          ],
          scale: [
            { frame: 400, value: 0.65, easing: 'smooth' },
            { frame: 468, value: 0.67, easing: 'smooth' }
          ]
        }
      },

      // =======================================================================
      // 4. NGƯỜI ĐI ĐƯỜNG 1 (ÁO XANH 1) - XUẤT HIỆN TRONG CÂU 1 (0..119)
      // =======================================================================
      {
        layerKey: 'char-pedestrian-1',
        asset: 'pedestrian:1',
        name: 'Người qua đường 1 · Đi vào hẻm',
        type: 'characters',
        from: 0,
        to: 119,
        left: 735,
        top: 240,
        width: 450,
        height: 600,
        base: { z: 5, x: 250, y: 160, scale: 0.81, flipX: true },
        keys: {
          x: [
            { frame: 0, value: 250, easing: 'smooth' },
            { frame: 42, value: 160, easing: 'smooth' },
            { frame: 118, value: 85, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: 160, easing: 'smooth' },
            { frame: 42, value: 110, easing: 'smooth' },
            { frame: 118, value: 75, easing: 'smooth' }
          ],
          scale: [
            { frame: 0, value: 0.81, easing: 'smooth' },
            { frame: 42, value: 0.58, easing: 'smooth' },
            { frame: 118, value: 0.33, easing: 'smooth' }
          ]
        }
      },

      // =======================================================================
      // 5. NGƯỜI ĐI ĐƯỜNG 2 (ÁO XANH 2) - XUẤT HIỆN TRONG CÂU 1 (0..119)
      // =======================================================================
      {
        layerKey: 'char-pedestrian-2',
        asset: 'pedestrian:2',
        name: 'Người qua đường 2 · Đi vào hẻm',
        type: 'characters',
        from: 0,
        to: 119,
        left: 735,
        top: 240,
        width: 450,
        height: 600,
        base: { z: 4, x: 340, y: 172, scale: 0.79, flipX: true },
        keys: {
          x: [
            { frame: 0, value: 340, easing: 'smooth' },
            { frame: 42, value: 175, easing: 'smooth' },
            { frame: 118, value: 85, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: 172, easing: 'smooth' },
            { frame: 42, value: 118, easing: 'smooth' },
            { frame: 118, value: 73, easing: 'smooth' }
          ],
          scale: [
            { frame: 0, value: 0.79, easing: 'smooth' },
            { frame: 42, value: 0.56, easing: 'smooth' },
            { frame: 118, value: 0.32, easing: 'smooth' }
          ]
        }
      }
    ]
  });

  console.log('-> Đã tạo thành công Scene Master:', masterScene.sceneId, 'duration =', masterScene.duration, 'frames');

  // ===========================================================================
  // 6. KHÓA DỰ ÁN VỀ ĐÚNG 1 CẢNH DUY NHẤT (CLEAN SQLITE)
  // ===========================================================================
  console.log('\n[2/3] Dọn dẹp sạch toàn bộ các cảnh cũ, khóa project_order chỉ còn đúng 1 cảnh...');
  store.transaction(() => {
    // Xóa tất cả các cảnh cũ khác trong project này
    const allOldScenes = store.db.prepare('SELECT id FROM scenes WHERE project_id=? AND id!=?').all(projectId, sceneId);
    for (const row of allOldScenes) {
      store.db.prepare('DELETE FROM edit_history WHERE scene_id=?').run(row.id);
      store.db.prepare('DELETE FROM scenes WHERE id=?').run(row.id);
      console.log('   - Đã xóa cảnh cũ:', row.id);
    }

    // Cập nhật scene_order chỉ còn 1 cảnh duy nhất
    store.db.prepare('UPDATE projects SET scene_order=?, revision=revision+1, updated_at=? WHERE id=?')
      .run(JSON.stringify([sceneId]), new Date().toISOString(), projectId);
  });

  console.log('  -> Project scene_order hiện tại:', [sceneId]);

  // ===========================================================================
  // 7. XUẤT STORYBOARD KIỂM CHỨNG THỊ GIÁC (CV)
  // ===========================================================================
  console.log('\n[3/3] Xuất Storyboard kiểm chứng thị giác Computer Vision...');
  try {
    const sb = renderSceneCV({
      projectId,
      sceneId,
      frames: [50, 150, 220, 310, 435]
    });
    console.log('  -> Storyboard tạo tại:', sb?.storyboardPath);
  } catch (err) {
    console.warn('  Lưu ý CV:', err.message);
  }

  console.log('\n🎉 HOÀN THÀNH 100%: DỰ ÁN ĐÃ ĐƯỢC LÀM LẠI HOÀN TOÀN TỪ ĐẦU TRONG ĐÚNG 1 CẢNH DUY NHẤT!');
}

run().catch(err => {
  console.error('Lỗi xây dựng tập:', err);
  process.exit(1);
});

