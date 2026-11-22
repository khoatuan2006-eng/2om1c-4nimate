export function visionAuditErrors(manifest) {
  if (!manifest?.shots?.length) return ['Chưa có shot để thẩm định thị giác.'];
  const errors = [];
  if (['unaudited', 'rejected', 'blocked'].includes(manifest.frameStaging?.audit?.status)) {
    errors.push('Visual staging chưa được thẩm định thị giác hoặc đã bị từ chối.');
  }
  for (const shot of manifest.shots) {
    const audit = shot.visionCritique;
    const shotId = shot.shotId || shot.id || 'không xác định';
    if (!audit || audit.score === null || !Number.isFinite(audit.score) || audit.score < 6 || audit.score > 10 || audit.needsAdjustment || !['passed', 'approved'].includes(audit.verdictEnum || audit.status)) {
      errors.push(`Shot ${shotId}: chưa có kết quả Vision hợp lệ.`);
    }
  }
  return errors;
}

export function audioCoverageErrors(manifest, { requirePublicPath = true } = {}) {
  const errors = [];
  const cues = manifest?.timeline?.dialogueCues || [];
  const tracks = manifest?.audio?.tracks || [];
  const ids = new Set(cues.map(c => c.id));
  if (ids.size !== cues.length) errors.push('Trùng dialogue cue ID.');
  for (const shot of manifest?.timeline?.shots || []) {
    const shotCues = cues.filter(c => c.shotId === shot.id);
    const spokenText = (shot.source?.text || shot.dialogue || shot.content || shot.line || '').trim();
    const spokenType = shot.source?.type || (shot.speaker ? 'dialogue' : 'narration');
    if (spokenText && ['dialogue', 'narration', 'subtitle'].includes(spokenType) && !shotCues.length) {
      errors.push(`Shot ${shot.id} có lời thoại nhưng chưa có audio cue.`);
    }
    for (const id of shot.dialogueCueIds || []) {
      if (!shotCues.some(c => c.id === id)) errors.push(`Shot ${shot.id}: cue ${id} không khớp.`);
    }
  }
  for (const cue of cues) {
    const matches = tracks.filter(t => t.cueId === cue.id);
    if (matches.length !== 1 || (requirePublicPath && !matches[0]?.publicPath)) {
      errors.push(`Cue ${cue.id}: cần đúng một audio track có publicPath.`);
    }
  }
  for (const track of tracks) {
    if (!ids.has(track.cueId)) errors.push(`Audio track ${track.cueId} không thuộc timeline.`);
  }
  return errors;
}

export function assetCoverageErrors(manifest) {
  const assets = new Map((manifest?.assets || []).filter(a => a.assetId).map(a => [a.assetId, a]));
  const errors = [];
  for (const shot of manifest?.timeline?.shots || []) {
    if (!shot.backgroundAssetKey || !assets.has(shot.backgroundAssetKey)) {
      errors.push(`Shot ${shot.id}: thiếu background.`);
    }
    for (const actor of shot.actors || []) {
      const charName = actor.characterName || actor.actorId || 'nhân vật';
      if (!actor.assetKey || !assets.has(actor.assetKey)) {
        errors.push(`Shot ${shot.id}: thiếu asset cho ${charName}.`);
      }
    }
  }
  return errors;
}

