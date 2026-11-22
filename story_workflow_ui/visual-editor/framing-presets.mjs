// Framing presets (Toàn thân / Nửa thân / Chân dung) and selective focus dimming helpers
// for one-click inspector controls in Studio 3022.
import { valueAt } from './model.mjs';

export const FRAMING_PRESETS = Object.freeze({
  full: { label: 'Toàn thân', height: 720, bottomY: 980 },
  bust: { label: 'Nửa thân', height: 980, bottomY: 1240 },
  portrait: { label: 'Chân dung', height: 1320, bottomY: 1520 },
});

/** Detect the closest framing preset for a layer at the given frame. */
export function detectFramingPreset(layer, frame = 0) {
  if (!layer?.asset) return null;
  const v = valueAt(layer, frame);
  const a = layer.asset;
  const visH = a.height * (v.scale ?? 1);
  const bottomY = a.top + a.height / 2 + (v.y ?? 0) + visH / 2;
  if (bottomY >= 1360) return 'portrait';
  if (bottomY >= 1100) return 'bust';
  return 'full';
}

/**
 * Resize and vertically re-anchor a layer to match a framing preset ('full' | 'bust' | 'portrait')
 * while preserving horizontal position X and any relative vertical/scale keyframes.
 */
export function applyFramingPreset(doc, layerId, preset, frame = 0) {
  const spec = FRAMING_PRESETS[preset];
  if (!spec) throw Error('Cỡ khung không hợp lệ: ' + preset);
  const existing = doc?.layers?.[layerId];
  if (!existing?.asset) throw Error('Không tìm thấy layer để chỉnh cỡ khung: ' + layerId);

  const next = structuredClone(doc);
  const layer = next.layers[layerId];
  const a = layer.asset;
  const cur = valueAt(layer, frame);
  const curScale = cur.scale || 1;
  const nextScale = Math.max(0.01, Math.min(100, +(spec.height / a.height).toFixed(4)));
  const nextY = Math.round(spec.bottomY - a.top - a.height / 2 - spec.height / 2);

  layer.base ??= {};
  layer.keys ??= {};

  const hasYKeys = Array.isArray(layer.keys.y) && layer.keys.y.length > 0;
  const hasScaleKeys = Array.isArray(layer.keys.scale) && layer.keys.scale.length > 0;

  if (hasYKeys) {
    const dy = nextY - (cur.y ?? 0);
    layer.keys.y = layer.keys.y.map((k) => ({ ...k, value: Math.round(k.value + dy) }));
    if (layer.base.y !== undefined) layer.base.y = Math.round(layer.base.y + dy);
  } else {
    layer.base.y = nextY;
  }

  if (hasScaleKeys) {
    const ratio = nextScale / curScale;
    layer.keys.scale = layer.keys.scale.map((k) => ({
      ...k,
      value: Math.max(0.01, Math.min(100, +(k.value * ratio).toFixed(4))),
    }));
    if (layer.base.scale !== undefined) {
      layer.base.scale = Math.max(0.01, Math.min(100, +(layer.base.scale * ratio).toFixed(4)));
    }
  } else {
    layer.base.scale = nextScale;
  }

  return next;
}

/**
 * Focus on one visible layer at `frame`: keep `targetId` razor-sharp (dimmed: false)
 * and softly blur/dim other visible non-background objects (dimmed: true) without deleting them.
 */
export function applyFocusToLayer(doc, targetId, frame = 0) {
  const target = doc?.layers?.[targetId];
  if (!target?.asset) throw Error('Không tìm thấy đối tượng để Focus: ' + targetId);

  const next = structuredClone(doc);
  for (const [id, l] of Object.entries(next.layers ?? {})) {
    if (!l?.asset || l.asset.type === 'backgrounds') continue;
    if (frame < l.asset.from || frame >= l.asset.to) continue;
    const curZ = valueAt(l, frame).z || 100;
    l.base ??= {};
    if (id === targetId) {
      l.dimmed = false;
      l.base.z = Math.max(curZ, 120);
      if (l.keys?.z?.length) {
        l.keys.z = l.keys.z.map((k) => ({ ...k, value: Math.max(k.value, 120) }));
      }
    } else {
      l.dimmed = true;
      l.base.z = Math.min(curZ, 95);
      if (l.keys?.z?.length) {
        l.keys.z = l.keys.z.map((k) => ({ ...k, value: Math.min(k.value, 95) }));
      }
    }
  }
  return next;
}

/** Clear focus dimming across all visible non-background layers at `frame`. */
export function clearFocusAtFrame(doc, frame = 0) {
  const next = structuredClone(doc);
  for (const l of Object.values(next.layers ?? {})) {
    if (!l?.asset || l.asset.type === 'backgrounds') continue;
    if (frame < l.asset.from || frame >= l.asset.to) continue;
    delete l.dimmed;
    if (l.base?.z === 95) l.base.z = 100;
  }
  return next;
}
