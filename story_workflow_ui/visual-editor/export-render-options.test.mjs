import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveExportRenderOptions } from './export-render-options.mjs';

test('resolveExportRenderOptions defaults for 1080p GPU/multi-core export on Windows and non-Windows', () => {
  const win8 = resolveExportRenderOptions({ cpuCount: 8, platform: 'win32', env: {} });
  assert.deepEqual(win8, {
    concurrency: 4,
    x264Preset: 'veryfast',
    crf: 21,
    imageFormat: 'jpeg',
    jpegQuality: 85,
    chromiumOptions: { gl: 'angle' },
  });

  const linux8 = resolveExportRenderOptions({ cpuCount: 8, platform: 'linux', env: {} });
  assert.deepEqual(linux8.chromiumOptions, {});
  assert.equal(linux8.concurrency, 4);

  assert.equal(resolveExportRenderOptions({ cpuCount: 1, platform: 'win32', env: {} }).concurrency, 1);
  assert.equal(resolveExportRenderOptions({ cpuCount: 2, platform: 'win32', env: {} }).concurrency, 2);
  assert.equal(resolveExportRenderOptions({ cpuCount: 32, platform: 'win32', env: {} }).concurrency, 8);
});

test('resolveExportRenderOptions honors valid environment overrides and ignores invalid values', () => {
  const custom = resolveExportRenderOptions({
    cpuCount: 8,
    platform: 'win32',
    env: {
      EXPORT_CONCURRENCY: '6',
      EXPORT_X264_PRESET: 'superfast',
      EXPORT_CRF: '19',
      EXPORT_JPEG_QUALITY: '92',
      EXPORT_GL: 'swangle',
    },
  });
  assert.deepEqual(custom, {
    concurrency: 6,
    x264Preset: 'superfast',
    crf: 19,
    imageFormat: 'jpeg',
    jpegQuality: 92,
    chromiumOptions: { gl: 'swangle' },
  });

  const clearedGl = resolveExportRenderOptions({
    cpuCount: 4,
    platform: 'win32',
    env: { EXPORT_CONCURRENCY: '99', EXPORT_GL: 'null', EXPORT_X264_PRESET: 'bogus', EXPORT_CRF: '0', EXPORT_JPEG_QUALITY: '10' },
  });
  assert.deepEqual(clearedGl, {
    concurrency: 4,
    x264Preset: 'veryfast',
    crf: 21,
    imageFormat: 'jpeg',
    jpegQuality: 85,
    chromiumOptions: {},
  });
});
