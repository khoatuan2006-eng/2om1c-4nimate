import os from 'node:os';

const VALID_PRESETS = new Set([
  'ultrafast',
  'superfast',
  'veryfast',
  'faster',
  'fast',
  'medium',
  'slow',
  'slower',
  'veryslow',
  'placebo',
]);

const VALID_GL = new Set([
  'angle',
  'angle-egl',
  'egl',
  'swangle',
  'swiftshader',
  'vulkan',
]);

/**
 * Resolve tuned Remotion render options for high-throughput 1080p MP4 exports.
 * Adapts worker concurrency to host cores, enables Windows GPU ANGLE compositing,
 * and avoids PNG lossless frame capture overhead.
 */
export function resolveExportRenderOptions({
  cpuCount = os.availableParallelism?.() ?? os.cpus().length,
  platform = process.platform,
  env = process.env,
} = {}) {
  const cpus = Math.max(1, Math.floor(Number(cpuCount) || 4));
  const rawConc = Number(env.EXPORT_CONCURRENCY);
  const concurrency =
    Number.isInteger(rawConc) && rawConc >= 1
      ? Math.min(cpus, rawConc)
      : Math.min(cpus, Math.min(8, Math.max(2, Math.floor(cpus / 2))));

  const rawPreset = typeof env.EXPORT_X264_PRESET === 'string' ? env.EXPORT_X264_PRESET.trim() : '';
  const x264Preset = VALID_PRESETS.has(rawPreset) ? rawPreset : 'veryfast';

  const rawCrf = Number(env.EXPORT_CRF);
  const crf = Number.isInteger(rawCrf) && rawCrf >= 1 && rawCrf <= 51 ? rawCrf : 21;

  const rawJpeg = Number(env.EXPORT_JPEG_QUALITY);
  const jpegQuality = Number.isInteger(rawJpeg) && rawJpeg >= 50 && rawJpeg <= 100 ? rawJpeg : 85;

  let gl = platform === 'win32' ? 'angle' : null;
  if (env.EXPORT_GL !== undefined) {
    const trimmed = String(env.EXPORT_GL).trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'default') {
      gl = null;
    } else if (VALID_GL.has(trimmed)) {
      gl = trimmed;
    }
  }

  return {
    concurrency,
    x264Preset,
    crf,
    imageFormat: 'jpeg',
    jpegQuality,
    chromiumOptions: gl ? { gl } : {},
  };
}
