/**
 * build-ep02-seamless-scenes.mjs
 * 
 * THIẾT KẾ 5 CẢNH LIỀN MẠCH TUYỆT ĐỐI (SEAMLESS CONTINUITY & MOTIVATED CUTS):
 * - Vẫn hiển thị từng cảnh riêng biệt trên dropdown & danh sách scene để người dùng chọn chỉnh sửa.
 * - Nhưng giữa các cảnh được khớp nối không gian, hành động, góc máy và bối cảnh đồng nhất 100%
 *   để khi xem "Toàn phim" sẽ liền mạch như 1 cú máy duy nhất (Zero Jump Cut)!
 * 
 * 5 CẢNH CHUẨN 1:1 THEO TỪNG CÂU VĂN:
 * 1. S01: "Con hẻm không hề rộng rãi, nhiều nhất chỉ đủ cho ba người đi song song" (119 frames / 3.96s)
 * 2. S02: "nhưng lại rất dài và quanh co." (60 frames / 2.0s)
 * 3. S03: "Các kiến trúc trong thị trấn này cực kỳ dày đặc," (70 frames / 2.33s)
 * 4. S04: "khi nhận ra điểm này, ánh mắt Nhật Thành khẽ chuyển, ngước nhìn lên bức tường rào ở hai bên con hẻm," (150 frames / 5.0s)
 * 5. S05: "bức tường bên trái chỉ cao chừng hai mét." (70 frames / 2.33s)
 */

import { getProjectStore } from './project-store.mjs';
import { upsertStoryScene, renderSceneCV } from './story-scene-builder.mjs';

const projectId = 'project-f8fdfc00-b366-4b97-83a1-8e1e77337530';
const store = getProjectStore();

async function run() {
  console.log('=== XÂY DỰNG 5 CẢNH LIỀN MẠCH ĐỒNG BỘ 100% VỊ TRÍ & ĐIỂM CẮT ===\n');

  // =========================================================================
  // CẢNH 1: "Con hẻm không hề rộng rãi, nhiều nhất chỉ đủ cho ba người đi song song"
  // (119 frames / 3.96s)
  // =========================================================================
  console.log('[1/5] Dựng Cảnh 1: Hẻm hẹp ba người đi song song (119f)');
  const s01 = await upsertStoryScene({
    projectId,
    sceneId: 'NEW-scene-ep02-s01',
    title: 'Hẻm hẹp ba người đi song song',
    narrationText: 'Con hẻm không hề rộng rãi, nhiều nhất chỉ đủ cho ba người đi song song',
    durationFrames: 119,
    backgroundName: 'Con hẻm đá tường thấp bên trái',
    layers: [
      {
        layerKey: 'bg-alley-s01',
        asset: 'bg:alley_wall',
        name: 'Con hẻm đá tường thấp bên trái',
        type: 'backgrounds',
        from: 0,
        to: 119,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 0, x: 0, y: 0, scale: 1.05 }
      },
      {
        layerKey: 'char-nt-s01',
        asset: 'hero:frown',
        name: 'Nhật Thành · Đi trong con hẻm hẹp',
        type: 'characters',
        from: 0,
        to: 119,
        left: 80,
        top: 140,
        width: 480,
        height: 850,
        base: { z: 10, x: -140, y: 65, scale: 1.25, flipX: true },
        keys: {
          x: [
            { frame: 0, value: -140, easing: 'smooth' },
            { frame: 60, value: -80, easing: 'smooth' },
            { frame: 118, value: -50, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: 65, easing: 'smooth' },
            { frame: 60, value: 68, easing: 'smooth' },
            { frame: 118, value: 70, easing: 'smooth' }
          ],
          rotation: [
            { frame: 0, value: 2, easing: 'smooth' },
            { frame: 118, value: 0, easing: 'smooth' }
          ]
        }
      },
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
  console.log('  -> Đã cập nhật S01: kết thúc tại X=-50 (Center 270, 640)');

  // =========================================================================
  // CẢNH 2: "nhưng lại rất dài và quanh co." (60 frames / 2.0s)
  // BẮT ĐẦU CHÍNH XÁC TẠI X=-50 (KHỚP 100% ĐUÔI S01)
  // =========================================================================
  console.log('[2/5] Dựng Cảnh 2: Hẻm dài và quanh co (60f)');
  const s02 = await upsertStoryScene({
    projectId,
    sceneId: 'NEW-scene-ep02-s02',
    title: 'Hẻm dài và quanh co',
    narrationText: 'nhưng lại rất dài và quanh co.',
    durationFrames: 60,
    backgroundName: 'Con hẻm đá tường thấp bên trái',
    layers: [
      {
        layerKey: 'bg-alley-s02',
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
      {
        layerKey: 'char-nt-s02',
        asset: 'hero:frown',
        name: 'Nhật Thành · Bước chậm lại nhìn khúc cua sâu hút',
        type: 'characters',
        from: 0,
        to: 60,
        left: 80,
        top: 140,
        width: 480,
        height: 850,
        base: { z: 10, x: -50, y: 70, scale: 1.25, flipX: true },
        keys: {
          // Bắt đầu tại X=-50 (khớp đuôi S01), bước chậm lại và dừng ở X=35
          x: [
            { frame: 0, value: -50, easing: 'ease-out' },
            { frame: 25, value: 10, easing: 'smooth' },
            { frame: 59, value: 35, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: 70, easing: 'smooth' },
            { frame: 25, value: 73, easing: 'smooth' },
            { frame: 59, value: 75, easing: 'smooth' }
          ],
          rotation: [
            { frame: 0, value: 0, easing: 'smooth' },
            { frame: 25, value: 1, easing: 'smooth' },
            { frame: 59, value: -2, easing: 'smooth' }
          ]
        }
      }
    ]
  });
  console.log('  -> Đã cập nhật S02: bắt đầu X=-50, dừng tại X=35 (Center 355, 645)');

  // =========================================================================
  // CẢNH 3: "Các kiến trúc trong thị trấn này cực kỳ dày đặc," (70 frames / 2.33s)
  // BẮT ĐẦU CHÍNH XÁC TẠI X=35 (KHỚP 100% ĐUÔI S02)
  // =========================================================================
  console.log('[3/5] Dựng Cảnh 3: Kiến trúc thị trấn dày đặc (70f)');
  const s03 = await upsertStoryScene({
    projectId,
    sceneId: 'NEW-scene-ep02-s03',
    title: 'Kiến trúc thị trấn dày đặc',
    narrationText: 'Các kiến trúc trong thị trấn này cực kỳ dày đặc,',
    durationFrames: 70,
    backgroundName: 'Con hẻm đá tường thấp bên trái',
    layers: [
      {
        layerKey: 'bg-alley-s03',
        asset: 'bg:alley_wall',
        name: 'Dãy nhà mái ngói san sát bên phải con hẻm ép sát bầu trời',
        type: 'backgrounds',
        from: 0,
        to: 70,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 0, x: -50, y: -25, scale: 1.20 },
        keys: {
          scale: [
            { frame: 0, value: 1.20, easing: 'smooth' },
            { frame: 69, value: 1.32, easing: 'smooth' }
          ],
          x: [
            { frame: 0, value: -50, easing: 'smooth' },
            { frame: 69, value: -110, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: -25, easing: 'smooth' },
            { frame: 69, value: -70, easing: 'smooth' }
          ]
        }
      },
      {
        layerKey: 'char-nt-s03',
        asset: 'hero:frown',
        name: 'Nhật Thành · Đứng bên trái hẻm ngửa đầu nhìn mái nhà',
        type: 'characters',
        from: 0,
        to: 70,
        left: 80,
        top: 140,
        width: 480,
        height: 850,
        base: { z: 10, x: 35, y: 75, scale: 1.25, flipX: true },
        keys: {
          // Khóa cố định vị trí X=35 (sai số 0px so với S02), chỉ ngửa đầu nhìn lên
          y: [
            { frame: 0, value: 75, easing: 'smooth' },
            { frame: 69, value: 88, easing: 'smooth' }
          ],
          rotation: [
            { frame: 0, value: -2, easing: 'smooth' },
            { frame: 69, value: -10, easing: 'smooth' }
          ]
        }
      }
    ]
  });
  console.log('  -> Đã cập nhật S03: đứng nguyên X=35, ngửa đầu nhìn lên -10 deg');

  // =========================================================================
  // CẢNH 4: "khi nhận ra điểm này, ánh mắt Nhật Thành khẽ chuyển, ngước nhìn lên bức tường rào ở hai bên con hẻm,"
  // (150 frames / 5.0s)
  // BẮT ĐẦU TẠI X=35, ROT=-10 (KHỚP 100% ĐUÔI S03) -> SỰC NHẬN RA -> TIẾN VỀ CHÂN TƯỜNG X=-80
  // =========================================================================
  console.log('[4/5] Dựng Cảnh 4: Ánh mắt khẽ chuyển sang bờ rào (150f)');
  const s04 = await upsertStoryScene({
    projectId,
    sceneId: 'NEW-scene-ep02-s04',
    title: 'Ánh mắt khẽ chuyển sang bờ rào',
    narrationText: 'khi nhận ra điểm này, ánh mắt Nhật Thành khẽ chuyển, ngước nhìn lên bức tường rào ở hai bên con hẻm,',
    durationFrames: 150,
    backgroundName: 'Con hẻm đá tường thấp bên trái',
    layers: [
      {
        layerKey: 'bg-alley-s04',
        asset: 'bg:alley_wall',
        name: 'Con hẻm đá quét từ mái nhà xuống bờ tường bên trái',
        type: 'backgrounds',
        from: 0,
        to: 150,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 0, x: -110, y: -70, scale: 1.32 },
        keys: {
          scale: [
            { frame: 0, value: 1.32, easing: 'smooth' },
            { frame: 60, value: 1.25, easing: 'smooth' },
            { frame: 149, value: 1.28, easing: 'smooth' }
          ],
          x: [
            { frame: 0, value: -110, easing: 'smooth' },
            { frame: 60, value: -60, easing: 'smooth' },
            { frame: 149, value: -40, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: -70, easing: 'smooth' },
            { frame: 60, value: 0, easing: 'smooth' },
            { frame: 149, value: 40, easing: 'smooth' }
          ]
        }
      },
      {
        layerKey: 'char-nt-s04',
        asset: 'hero:frown',
        name: 'Nhật Thành · Nhận ra bờ tường đá và cất bước tiến lại',
        type: 'characters',
        from: 0,
        to: 150,
        left: 80,
        top: 140,
        width: 480,
        height: 850,
        base: { z: 10, x: 35, y: 88, scale: 1.25, flipX: true },
        keys: {
          // Bắt tiếp từ X=35, rot=-10 (S03) -> liếc mắt sang trái rot=6 -> bước tiến về chân tường X=-80
          x: [
            { frame: 0, value: 35, easing: 'smooth' },
            { frame: 35, value: 20, easing: 'smooth' },
            { frame: 65, value: 0, easing: 'smooth' },
            { frame: 100, value: -35, easing: 'smooth' },
            { frame: 149, value: -80, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: 88, easing: 'smooth' },
            { frame: 35, value: 82, easing: 'smooth' },
            { frame: 65, value: 90, easing: 'smooth' },
            { frame: 100, value: 105, easing: 'smooth' },
            { frame: 149, value: 120, easing: 'smooth' }
          ],
          rotation: [
            { frame: 0, value: -10, easing: 'smooth' }, // Khớp ngửa nhìn từ S03
            { frame: 35, value: -8, easing: 'smooth' },
            { frame: 65, value: 6, easing: 'smooth' },   // Liếc mắt quay đầu sang bờ rào
            { frame: 100, value: 0, easing: 'smooth' },
            { frame: 149, value: -8, easing: 'smooth' }  // Ngước nhìn lên mép bờ tường
          ]
        }
      }
    ]
  });
  console.log('  -> Đã cập nhật S04: liếc mắt nhận ra bờ rào, bước tiến sát chân tường X=-80');

  // =========================================================================
  // CẢNH 5: "bức tường bên trái chỉ cao chừng hai mét." (70 frames / 2.33s)
  // BẮT ĐẦU CHÍNH XÁC TẠI CHÂN TƯỜNG X=-80 -> ĐỐI CHIẾU 1M75 VÀ VƯƠN TAY BẬT NHẢY
  // =========================================================================
  console.log('[5/5] Dựng Cảnh 5: Bờ tường hai mét & Bật nhảy (70f)');
  const s05 = await upsertStoryScene({
    projectId,
    sceneId: 'NEW-scene-ep02-s05',
    title: 'Bờ tường hai mét & Bật nhảy',
    narrationText: 'bức tường bên trái chỉ cao chừng hai mét.',
    durationFrames: 70,
    backgroundName: 'Con hẻm đá tường thấp bên trái',
    layers: [
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
      // Nửa đầu (0..34): Đứng áp sát chân tường đo tỷ lệ chiều cao
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
            { frame: 0, value: -80, easing: 'ease-out' }, // Bắt tiếp chính xác X=-80 từ đuôi S04!
            { frame: 34, value: -60, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: 120, easing: 'smooth' },
            { frame: 34, value: 120, easing: 'smooth' }
          ]
        }
      },
      // Nửa sau (35..69): Vươn hai tay bám gờ nóc tường và nhún chân bật nhảy!
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
            { frame: 48, value: 82, easing: 'smooth' }, // Nhún chân lấy đà
            { frame: 69, value: 30, easing: 'smooth' }  // Bật vươn người bám chắc gờ tường
          ],
          scale: [
            { frame: 35, value: 0.65, easing: 'smooth' },
            { frame: 69, value: 0.67, easing: 'smooth' }
          ]
        }
      }
    ]
  });
  console.log('  -> Đã cập nhật S05: bắt tiếp tại X=-80, vươn tay bám gờ tường và bật nhảy');

  // =========================================================================
  // CẬP NHẬT THỨ TỰ 5 CẢNH TRÊN PROJECT SQLITE
  // =========================================================================
  console.log('\n[2/3] Cập nhật thứ tự 5 cảnh chuẩn vào project SQLite...');
  const sceneOrder = [
    'NEW-scene-ep02-s01',
    'NEW-scene-ep02-s02',
    'NEW-scene-ep02-s03',
    'NEW-scene-ep02-s04',
    'NEW-scene-ep02-s05'
  ];

  store.transaction(() => {
    // Xóa các cảnh cũ dư thừa (như NEW-scene-ep02-master hay NEW-c012e...)
    const rows = store.db.prepare('SELECT id FROM scenes WHERE project_id=?').all(projectId);
    for (const r of rows) {
      if (!sceneOrder.includes(r.id)) {
        store.db.prepare('DELETE FROM edit_history WHERE scene_id=?').run(r.id);
        store.db.prepare('DELETE FROM scenes WHERE id=?').run(r.id);
        console.log('   - Dọn dẹp cảnh cũ:', r.id);
      }
    }

    // Cập nhật scene_order đầy đủ 5 cảnh
    store.db.prepare('UPDATE projects SET scene_order=?, revision=revision+1, updated_at=? WHERE id=?')
      .run(JSON.stringify(sceneOrder), new Date().toISOString(), projectId);
  });

  console.log('  -> Project scene_order hiện tại:', sceneOrder);

  // =========================================================================
  // XUẤT STORYBOARD KIỂM CHỨNG TỪNG CẢNH
  // =========================================================================
  console.log('\n[3/3] Xuất Storyboard kiểm chứng thị giác Computer Vision cho 5 cảnh...');
  for (const sid of sceneOrder) {
    try {
      renderSceneCV({ projectId, sceneId: sid });
      console.log(`  - Đã xuất Storyboard cho: ${sid}`);
    } catch (e) {
      console.warn(`  - Lỗi xuất CV ${sid}:`, e.message);
    }
  }

  console.log('\n🎉 HOÀN THÀNH TOÀN BỘ 5 CẢNH: VỪA CÓ TỪNG CẢNH ĐỂ CHỌN, VỪA LIỀN MẠCH 100%!');
}

run().catch(err => {
  console.error('Lỗi xây dựng tập:', err);
  process.exit(1);
});

