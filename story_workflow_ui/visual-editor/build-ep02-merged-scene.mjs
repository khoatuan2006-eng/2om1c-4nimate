/**
 * build-ep02-merged-scene.mjs
 * 
 * DỒN TẤT CẢ 4 PHÂN CẢNH THÀNH 1 CẢNH DUY NHẤT (UNIFIED CONTINUOUS SCENE):
 * 
 * Toàn bộ diễn biến tiếp nối sau Cảnh 1 (Ba người qua lại) được gộp trọn vẹn trong 1 Cảnh 2:
 * - ID: NEW-scene-ep02-s02
 * - Title: "Hẻm quanh co & Bờ tường hai mét"
 * - Duration: 350 frames (11.67s @ 30fps)
 * 
 * CHIA 4 CÂU THOẠI / PHỤ ĐỀ TUẦN TỰ TRÊN TIMELINE (4 CUES):
 * 1. "nhưng lại rất dài và quanh co." (from: 0, to: 60)
 * 2. "Các kiến trúc trong thị trấn này cực kỳ dày đặc," (from: 60, to: 130)
 * 3. "khi nhận ra điểm này, ánh mắt Nhật Thành khẽ chuyển, ngước nhìn lên bức tường rào ở hai bên con hẻm," (from: 130, to: 280)
 * 4. "bức tường bên trái chỉ cao chừng hai mét." (from: 280, to: 350)
 * 
 * 4 PHÂN ĐOẠN ĐẠO DIỄN (4 SHOTS):
 * - Shot 1 (0..60): Bước vào con hẻm dài quanh co hun hút.
 * - Shot 2 (60..130): Đứng ngửa đầu nhìn kiến trúc nhà cửa san sát ép kín bầu trời.
 * - Shot 3 (130..280): MCU ánh mắt khẽ chuyển -> cất bước tiến thẳng về phía chân tường rào đá bên trái.
 * - Shot 4 (280..350): Áp sát chân tường đối chiếu chiều cao -> vươn 2 tay bám gờ nóc tường, nhún chân lấy đà bật nhảy!
 */

import { getProjectStore } from './project-store.mjs';
import { upsertStoryScene, renderSceneCV } from './story-scene-builder.mjs';

const projectId = 'project-f8fdfc00-b366-4b97-83a1-8e1e77337530';
const store = getProjectStore();

async function run() {
  console.log('=== DỒN TOÀN BỘ 4 ĐOẠN VÀO 1 CẢNH DUY NHẤT: NEW-scene-ep02-s02 (350 frames) ===\n');

  // 1. Dựng cảnh tích hợp 4 câu thoại
  const mergedScene = await upsertStoryScene({
    projectId,
    sceneId: 'NEW-scene-ep02-s02',
    title: 'Hẻm quanh co & Bờ tường hai mét',
    durationFrames: 350,
    backgroundName: 'Con hẻm đá tường thấp bên trái',
    cues: [
      {
        text: 'nhưng lại rất dài và quanh co.',
        from: 0,
        to: 60
      },
      {
        text: 'Các kiến trúc trong thị trấn này cực kỳ dày đặc,',
        from: 60,
        to: 130
      },
      {
        text: 'khi nhận ra điểm này, ánh mắt Nhật Thành khẽ chuyển, ngước nhìn lên bức tường rào ở hai bên con hẻm,',
        from: 130,
        to: 280
      },
      {
        text: 'bức tường bên trái chỉ cao chừng hai mét.',
        from: 280,
        to: 350
      }
    ],
    shots: [
      { from: 0, to: 60, label: 'Hẻm dài và quanh co' },
      { from: 60, to: 130, label: 'Kiến trúc thị trấn dày đặc' },
      { from: 130, to: 280, label: 'Ánh mắt chuyển sang bờ rào' },
      { from: 280, to: 350, label: 'Bức tường cao hai mét' }
    ],
    layers: [
      // -------------------------------------------------------------
      // BỐI CẢNH (BACKGROUNDS) - ĐỒNG NHẤT bg:alley_wall
      // -------------------------------------------------------------
      // Đoạn 1 (0..60): Push-in sâu vào khúc quanh dài hun hút
      {
        layerKey: 'bg-alley-curving',
        asset: 'bg:alley_wall',
        name: 'Con hẻm đá sâu hun hút quanh co',
        type: 'backgrounds',
        from: 0,
        to: 60,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 0, x: 0, y: 0, scale: 1.05 },
        keys: {
          scale: [
            { frame: 0, value: 1.05, easing: 'smooth' },
            { frame: 59, value: 1.20, easing: 'smooth' }
          ],
          x: [
            { frame: 0, value: 0, easing: 'smooth' },
            { frame: 59, value: -50, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: 0, easing: 'smooth' },
            { frame: 59, value: -25, easing: 'smooth' }
          ]
        }
      },
      // Đoạn 2 (60..130): Tilt-up dâng lên các dãy nhà san sát bủa vây
      {
        layerKey: 'bg-alley-dense-tiltup',
        asset: 'bg:alley_wall',
        name: 'Dãy nhà mái ngói san sát bên phải con hẻm ép sát bầu trời',
        type: 'backgrounds',
        from: 60,
        to: 130,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 0, x: -60, y: 60, scale: 1.20 },
        keys: {
          y: [
            { frame: 60, value: 60, easing: 'smooth' },
            { frame: 129, value: -70, easing: 'smooth' }
          ],
          x: [
            { frame: 60, value: -60, easing: 'smooth' },
            { frame: 129, value: -110, easing: 'smooth' }
          ],
          scale: [
            { frame: 60, value: 1.20, easing: 'smooth' },
            { frame: 129, value: 1.32, easing: 'smooth' }
          ]
        }
      },
      // Đoạn 3A (130..200): Hậu cảnh mờ trong góc cận MCU
      {
        layerKey: 'bg-mcu-alley',
        asset: 'bg:alley_wall',
        name: 'Hẻm đá mờ hậu cảnh',
        type: 'backgrounds',
        from: 130,
        to: 200,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 0, x: -100, y: -30, scale: 1.25 }
      },
      // Đoạn 3B (200..280): Góc nhìn hướng vào bức tường đá quét từ chân lên đỉnh
      {
        layerKey: 'bg-wall-gaze-low',
        asset: 'bg:alley_wall',
        name: 'Bức tường rào đá quét từ chân lên đỉnh',
        type: 'backgrounds',
        from: 200,
        to: 280,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 0, x: -30, y: 80, scale: 1.20 },
        keys: {
          y: [
            { frame: 200, value: 80, easing: 'smooth' },
            { frame: 279, value: -60, easing: 'smooth' }
          ],
          scale: [
            { frame: 200, value: 1.20, easing: 'smooth' },
            { frame: 279, value: 1.30, easing: 'smooth' }
          ]
        }
      },
      // Đoạn 4 (280..350): Góc ngang bờ tường 2 mét bên trái
      {
        layerKey: 'bg-wall-2m-measure',
        asset: 'bg:alley_wall',
        name: 'Bức tường đá hai mét bên trái',
        type: 'backgrounds',
        from: 280,
        to: 350,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 0, x: 0, y: 0, scale: 1.08 },
        keys: {
          scale: [
            { frame: 280, value: 1.08, easing: 'smooth' },
            { frame: 349, value: 1.15, easing: 'smooth' }
          ],
          x: [
            { frame: 280, value: 0, easing: 'smooth' },
            { frame: 349, value: -25, easing: 'smooth' }
          ]
        }
      },

      // -------------------------------------------------------------
      // DIỄN XUẤT NHÂN VẬT (CHARACTERS)
      // -------------------------------------------------------------
      // Đoạn 1 (0..60): Bước chậm lại ở bên trái con hẻm, nhìn sâu vào khúc quanh
      {
        layerKey: 'char-nt-curve',
        asset: 'hero:frown',
        name: 'Nhật Thành · Bước chậm lại nhìn khúc cua sâu hút',
        type: 'characters',
        from: 0,
        to: 60,
        left: 80,
        top: 140,
        width: 480,
        height: 850,
        base: { z: 10, x: -70, y: 70, scale: 1.25, flipX: true },
        keys: {
          x: [
            { frame: 0, value: -70, easing: 'ease-out' },
            { frame: 25, value: 20, easing: 'smooth' },
            { frame: 59, value: 35, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: 70, easing: 'smooth' },
            { frame: 59, value: 75, easing: 'smooth' }
          ],
          rotation: [
            { frame: 0, value: 3, easing: 'smooth' },
            { frame: 59, value: -2, easing: 'smooth' }
          ]
        }
      },
      // Đoạn 2 (60..130): Đứng nguyên vị trí bên trái hẻm, ngửa đầu nhìn mái nhà
      {
        layerKey: 'char-nt-lookup-roofs',
        asset: 'hero:frown',
        name: 'Nhật Thành · Đứng bên trái con hẻm ngửa đầu nhìn các tầng nhà bủa vây',
        type: 'characters',
        from: 60,
        to: 130,
        left: 80,
        top: 140,
        width: 480,
        height: 850,
        base: { z: 10, x: 35, y: 75, scale: 1.25, flipX: true },
        keys: {
          y: [
            { frame: 60, value: 75, easing: 'smooth' },
            { frame: 129, value: 88, easing: 'smooth' }
          ],
          rotation: [
            { frame: 60, value: -2, easing: 'smooth' },
            { frame: 129, value: -10, easing: 'smooth' }
          ]
        }
      },
      // Đoạn 3A (130..200): Cận cảnh MCU - ngửa nhìn rồi liếc nhanh sang bờ rào bên trái
      {
        layerKey: 'char-nt-face-mcu',
        asset: 'hero:frown',
        name: 'Nhật Thành · MCU ngửa nhìn mái nhà rồi liếc nhanh sang bờ rào bên trái',
        type: 'characters',
        from: 130,
        to: 200,
        left: 620,
        top: 360,
        width: 800,
        height: 1250,
        base: { z: 10, x: 0, y: -15, scale: 1.40, flipX: true },
        keys: {
          rotation: [
            { frame: 130, value: -7, easing: 'smooth' },
            { frame: 155, value: -7, easing: 'smooth' },
            { frame: 185, value: 6, easing: 'smooth' },
            { frame: 199, value: 6, easing: 'smooth' }
          ],
          x: [
            { frame: 130, value: 0, easing: 'smooth' },
            { frame: 155, value: 0, easing: 'smooth' },
            { frame: 185, value: -70, easing: 'smooth' },
            { frame: 199, value: -75, easing: 'smooth' }
          ],
          y: [
            { frame: 130, value: -15, easing: 'smooth' },
            { frame: 155, value: -15, easing: 'smooth' },
            { frame: 185, value: 5, easing: 'smooth' },
            { frame: 199, value: 5, easing: 'smooth' }
          ]
        }
      },
      // Đoạn 3B (200..280): Bước tiến sát lại chân tường rào đá bên trái
      {
        layerKey: 'char-nt-gaze-wall',
        asset: 'hero:calm',
        name: 'Nhật Thành · Bước tiến sát lại chân tường rào đá bên trái',
        type: 'characters',
        from: 200,
        to: 280,
        left: 200,
        top: 140,
        width: 480,
        height: 850,
        base: { z: 10, x: 140, y: 135, scale: 1.26, flipX: false },
        keys: {
          x: [
            { frame: 200, value: 140, easing: 'smooth' },
            { frame: 235, value: 30, easing: 'smooth' },
            { frame: 279, value: -80, easing: 'smooth' }
          ],
          y: [
            { frame: 200, value: 135, easing: 'smooth' },
            { frame: 279, value: 120, easing: 'smooth' }
          ],
          rotation: [
            { frame: 200, value: 0, easing: 'smooth' },
            { frame: 238, value: -5, easing: 'smooth' },
            { frame: 279, value: -9, easing: 'smooth' }
          ]
        }
      },
      // Đoạn 4A (280..315): Đứng áp sát chân tường đo chiều cao 1m75 vs 2m
      {
        layerKey: 'char-nt-measure',
        asset: 'hero:calm',
        name: 'Nhật Thành · Bước sát chân tường đối chiếu',
        type: 'characters',
        from: 280,
        to: 315,
        left: 200,
        top: 140,
        width: 480,
        height: 850,
        base: { z: 10, x: -80, y: 120, scale: 1.25, flipX: false },
        keys: {
          x: [
            { frame: 280, value: -80, easing: 'ease-out' },
            { frame: 314, value: -60, easing: 'smooth' }
          ],
          y: [
            { frame: 280, value: 120, easing: 'smooth' },
            { frame: 314, value: 120, easing: 'smooth' }
          ]
        }
      },
      // Đoạn 4B (315..350): Vươn hai tay bám gờ nóc tường, nhún chân lấy đà bật nhảy
      {
        layerKey: 'char-nt-reach-ledge',
        asset: 'hero:reach',
        name: 'Nhật Thành · Tay chạm gờ nóc tường 2 mét và nhún chân lấy đà bật nhảy',
        type: 'characters',
        from: 315,
        to: 350,
        left: 200,
        top: 75,
        width: 480,
        height: 850,
        base: { z: 10, x: -60, y: 70, scale: 1.25, flipX: false },
        keys: {
          y: [
            { frame: 315, value: 70, easing: 'smooth' },
            { frame: 328, value: 82, easing: 'smooth' }, // Nhún chân lấy đà
            { frame: 349, value: 45, easing: 'smooth' }  // Bật vươn bám gờ tường
          ],
          scale: [
            { frame: 315, value: 1.25, easing: 'smooth' },
            { frame: 349, value: 1.27, easing: 'smooth' }
          ]
        }
      }
    ]
  });

  console.log('-> Đã cập nhật xong Cảnh 2:', mergedScene.sceneId, 'duration =', mergedScene.duration, 'frames');

  // 2. Dọn dẹp các cảnh rời cũ khỏi project để giữ cấu trúc tinh gọn
  console.log('\n[2/3] Dọn dẹp các cảnh rời cũ khỏi SQLite project_order...');
  const oldSceneIds = [
    'NEW-scene-ep02-s03',
    'NEW-scene-ep02-s04',
    'NEW-scene-ep02-s05',
    'NEW-scene-ep02-s06'
  ];

  store.transaction(() => {
    // Xóa các cảnh cũ khỏi bảng scenes và edit_history
    for (const sid of oldSceneIds) {
      store.db.prepare('DELETE FROM edit_history WHERE scene_id=?').run(sid);
      store.db.prepare('DELETE FROM scenes WHERE id=?').run(sid);
    }

    // Cập nhật lại scene_order của project chỉ còn 2 cảnh: Cảnh 1 (test) & Cảnh 2 (Hẻm quanh co & Bờ tường hai mét)
    const newOrder = [
      'NEW-c012e45c-b322-4e65-8be3-064f06f33b01',
      'NEW-scene-ep02-s02'
    ];
    store.db.prepare('UPDATE projects SET scene_order=?, revision=revision+1, updated_at=? WHERE id=?')
      .run(JSON.stringify(newOrder), new Date().toISOString(), projectId);
  });

  console.log('  -> Project scene_order hiện tại:', ['NEW-c012e45c-b322-4e65-8be3-064f06f33b01', 'NEW-scene-ep02-s02']);

  // 3. Xuất storyboard CV kiểm chứng thị giác cho Cảnh 2 tích hợp
  console.log('\n[3/3] Xuất kiểm chứng thị giác Computer Vision (Storyboard)...');
  const sb = renderSceneCV({
    projectId,
    sceneId: 'NEW-scene-ep02-s02',
    frames: [30, 95, 165, 240, 300, 340]
  });
  console.log('  -> Storyboard tạo tại:', sb.storyboardPath);

  console.log('\n🎉 HOÀN TẤT DỒN 4 PHÂN CẢNH VÀO 1 CẢNH DUY NHẤT THÀNH CÔNG!');
}

run().catch(err => {
  console.error('Lỗi xây dựng tập:', err);
  process.exit(1);
});

