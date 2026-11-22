import { prepareNarration } from './narration-cache.mjs';

const sentences = [
  'nhưng lại rất dài và quanh co.',
  'Các kiến trúc trong thị trấn này cực kỳ dày đặc,',
  'khi nhận ra điểm này, ánh mắt Nhật Thành khẽ chuyển,',
  'ngước nhìn lên bức tường rào ở hai bên con hẻm,',
  'bức tường bên trái chỉ cao chừng hai mét.'
];

for (let i = 0; i < sentences.length; i++) {
  const s = sentences[i];
  const n = await prepareNarration(s);
  const frames = Math.max(1, Math.ceil(n.durationSec * 30));
  console.log(`[${i + 2}] "${s}" => ${n.durationSec}s (${frames} frames)`);
}

