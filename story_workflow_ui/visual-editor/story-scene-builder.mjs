/** Legacy plan helpers. Persistence uses versioned Studio APIs; preview uses ProjectComposition. */

import { prepareNarration } from './narration-cache.mjs';

export const KNOWN_ASSETS = {
  // Bối cảnh (Backgrounds)
  'bg:alley_wall': {
    hash: 'a0f85d91c7105b3245f6236d84b5f01313f85b3e26bc3f9108f9cae80ba03116',
    name: 'Tường thấp bên trái · hẻm',
    type: 'backgrounds',
    width: 1672,
    height: 940
  },
  'bg:alley_tavern': {
    hash: '3cf04d3bbecbd0ac06c2f565e0cec95fc667ad8f1268bac1b62c442a11dcb290',
    name: 'Con hẻm dài và quanh co',
    type: 'backgrounds',
    width: 1920,
    height: 1080
  },
  'bg:town_dense': {
    hash: '501c0ea80baffed558b068bddcd900d6d638ac2d9a1a9816065b002137e872c0',
    name: 'Kiến trúc thị trấn dày đặc san sát',
    type: 'backgrounds',
    width: 1920,
    height: 1080
  },
  'bg:alley_s08': {
    hash: 'a0925e8159a6234d854d6485bd0407bd1442d6504902755c9964f53b04508e80',
    name: 'Nền con hẻm cảnh cuối S08',
    type: 'backgrounds',
    width: 1672,
    height: 941
  },
  'bg:courtyard': {
    hash: 'a460eb89422bcfded11a00bc1b2de6e3ba8f3099949d91ee125015340c8b11fc',
    name: 'Sân nhỏ sau tường (Góc chính diện lật ngang)',
    type: 'backgrounds',
    width: 1920,
    height: 1080
  },

  // Nhân vật Nhật Thành (Character Poses)
  'hero:run': {
    hash: 'ab626d80b862ad3b4880c659144db127c125d831b38703633ad4380fec23ac98',
    name: 'Nhật Thành · Chạy thoát thân',
    type: 'characters',
    width: 611,
    height: 1182
  },
  'hero:lookup': {
    hash: '2f05b0972878678c7ccdee9fdd25ff679c524e6fb38e5769a87371deea781aa8',
    name: 'Nhật Thành · Ngước nhìn kiến trúc',
    type: 'characters',
    width: 328,
    height: 1157
  },
  'hero:calm': {
    hash: '95308c0aec2729f757e77f3664f66ec9ba4ff08e74c41424859b5c15488aa37c',
    name: 'Nhật Thành · Đứng quan sát trầm tĩnh',
    type: 'characters',
    width: 700,
    height: 1200
  },
  'hero:frown': {
    hash: '58923747294eb55a73814fdc683fe7b4fcc1911fbed0178ed3cb6e339e2f0555',
    name: 'Nhật Thành · Nhíu mày tính toán lối thoát',
    type: 'characters',
    width: 700,
    height: 1200
  },
  'hero:reach': {
    hash: '989feeedc897ea10184a46a9b97fcddcae47574de73ed5f1ec1ac49d55dc77d3',
    name: 'Nhật Thành · Vươn hai tay bám mép tường',
    type: 'characters',
    width: 1024,
    height: 1536
  },
  'hero:push': {
    hash: 'f46f7bc06ea3421bc18796da35263c9290d1c0409cfd001da9ada0dc1968435c',
    name: 'Nhật Thành · Chống tay đẩy người lên mép tường',
    type: 'characters',
    width: 1024,
    height: 1536
  },
  'hero:support': {
    hash: 'efa743113c3f73515bcbf8d124fa964b2aae301affd66901a3feedf749985ff2',
    name: 'Nhật Thành · Chân phải gác mép tường',
    type: 'characters',
    width: 1024,
    height: 1536
  },
  'hero:seated': {
    hash: '48c45a964a2582a06640d9e44a9727af93ccb4d481b78f90d453f26122d0576c',
    name: 'Nhật Thành · Ngồi trên mép tường chuẩn bị nhảy xuống',
    type: 'characters',
    width: 1024,
    height: 1536
  },
  'pedestrian:1': {
    hash: '79654082b18a870038061f6f4bbc4eba598cb244f92f6d4c877dcc310808f731',
    name: 'Người qua đường (Áo xanh 1)',
    type: 'characters',
    width: 450,
    height: 600
  },
  'pedestrian:2': {
    hash: '57802a0a81c2bd043f190060e65ee97c724d77ab1d02cf5586bb884b1f4f593f',
    name: 'Người qua đường (Áo xanh 2)',
    type: 'characters',
    width: 450,
    height: 600
  },
  'prop:wall_segmentation': {
    hash: 'f11bd86638293f4c802e850c00bd4edfa1e2cdf624749454f91b98340c468e24',
    name: 'Nhận diện phân đoạn bờ tường (HUD)',
    type: 'props',
    width: 1920,
    height: 1080
  },
  'prop:wall_dimension_2m': {
    hash: 'c12e72c1c0b6a07c33f31cf7e095e5f1fbc002ed50696d4a7117841335556ed5',
    name: 'Mũi tên kích thước 2m (HUD)',
    type: 'props',
    width: 1920,
    height: 1080
  },
  'prop:sword': {
    hash: '9ea4ea593648a2eedb54c2166483d9bbadb93e4506e276a2b9e1db5e793fcf6c',
    name: 'Thanh kiếm hai lưỡi một mét',
    type: 'props',
    width: 698,
    height: 723
  }
};

/**
 * Phân giải và bảo đảm asset tồn tại trong library-assets/<hash>.png
 */
export async function resolveAsset(assetInput) {
  if (typeof assetInput === 'string' && KNOWN_ASSETS[assetInput]) {
    const known = KNOWN_ASSETS[assetInput];
    return {
      hash: known.hash,
      src: `library-assets/${known.hash}.png`,
      name: known.name,
      type: known.type,
      width: known.width,
      height: known.height
    };
  }

  // Nếu truyền trực tiếp hash 64 ký tự hex
  if (typeof assetInput === 'string' && /^[a-f0-9]{64}$/.test(assetInput)) {
    return {
      hash: assetInput,
      src: `library-assets/${assetInput}.png`,
      name: 'Tài nguyên ' + assetInput.slice(0, 8),
      type: 'characters'
    };
  }

  // Nếu truyền đối tượng chi tiết
  if (typeof assetInput === 'object' && assetInput.hash) {
    return {
      hash: assetInput.hash,
      src: `library-assets/${assetInput.hash}.png`,
      name: assetInput.name || 'Tài nguyên',
      type: assetInput.type || 'characters',
      width: assetInput.width,
      height: assetInput.height
    };
  }

  throw new Error(`Không nhận diện được tài nguyên: ${JSON.stringify(assetInput)}`);
}

/**
 * Chuẩn hóa một track keyframe (bổ sung easing mặc định, lọc trùng frame, sắp xếp)
 */
export function sanitizeKeyframes(keys, field = 'x') {
  if (!Array.isArray(keys)) return [];
  const defaultEasing = field === 'z' ? 'hold' : 'smooth';
  const seen = new Set();
  const sorted = [...keys].sort((a, b) => a.frame - b.frame);
  const result = [];
  
  for (const k of sorted) {
    if (!Number.isInteger(k.frame) || k.frame < 0 || seen.has(k.frame)) continue;
    seen.add(k.frame);
    result.push({
      frame: k.frame,
      value: k.value,
      easing: k.easing && ['linear', 'smooth', 'hold', 'ease-in', 'ease-out'].includes(k.easing)
        ? k.easing
        : defaultEasing
    });
  }
  return result;
}

/**
 * Tạo một layer object đạt 100% chuẩn kiểm tra của Studio validateDocument
 */
export async function createLayer({
  sceneId,
  shotIndex = 0,
  layerKey,
  asset,
  name,
  type,
  from = 0,
  to,
  duration,
  width,
  height,
  left = 0,
  top = 0,
  base = {},
  keys = {}
}) {
  const resolved = await resolveAsset(asset);
  const layerId = `${sceneId}/shot-${shotIndex}/user-${layerKey}`;
  const endFrame = Number.isInteger(to) ? to : (Number.isInteger(duration) ? duration : 120);

  const layerWidth = width || (resolved.type === 'backgrounds' ? 1920 : 400);
  const layerHeight = height || (resolved.type === 'backgrounds' ? 1080 : 700);

  const cleanBase = {
    z: Number.isInteger(base.z) ? base.z : (resolved.type === 'backgrounds' ? 0 : 10),
    x: base.x ?? 0,
    y: base.y ?? 0,
    scale: base.scale ?? (resolved.type === 'backgrounds' ? 1.05 : 1.0),
    rotation: base.rotation ?? 0,
    flipX: Boolean(base.flipX),
    flipY: Boolean(base.flipY)
  };

  const cleanKeys = {};
  for (const [field, klist] of Object.entries(keys || {})) {
    if (Array.isArray(klist) && klist.length > 0) {
      cleanKeys[field] = sanitizeKeyframes(klist, field);
    }
  }

  return {
    id: layerId,
    layer: {
      asset: {
        name: name || resolved.name,
        type: type || resolved.type,
        from,
        to: endFrame,
        left,
        top,
        width: layerWidth,
        height: layerHeight,
        parts: [
          {
            src: resolved.src,
            left: 0,
            top: 0,
            width: layerWidth,
            height: layerHeight
          }
        ]
      },
      base: cleanBase,
      keys: cleanKeys
    }
  };
}

/**
 * Dựng cấu trúc scene source và document hoàn chỉnh
 */
export async function buildSceneDefinition({
  projectId,
  sceneId,
  title,
  narrationText,
  durationFrames,
  fps = 30,
  cues = null,
  shots = null,
  backgroundName = 'Hẻm thị trấn',
  layers = []
}) {
  let finalDuration = durationFrames;
  let sceneCues = [];

  // Hỗ trợ mảng nhiều câu thoại / phụ đề (Multi-cue sequence)
  if (Array.isArray(cues) && cues.length > 0) {
    let currentFrom = 0;
    for (let i = 0; i < cues.length; i++) {
      const item = cues[i];
      const text = (typeof item === 'string' ? item : item.text).trim();
      const narration = await prepareNarration(text);
      const audioFrames = Math.max(1, Math.ceil(narration.durationSec * fps));
      const from = Number.isInteger(item.from) ? item.from : currentFrom;
      const to = Number.isInteger(item.to) ? item.to : (from + audioFrames);
      currentFrom = to;
      sceneCues.push({
        cueId: `${sceneId}-${i}`,
        sceneId,
        text,
        fileName: narration.fileName,
        publicPath: narration.publicPath.startsWith('/') ? narration.publicPath : `/${narration.publicPath}`,
        durationSec: narration.durationSec,
        voiceId: 'voice.capcut.mai.v1',
        voiceName: 'Mai',
        voiceLabel: 'Mai — Lời dẫn chính (EP001)',
        provider: 'capcut',
        language: 'vi-VN',
        speed: 1,
        providerSettings: {},
        providerSettingsVersion: 'tts-provider-settings-v1',
        adapterVersion: 'tts-adapter-v2',
        from,
        to
      });
    }
    if (!durationFrames && sceneCues.length > 0) {
      finalDuration = sceneCues[sceneCues.length - 1].to;
    }
  } else if (narrationText && narrationText.trim()) {
    const text = narrationText.trim();
    const narration = await prepareNarration(text);
    const audioFrames = Math.max(1, Math.ceil(narration.durationSec * fps));
    finalDuration = durationFrames || audioFrames;

    sceneCues.push({
      cueId: `${sceneId}-0`,
      sceneId,
      text,
      fileName: narration.fileName,
      publicPath: narration.publicPath.startsWith('/') ? narration.publicPath : `/${narration.publicPath}`,
      durationSec: narration.durationSec,
      voiceId: 'voice.capcut.mai.v1',
      voiceName: 'Mai',
      voiceLabel: 'Mai — Lời dẫn chính (EP001)',
      provider: 'capcut',
      language: 'vi-VN',
      speed: 1,
      providerSettings: {},
      providerSettingsVersion: 'tts-provider-settings-v1',
      adapterVersion: 'tts-adapter-v2',
      from: 0,
      to: finalDuration
    });
  }

  if (!Number.isInteger(finalDuration) || finalDuration < 1) {
    finalDuration = 120; // 4 giây mặc định
  }

  const finalShots = Array.isArray(shots) && shots.length > 0
    ? shots
    : [
        {
          from: 0,
          to: finalDuration,
          label: title || 'Cảnh mới'
        }
      ];

  const source = {
    id: sceneId,
    title: title || 'Cảnh mới',
    kind: 'created', // BẮT BUỘC để Remotion CreatedScene.tsx render và không bị màn hình đen
    duration: finalDuration,
    fps,
    backgroundName,
    createdAt: new Date().toISOString(),
    shots: finalShots,
    cues: sceneCues
  };

  const docLayers = {};
  for (const layerDef of layers) {
    const { id, layer } = await createLayer({
      sceneId,
      shotIndex: 0,
      duration: finalDuration,
      ...layerDef
    });
    docLayers[id] = layer;
  }

  const document = {
    version: 1,
    revision: 1,
    layers: docLayers
  };

  return { source, document };
}

/** Deprecated unsafe entry points. Author through the versioned Studio API. */
export async function upsertStoryScene() {
  throw Object.assign(new Error('Direct scene upsert is disabled. Use /api/script-plans/import for new scenes and versioned authoring batches for edits; read the current revision first.'), {code:'DIRECT_SCENE_WRITE_DISABLED'});
}

export function renderSceneCV() {
  throw Object.assign(new Error('The alternate Pillow renderer is disabled. Inspect and capture the existing Studio ProjectComposition preview.'), {code:'ALTERNATE_RENDERER_DISABLED'});
}
