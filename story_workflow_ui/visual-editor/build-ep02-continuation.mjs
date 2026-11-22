/**
 * build-ep02-continuation.mjs
 * 
 * ĐỒNG BỘ 100% MỘT BỐI CẢNH DUY NHẤT & NỐI TIẾP KHÔNG GIAN LIÊN TỤC:
 * Bối cảnh: Con hẻm đá tường thấp bên trái (bg:alley_wall - a0f85d91...)
 * 
 * CHUỖI NỐI TIẾP HÀNH ĐỘNG & ĐIỂM NHÌN (CUT-TO-CUT MATCH-ON-ACTION & EYE-TRACE):
 * - S01: Toàn cảnh hẻm chật hẹp, 3 người qua lại. (Locked Anchor)
 * - S02: Nhật Thành đi vào khúc quanh con hẻm bên trái (dừng lại tại X=115, mắt nhìn sâu vào hẻm).
 * - S03: GIỮ NGUYÊN VỊ TRÍ X=115 BÊN TRÁI. Camera tilt-up lên mái nhà san sát, Nhật Thành ngửa đầu nhìn lên (-10 deg).
 * - S04: MCU Cận cảnh: Bắt đầu bằng tư thế ngửa đầu nhìn lên (-7 deg), sực nhận ra -> liếc mắt quay đầu sang bức tường bên trái (+6 deg).
 * - S05: Camera theo hướng nhìn: Bức tường rào đá bên trái; Nhật Thành quay sang trái bước tiến sát về chân tường (X: 140 -> -80).
 * - S06: Bắt tiếp bước chân tại chân tường (X: -80 -> -60): Đứng đối chiếu 1m75 vs bờ tường 2m -> vươn 2 tay bám gờ tường và nhún chân lấy đà bật nhảy!
 */

import { getProjectStore } from './project-store.mjs';
import { upsertStoryScene, renderSceneCV } from './story-scene-builder.mjs';

const projectId = 'project-f8fdfc00-b366-4b97-83a1-8e1e77337530';
const store = getProjectStore();

async function run() {
  console.log('=== THIẾT KẾ NỐI TIẾP KHÔNG GIAN & HÀNH ĐỘNG LIÊN TỤC (MATCH-ON-ACTION) ===\n');

  // =========================================================================
  // CẢNH 2: "nhưng lại rất dài và quanh co." (60 frames / 2.0s)
  // Con hẻm đá - Bước chậm lại ở bên trái con hẻm, nhìn sâu vào khúc cua
  // =========================================================================
  console.log('[1/5] Dựng Cảnh 2: "nhưng lại rất dài và quanh co."');
  const s02 = await upsertStoryScene({
    projectId,
    sceneId: 'NEW-scene-ep02-s02',
    title: 'Hẻm dài và quanh co',
    narrationText: 'nhưng lại rất dài và quanh co.',
    durationFrames: 60,
    backgroundName: 'Con hẻm đá uốn lượn sâu hút',
    layers: [
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
      {
        layerKey: 'char-nt-stop-curve',
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
      }
    ]
  });
  console.log('  -> Đã cập nhật S02: duration', s02.duration, 'frames (dừng tại X=115, Y=215)');

  // =========================================================================
  // CẢNH 3: "Các kiến trúc trong thị trấn này cực kỳ dày đặc," (70 frames / 2.33s)
  // NỐI TIẾP S02: Nhật Thành đứng đúng vị trí X=115 bên trái (left: 80, x: 35).
  // Camera tilt-up lên mái ngói; Nhật Thành ngửa đầu nhìn lên các tầng nhà bủa vây.
  // =========================================================================
  console.log('[2/5] Dựng Cảnh 3: "Các kiến trúc trong thị trấn này cực kỳ dày đặc," (Bảo toàn vị trí bên trái hẻm)');
  const s03 = await upsertStoryScene({
    projectId,
    sceneId: 'NEW-scene-ep02-s03',
    title: 'Kiến trúc thị trấn dày đặc',
    narrationText: 'Các kiến trúc trong thị trấn này cực kỳ dày đặc,',
    durationFrames: 70,
    backgroundName: 'Các tầng nhà mái ngói ép sát con hẻm',
    layers: [
      {
        layerKey: 'bg-alley-dense-tiltup',
        asset: 'bg:alley_wall',
        name: 'Dãy nhà mái ngói san sát bên phải con hẻm ép sát bầu trời',
        type: 'backgrounds',
        from: 0,
        to: 70,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 0, x: -60, y: 60, scale: 1.20 },
        keys: {
          y: [
            { frame: 0, value: 60, easing: 'smooth' },
            { frame: 69, value: -70, easing: 'smooth' }
          ],
          x: [
            { frame: 0, value: -60, easing: 'smooth' },
            { frame: 69, value: -110, easing: 'smooth' }
          ],
          scale: [
            { frame: 0, value: 1.20, easing: 'smooth' },
            { frame: 69, value: 1.32, easing: 'smooth' }
          ]
        }
      },
      {
        layerKey: 'char-nt-lookup-roofs',
        asset: 'hero:frown',
        name: 'Nhật Thành · Đứng bên trái con hẻm ngửa đầu nhìn các tầng nhà bủa vây',
        type: 'characters',
        from: 0,
        to: 70,
        left: 80, // Giữ chuẩn vị trí bên trái từ S02!
        top: 140,
        width: 480,
        height: 850,
        base: { z: 10, x: 35, y: 75, scale: 1.25, flipX: true },
        keys: {
          y: [
            { frame: 0, value: 75, easing: 'smooth' },
            { frame: 69, value: 88, easing: 'smooth' }
          ],
          rotation: [
            { frame: 0, value: -2, easing: 'smooth' }, // Bắt tiếp -2 từ cuối S02
            { frame: 69, value: -10, easing: 'smooth' } // Ngửa đầu nhìn lên mái nhà
          ]
        }
      }
    ]
  });
  console.log('  -> Đã cập nhật S03: duration', s03.duration, 'frames (khớp tọa độ S02, ngửa nhìn lên -10 deg)');

  // =========================================================================
  // CẢNH 4: "khi nhận ra điểm này, ánh mắt Nhật Thành khẽ chuyển," (80 frames / 2.67s)
  // CẬN CẢNH MCU: Nối tiếp ánh mắt ngửa nhìn (-7 deg), rồi sực nhận ra -> liếc mắt quay đầu sang bờ rào (+6 deg, X: -70)
  // =========================================================================
  console.log('[3/5] Dựng Cảnh 4: "khi nhận ra điểm này, ánh mắt Nhật Thành khẽ chuyển," (Eye-trace Motivated Cut)');
  const s04 = await upsertStoryScene({
    projectId,
    sceneId: 'NEW-scene-ep02-s04',
    title: 'Ánh mắt Nhật Thành khẽ chuyển',
    narrationText: 'khi nhận ra điểm này, ánh mắt Nhật Thành khẽ chuyển,',
    durationFrames: 80,
    backgroundName: 'Hẻm sâu góc cận · tâm điểm ánh nhìn',
    layers: [
      {
        layerKey: 'bg-mcu-alley',
        asset: 'bg:alley_wall',
        name: 'Hẻm đá mờ hậu cảnh',
        type: 'backgrounds',
        from: 0,
        to: 80,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 0, x: -100, y: -30, scale: 1.25 }
      },
      {
        layerKey: 'char-nt-face-mcu',
        asset: 'hero:frown',
        name: 'Nhật Thành · MCU ngửa nhìn mái nhà rồi liếc nhanh sang bờ rào bên trái',
        type: 'characters',
        from: 0,
        to: 80,
        left: 620,
        top: 360,
        width: 800,
        height: 1250,
        base: { z: 10, x: 0, y: -15, scale: 1.40, flipX: true },
        keys: {
          rotation: [
            // Khớp hướng ngửa nhìn từ S03 (-7 deg), rồi đến câu "ánh mắt khẽ chuyển" thì quay sang trái (+6 deg)
            { frame: 0, value: -7, easing: 'smooth' },
            { frame: 28, value: -7, easing: 'smooth' },
            { frame: 55, value: 6, easing: 'smooth' },
            { frame: 79, value: 6, easing: 'smooth' }
          ],
          x: [
            { frame: 0, value: 0, easing: 'smooth' },
            { frame: 28, value: 0, easing: 'smooth' },
            { frame: 55, value: -70, easing: 'smooth' },
            { frame: 79, value: -75, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: -15, easing: 'smooth' },
            { frame: 28, value: -15, easing: 'smooth' },
            { frame: 55, value: 5, easing: 'smooth' },
            { frame: 79, value: 5, easing: 'smooth' }
          ]
        }
      }
    ]
  });
  console.log('  -> Đã cập nhật S04: duration', s04.duration, 'frames (nối tiếp ngửa nhìn -> liếc mắt sang bờ rào)');

  // =========================================================================
  // CẢNH 5: "ngước nhìn lên bức tường rào ở hai bên con hẻm," (80 frames / 2.67s)
  // GÓC NHÌN BỜ TƯỜNG (SHOT-REVERSE SHOT): Nhật Thành quay sang trái, vừa ngước nhìn vừa bước chân tiến sát chân tường
  // =========================================================================
  console.log('[4/5] Dựng Cảnh 5: "ngước nhìn lên bức tường rào ở hai bên con hẻm," (Bước chân về chân tường)');
  const s05 = await upsertStoryScene({
    projectId,
    sceneId: 'NEW-scene-ep02-s05',
    title: 'Ngước nhìn lên bức tường rào',
    narrationText: 'ngước nhìn lên bức tường rào ở hai bên con hẻm,',
    durationFrames: 80,
    backgroundName: 'Bức tường rào đá góc nhìn ngước',
    layers: [
      {
        layerKey: 'bg-wall-gaze-low',
        asset: 'bg:alley_wall',
        name: 'Bức tường rào đá quét từ chân lên đỉnh',
        type: 'backgrounds',
        from: 0,
        to: 80,
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        base: { z: 0, x: -30, y: 80, scale: 1.20 },
        keys: {
          y: [
            { frame: 0, value: 80, easing: 'smooth' },
            { frame: 79, value: -60, easing: 'smooth' }
          ],
          scale: [
            { frame: 0, value: 1.20, easing: 'smooth' },
            { frame: 79, value: 1.30, easing: 'smooth' }
          ]
        }
      },
      {
        layerKey: 'char-nt-gaze-wall',
        asset: 'hero:calm',
        name: 'Nhật Thành · Bước tiến sát lại chân tường rào đá bên trái',
        type: 'characters',
        from: 0,
        to: 80,
        left: 200,
        top: 140,
        width: 480,
        height: 850,
        base: { z: 10, x: 140, y: 135, scale: 1.26, flipX: false },
        keys: {
          // Bắt đầu từ X: 140, bước tiến dần về chân tường bên trái X: -80
          x: [
            { frame: 0, value: 140, easing: 'smooth' },
            { frame: 35, value: 30, easing: 'smooth' },
            { frame: 79, value: -80, easing: 'smooth' }
          ],
          y: [
            { frame: 0, value: 135, easing: 'smooth' },
            { frame: 79, value: 120, easing: 'smooth' }
          ],
          rotation: [
            { frame: 0, value: 0, easing: 'smooth' },
            { frame: 38, value: -5, easing: 'smooth' },
            { frame: 79, value: -9, easing: 'smooth' } // Ngước nhìn đỉnh tường
          ]
        }
      }
    ]
  });
  console.log('  -> Đã cập nhật S05: duration', s05.duration, 'frames (bước tiến sát chân tường tới X=-80)');

  // =========================================================================
  // CẢNH 6: "bức tường bên trái chỉ cao chừng hai mét." (70 frames / 2.33s)
  // BẮT TIẾP BƯỚC CHÂN TẠI X=-80: Nhật Thành áp sát chân tường, đối chiếu 1m75 vs 2m -> vươn tay bám gờ tường và nhún chân bật nhảy!
  // =========================================================================
  console.log('[5/5] Dựng Cảnh 6: "bức tường bên trái chỉ cao chừng hai mét." (Match-on-Action bám gờ tường)');
  const s06 = await upsertStoryScene({
    projectId,
    sceneId: 'NEW-scene-ep02-s06',
    title: 'Bức tường bên trái chỉ cao hai mét',
    narrationText: 'bức tường bên trái chỉ cao chừng hai mét.',
    durationFrames: 70,
    backgroundName: 'Bờ tường hai mét bên trái',
    layers: [
      {
        layerKey: 'bg-wall-2m-measure',
        asset: 'bg:alley_wall',
        name: 'Bức tường đá hai mét bên trái',
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
      {
        layerKey: 'char-nt-measure',
        asset: 'hero:calm',
        name: 'Nhật Thành · Bước sát chân tường đối chiếu',
        type: 'characters',
        from: 0,
        to: 35, // 0..34
        left: 200,
        top: 140,
        width: 480,
        height: 850,
        base: { z: 10, x: -80, y: 120, scale: 1.25, flipX: false },
        keys: {
          // Bắt tiếp bước chân chính xác từ X=-80 cuối S05, tiến sát mép tường X=-60
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
      {
        layerKey: 'char-nt-reach-ledge',
        asset: 'hero:reach',
        name: 'Nhật Thành · Tay chạm gờ nóc tường 2 mét và nhún chân lấy đà bật nhảy',
        type: 'characters',
        from: 35, // 35..69
        to: 70,
        left: 200,
        top: 75,
        width: 480,
        height: 850,
        base: { z: 10, x: -60, y: 70, scale: 1.25, flipX: false },
        keys: {
          // Nhún chân lấy đà (y: 70 -> 82) rồi bật người vươn tay bám chặt gờ tường (y: 82 -> 45)
          y: [
            { frame: 35, value: 70, easing: 'smooth' },
            { frame: 48, value: 82, easing: 'smooth' }, // Nhún chân lấy đà
            { frame: 69, value: 45, easing: 'smooth' }  // Bật vươn bám gờ tường
          ],
          scale: [
            { frame: 35, value: 1.25, easing: 'smooth' },
            { frame: 69, value: 1.27, easing: 'smooth' }
          ]
        }
      }
    ]
  });
  console.log('  -> Đã cập nhật S06: duration', s06.duration, 'frames (bắt tiếp tại X=-80, vươn tay nhún chân)');

  console.log('\n=== XUẤT STORYBOARD KIỂM CHỨNG LIÊN TỤC CHO CẢ 5 CẢNH ===');
  for (const sc of [s02, s03, s04, s05, s06]) {
    const sb = renderSceneCV({ projectId, sceneId: sc.sceneId });
    console.log(`[CV Check] Scene ${sc.sceneId}: ${sb.storyboardPath}`);
  }

  console.log('\n🎉 HOÀN THÀNH TẤT CẢ 5 CẢNH ĐỒNG BỘ 100% NỐI TIẾP KHÔNG GIAN!');
}

run().catch(err => {
  console.error('Lỗi xây dựng tập:', err);
  process.exit(1);
});
