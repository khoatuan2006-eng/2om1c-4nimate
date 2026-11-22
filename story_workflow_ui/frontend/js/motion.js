// Motion is an offset & sprite track over immutable Frame Staging, never a new layout/character.
export const neutralKeyframe = (frame = 0) => ({ frame, dx: 0, dy: 0, scale: 1, rotation: 0, shakeX: 0, shakeY: 0, frequency: 6, easing: 'linear' });

export const neutralSpriteKeyframe = (frame = 0, poseId = '', faceId = '', meta = {}) => ({
  frame,
  poseId: poseId || '',
  faceId: faceId || '',
  ...(meta || {}),
});

export const spriteAtFrame = (sprites, localFrame, defaultPose = '', defaultFace = '') => {
  const frame = Math.max(0, Math.floor(localFrame || 0));
  if (!sprites?.keyframes?.length) {
    return { frame: 0, poseId: defaultPose, faceId: defaultFace };
  }
  let currentPose = defaultPose;
  let currentFace = defaultFace;
  let activeMeta = {};
  for (const key of sprites.keyframes) {
    if (key.frame <= frame) {
      if (key.poseId) currentPose = key.poseId;
      if (key.faceId) currentFace = key.faceId;
      activeMeta = { ...activeMeta, ...key };
    } else {
      break;
    }
  }
  return {
    ...activeMeta,
    frame: activeMeta.frame ?? 0,
    poseId: currentPose,
    faceId: currentFace,
    posePath: activeMeta.posePath || null,
    facePath: activeMeta.facePath || null,
    poseBbox: activeMeta.poseBbox || null,
    faceBbox: activeMeta.faceBbox || null,
    poseLabel: activeMeta.poseLabel || null,
    faceLabel: activeMeta.faceLabel || null,
  };
};

export const evaluateActorMotion = (motion, localFrame, fps = 30) => {
  const neutral = { dx: 0, dy: 0, scale: 1, rotation: 0, shakeX: 0, shakeY: 0, frequency: 6 };
  if (!motion?.keyframes?.length) return neutral;
  let carry = { ...neutral, frame: 0, easing: 'linear' };
  const keys = motion.keyframes.map(key => (carry = { ...carry, ...key }));
  const frame = Math.max(0, localFrame);
  let left = keys[0], right = keys[0];
  for (const key of keys) {
    if (key.frame <= frame) left = key;
    right = key;
    if (key.frame > frame) break;
  }
  let progress = right.frame > left.frame ? Math.max(0, Math.min(1, (frame - left.frame) / (right.frame - left.frame))) : 0;
  if (left.easing === 'hold') progress = 0;
  else if (left.easing === 'ease-in') progress = progress * progress;
  else if (left.easing === 'ease-out') progress = progress * (2 - progress);
  else if (left.easing === 'ease-in-out' || left.easing === 'ease') progress = progress * progress * (3 - 2 * progress);
  const result = { ...neutral };
  Object.keys(neutral).forEach(key => {
    result[key] = left[key] + (right[key] - left[key]) * progress;
  });
  const phase = (frame / Math.max(1, fps)) * result.frequency * Math.PI * 2;
  result.dx += Math.sin(phase) * result.shakeX;
  result.dy += Math.sin(phase * 1.37) * result.shakeY;
  return result;
};

// Pure projection: opening an inspector must not mutate saved staging/timeline data.
export const inheritMotionStaging = (manifest, visual, sceneId = manifest?.sceneId || visual?.sceneId) => {
  if (!visual?.shots?.length) return manifest ? structuredClone(manifest) : null;
  if (!manifest) throw new Error('Thiếu Timeline handoff từ Dàn dựng Frame; Motion không được tự tạo staging.');
  const next = structuredClone(manifest);
  const incomingRef = visual.stagingRef || {
    visualManifestId: visual.manifestId || `visual-${sceneId}`,
    contentHash: null,
    mode: 'legacy',
  };
  const hadMotion = (next.timeline?.shots || []).some(s => (s.actors || []).some(a => a.tracks?.motion?.keyframes?.length));
  const motionStagingHash = next.motion?.stagingHash ?? (hadMotion ? next.stagingRef?.contentHash : null);
  const stagingChanged = hadMotion && motionStagingHash && incomingRef.contentHash && motionStagingHash !== incomingRef.contentHash;
  next.stagingRef = structuredClone(incomingRef);
  next.fps ||= 30;
  next.assets ||= [];
  next.timeline ||= { shots: [] };
  next.timeline.dialogueCues ||= [];
  const previous = next.timeline.shots || [];
  const sameShots = previous.length === visual.shots.length && previous.every((s, i) => s.frameRange?.to > s.frameRange?.from && s.id === (visual.shots[i].shotId || visual.shots[i].id));
  const register = (id, role, label, path, versionId) => {
    if (!id) return;
    let asset = next.assets.find(a => a.assetId === id);
    if (!asset) { asset = { key: id, assetId: id, role, label, versionId: versionId || visual.assetCatalog?.[id]?.versionId || null, status: 'bound' }; next.assets.push(asset); }
    if (path) asset.publicPath = path;
  };
  let cursor = 0;
  next.timeline.shots = visual.shots.map((vs, index) => {
    const id = vs.shotId || vs.id;
    const old = previous.find(s => s.id === id) || {};
    const frames = old.frameRange ? old.frameRange.to - old.frameRange.from : Math.max(1, Math.round((vs.timing?.durationSec || 3) * next.fps));
    const frameRange = sameShots ? old.frameRange : { from: cursor, to: cursor + frames };
    cursor = frameRange.to;
    const bg = vs.background || visual.background;
    const stagedLayers = vs.renderLayers?.owner === 'frame-staging' ? vs.renderLayers : null;
    register(bg?.assetId, 'background', bg?.displayName, stagedLayers?.backgroundPath || bg?.layer?.relativePath, bg?.versionId);
    return {
      ...old, id, beatId: vs.beatId || old.beatId || `${sceneId}-B01`, shotIndex: index + 1,
      frameRange, timing: sameShots ? old.timing : { durationSec: frames / next.fps, locked: false },
      stagingTrack: structuredClone(vs.stagingTrack || old.stagingTrack || {
        owner: 'frame-staging', easing: 'hold', keyframes: [{frame: 0, shotRef: id, mix: 1}],
      }),
      source: { type: 'action', speakerId: vs.speaker || null, text: vs.content || '', action: vs.action || '', backgroundDescription: '', ...old.source, ...vs.source },
      camera: old.camera || vs.camera || { preset: 'MS', movement: 'static' },
      backgroundAssetKey: bg?.assetId || old.backgroundAssetKey || null,
      backgroundPath: stagedLayers?.backgroundPath || bg?.layer?.relativePath || old.backgroundPath,
      actors: (vs.actors || []).map(va => {
        const prior = (old.actors || []).find(a => a.actorId === (va.actorId || va.characterName) || a.characterName === va.characterName) || {};
        const assetKey = va.assetId || prior.assetKey || null;
        const stagedActorLayer = stagedLayers?.actors?.[va.actorId || va.characterName] || null;
        const cat = visual.assetCatalog?.[assetKey] || {};
        const initialPoseId = va.pose?.id || va.poseId || '';
        const initialFaceId = va.face?.id || va.faceId || '';
        const posePath = va.pose?.relativePath || null;
        const facePath = va.face?.relativePath || null;
        const poseBbox = va.pose?.bbox || null;
        const faceBbox = va.face?.bbox || null;
        const initialSprites = prior.tracks?.sprites || {
          keyframes: [
            neutralSpriteKeyframe(0, initialPoseId, initialFaceId, {
              posePath,
              facePath,
              poseBbox,
              faceBbox,
              poseLabel: va.pose?.label || null,
              faceLabel: va.face?.label || null,
            }),
          ],
        };
        const actor = {
          ...prior, actorId: va.actorId || va.characterName, characterName: va.characterName || va.actorId, assetKey,
          transform: structuredClone(va.transform || prior.transform || {}),
          zIndex: va.zIndex ?? prior.zIndex,
          slot: va.slot ?? prior.slot ?? null,
          posePath, facePath, poseBbox, faceBbox,
          stagingLayerPath: stagedActorLayer?.path || null,
          stagingLayerSize: stagedActorLayer?.size || null,
          stagingAnchor: stagedActorLayer?.anchor || { x: 0.5, y: 1 },
          availablePoses: cat.capabilities?.poses || [],
          availableFaces: cat.capabilities?.faces || [],
          tracks: {
            ...prior.tracks,
            pose: initialPoseId,
            face: initialFaceId,
            sprites: structuredClone(initialSprites),
          },
        };
        // Old acting events selected pose/face again; they are not motion keyframes.
        delete actor.motionOrigin;
        delete actor.tracks.events;
        delete actor.tracks.gaze;
        delete actor.tracks.posePath;
        delete actor.tracks.facePath;
        if (prior.assetKey && prior.assetKey !== assetKey) {
          delete actor.tracks.motion;
          actor.tracks.sprites = structuredClone(initialSprites);
        }
        register(assetKey, 'character', actor.characterName, actor.posePath, va.versionId);
        return actor;
      }),
      props: structuredClone(vs.props || old.props || []),
      dialogueCueIds: old.dialogueCueIds || [], effects: old.effects || [],
    };
  });
  next.timeline.durationInFrames = cursor;
  if (!sameShots) {
    next.status = 'draft'; next.timeline.durationMode = 'estimated';
    next.audio = { tracks: [] };
    // Cue content survives; timing is now provisional and must be locked again.
    next.timeline.dialogueCues = next.timeline.dialogueCues.filter(c => next.timeline.shots.some(s => s.id === c.shotId)).map(c => ({ ...c, frameRange: { ...next.timeline.shots.find(s => s.id === c.shotId).frameRange }, audioRef: null, timing: { mode: 'estimated', locked: false } }));
  }
  if (next.motion) {
    if (hadMotion && !motionStagingHash && incomingRef.contentHash) {
      // One-time legacy migration: bind the preserved motion to the first
      // content hash without deleting or silently regenerating user work.
      next.motion.stagingHash = incomingRef.contentHash;
    }
    next.motion.status = stagingChanged
      ? 'stale'
      : next.timeline.shots.every(s => s.actors.every(a => validateMotion(a.tracks?.motion, s.frameRange.to - s.frameRange.from).length === 0)) ? 'ready' : 'draft';
    if (stagingChanged) next.motion.staleReason = 'Dàn dựng Frame đã thay đổi; cần xác nhận hoặc tạo lại Motion.';
  }
  return next;
};

export const motionPreset = (name, duration) => {
  const end = Math.max(0, Math.floor(duration) - 1);
  const first = neutralKeyframe();
  if (name === 'still' || end === 0) return { keyframes: [first] };
  const last = neutralKeyframe(end);
  if (name === 'left' || name === 'right') {
    last.dx = name === 'left' ? -0.08 : 0.08;
    first.easing = 'ease-in-out';
    return { keyframes: [first, last] };
  }
  if (name === 'shake') {
    first.shakeX = 0.006;
    first.shakeY = 0.003;
    return { keyframes: [first, last] };
  }
  if (end < 2) return { keyframes: [first] };
  const middle = neutralKeyframe(Math.floor(end / 2));
  first.easing = middle.easing = 'ease-in-out';
  if (name === 'bob') middle.dy = -0.025;
  if (name === 'pulse') middle.scale = 1.05;
  return { keyframes: [first, middle, last] };
};

export const validateSprites = (sprites, duration, availablePoses = [], availableFaces = []) => {
  const errors = [];
  if (!sprites || typeof sprites !== 'object' || !Array.isArray(sprites.keyframes)) {
    return ['Sprites track cần keyframes.'];
  }
  if (!sprites.keyframes.length || sprites.keyframes.length > 200) {
    return ['Cần từ 1 đến 200 sprite keyframe.'];
  }
  let previous = -1;
  const poseIds = availablePoses?.length ? new Set(availablePoses.map(p => p.id)) : null;
  const faceIds = availableFaces?.length ? new Set(availableFaces.map(f => f.id)) : null;

  for (const k of sprites.keyframes) {
    if (!k || typeof k !== 'object') {
      errors.push('Sprite keyframe không hợp lệ.');
      continue;
    }
    if (!Number.isInteger(k.frame) || k.frame < 0 || k.frame >= duration || k.frame <= previous) {
      errors.push(`Sprite frame ${k.frame} phải tăng dần, không trùng, nằm trong 0–${duration - 1}.`);
    }
    previous = k.frame;
    if (poseIds && k.poseId && !poseIds.has(k.poseId)) {
      errors.push(`Pose ID "${k.poseId}" không thuộc catalog nhân vật.`);
    }
    if (faceIds && k.faceId && !faceIds.has(k.faceId)) {
      errors.push(`Face ID "${k.faceId}" không thuộc catalog nhân vật.`);
    }
  }
  if (sprites.keyframes[0]?.frame !== 0) {
    errors.push('Sprite keyframe đầu tiên phải ở frame 0 của shot.');
  }
  return errors;
};

export const validateMotion = (motion, duration) => {
  const errors = [];
  if (!motion || typeof motion !== 'object' || !Array.isArray(motion.keyframes)) return ['Motion cần keyframes.'];
  if (Object.keys(motion).some(k => k !== 'keyframes')) errors.push('Motion chỉ được chứa keyframes.');
  if (!motion.keyframes.length || motion.keyframes.length > 200) errors.push('Cần từ 1 đến 200 keyframe.');
  const limits = { dx: [-2, 2], dy: [-2, 2], scale: [0.05, 10], rotation: [-3600, 3600], shakeX: [0, 0.2], shakeY: [0, 0.2], frequency: [0, 30] };
  let previous = -1;
  for (const k of motion.keyframes) {
    if (!k || typeof k !== 'object') { errors.push('Keyframe không hợp lệ.'); continue; }
    if (Object.keys(k).some(key => !['frame', 'easing', ...Object.keys(limits)].includes(key))) errors.push('Keyframe chỉ được thay đổi motion, không được đổi pose/face/tọa độ gốc.');
    if (!Number.isInteger(k.frame) || k.frame < 0 || k.frame >= duration || k.frame <= previous) errors.push(`Frame ${k.frame} phải tăng dần, không trùng, nằm trong 0–${duration - 1}.`);
    previous = k.frame;
    for (const [key, [min, max]] of Object.entries(limits)) {
      if (k[key] !== undefined && (typeof k[key] !== 'number' || !Number.isFinite(k[key]) || k[key] < min || k[key] > max)) errors.push(`${key} phải nằm trong ${min}–${max}.`);
    }
    if (k.easing !== undefined && !['linear', 'ease-in-out', 'ease-in', 'ease-out', 'ease', 'hold'].includes(k.easing)) errors.push('Easing không hợp lệ.');
  }
  if (motion.keyframes[0]?.frame !== 0) errors.push('Keyframe đầu tiên phải ở frame 0 của shot.');
  return errors;
};
