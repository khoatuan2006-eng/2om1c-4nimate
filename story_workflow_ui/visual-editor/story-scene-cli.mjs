#!/usr/bin/env node
/**
 * story-scene-cli.mjs
 * Công cụ dòng lệnh hỗ trợ quản lý, dựng và kiểm chứng thị giác cho các cảnh trong Studio 3022.
 * 
 * Lệnh mẫu:
 *  - node visual-editor/story-scene-cli.mjs list
 *  - node visual-editor/story-scene-cli.mjs render-cv --scene=NEW-scene-ep02-s03
 */

import { parseArgs } from 'node:util';
import { getProjectStore } from './project-store.mjs';
import { renderSceneCV, KNOWN_ASSETS } from './story-scene-builder.mjs';

const options = {
  project: { type: 'string', default: 'project-f8fdfc00-b366-4b97-83a1-8e1e77337530' },
  scene: { type: 'string' },
  frames: { type: 'string' },
  help: { type: 'boolean', short: 'h' }
};

const { values, positionals } = parseArgs({ options, allowPositionals: true });
const command = positionals[0] || 'list';

if (values.help) {
  console.log(`
Sử dụng: node story-scene-cli.mjs [lệnh] [tùy chọn]

Lệnh:
  list                 Liệt kê danh sách các scene trong dự án
  render-cv            Kết xuất ảnh Computer Vision và bảng storyboard
  assets               Liệt kê các alias tài nguyên dựng cảnh sẵn có

Tùy chọn:
  --project=<id>       Mã dự án (mặc định: Nhật Thành · EP02)
  --scene=<id>         Mã cảnh cần thao tác
  --frames=0,30,60     Danh sách các frame cần chụp (ngăn cách bằng dấu phẩy)
  `);
  process.exit(0);
}

const store = getProjectStore();

switch (command) {
  case 'list': {
    const p = store.get(values.project);
    console.log(`=== Dự án: ${p.title} (ID: ${p.id}) ===`);
    console.log(`Tổng số cảnh: ${p.scenes.length} | Thời lượng: ${p.duration} frames\n`);
    for (let i = 0; i < p.scenes.length; i++) {
      const s = p.scenes[i];
      const cue = s.cues?.[0]?.text || '(không có lời dẫn)';
      console.log(`[${i + 1}] ${s.id} (${s.duration}F)`);
      console.log(`    Tiêu đề: ${s.title}`);
      console.log(`    Loại (kind): ${s.kind}`);
      console.log(`    Lời thoại: "${cue.slice(0, 80)}${cue.length > 80 ? '...' : ''}"\n`);
    }
    break;
  }

  case 'render-cv': {
    if (!values.scene) {
      console.error('Lỗi: Cần chỉ định mã cảnh bằng --scene=<id>');
      process.exit(1);
    }
    const frames = values.frames ? values.frames.split(',').map(Number) : null;
    console.log(`Đang kết xuất CV cho cảnh ${values.scene}...`);
    const res = renderSceneCV({
      projectId: values.project,
      sceneId: values.scene,
      frames
    });
    console.log(res.output);
    break;
  }

  case 'assets': {
    console.log('=== Danh sách tài nguyên alias dựng cảnh ===\n');
    for (const [alias, info] of Object.entries(KNOWN_ASSETS)) {
      console.log(`- ${alias.padEnd(16)} : [${info.type}] ${info.name}`);
      console.log(`  Hash: ${info.hash}`);
    }
    break;
  }

  default:
    console.error(`Lệnh không hợp lệ: ${command}. Chạy với --help để xem hướng dẫn.`);
    process.exit(1);
}

