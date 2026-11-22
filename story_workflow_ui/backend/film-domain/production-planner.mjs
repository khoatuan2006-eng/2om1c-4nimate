import { ContractError, validateCharacterBible, validateFilmBrief, validateSceneProductionPlan } from './contracts.mjs';

const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
const capabilityIds = (binding, type) => {
  const direct = type === 'pose' ? binding?.poseIds : binding?.faceIds;
  if (Array.isArray(direct)) return direct.map(String);
  return asArray(binding?.capabilities)
    .filter((capability) => capability?.type === type || capability?.capabilityType === type)
    .map((capability) => String(capability.id || capability.key || capability.capabilityKey || ''))
    .filter(Boolean);
};

function bindingFor(bindings, characterId) {
  const value = bindings?.characters?.[characterId] || bindings?.characters?.[String(characterId)];
  if (!value) {
    throw new ContractError(`Chưa có AssetHub binding cho character ${characterId}.`, 'ASSET_GAP', { characterId });
  }
  return value;
}

function assertPinnedBinding(binding, label) {
  if (!binding?.assetId || !binding?.versionId) {
    throw new ContractError(`${label} thiếu assetId/versionId đã pin.`, 'ASSET_GAP', { binding: label });
  }
  if (binding.bindingStatus && !['bound', 'bound_verified'].includes(binding.bindingStatus)) {
    throw new ContractError(`${label} chưa ở trạng thái binding hợp lệ: ${binding.bindingStatus}.`, 'ASSET_GAP', { binding: label });
  }
  if (binding.ready === false || binding.readiness === 'preview-only' || binding.readiness === 'asset-gap') {
    throw new ContractError(`${label} chỉ là preview hoặc còn asset-gap; không được dùng làm production input.`, 'ASSET_GAP', { binding: label });
  }
}

function sourceRefFor(shot, sceneIntent) {
  return shot.sourceRef || (shot.beatId ? { sceneId: sceneIntent.sceneId, beatId: shot.beatId } : { type: 'cinematic-only', rationale: 'Shot không có beatRef, do scene intent cung cấp.' });
}

export function buildSceneProductionPlan({ filmBrief, sceneIntent, characterBible, bindings }) {
  const brief = validateFilmBrief(filmBrief);
  const bible = validateCharacterBible(characterBible);
  if (!sceneIntent || typeof sceneIntent !== 'object') throw new ContractError('SceneIntent phải là object.');
  const sceneId = String(sceneIntent.sceneId || '').trim();
  if (!sceneId) throw new ContractError('SceneIntent.sceneId bị thiếu.');
  const shots = asArray(sceneIntent.shots);
  if (!shots.length) throw new ContractError(`Scene ${sceneId} chưa có shot intent.`);
  const knownCharacters = new Set(bible.characters.map((character) => character.characterId));
  const gaps = [];
  const planShots = shots.map((shot, index) => {
    const shotId = String(shot.shotId || `${sceneId}-SHOT-${String(index + 1).padStart(2, '0')}`);
    const actors = asArray(shot.actors || shot.cast);
    const cast = actors.map((actor) => {
      const characterId = String(actor.characterId || actor.actorId || actor.name || '').trim();
      if (!knownCharacters.has(characterId)) {
        gaps.push({ code: 'CHARACTER_NOT_IN_BIBLE', shotId, characterId, message: `Character ${characterId} không có trong CharacterBible.` });
        return { characterId, status: 'asset-gap' };
      }
      let binding;
      try {
        binding = bindingFor(bindings, characterId);
        assertPinnedBinding(binding, `Character ${characterId}`);
      } catch (error) {
        gaps.push({ code: error.code || 'ASSET_GAP', shotId, characterId, message: error.message, details: error.details });
        return { characterId, status: 'asset-gap' };
      }
      const poseId = actor.poseId || actor.pose?.id || null;
      const faceId = actor.faceId || actor.face?.id || null;
      const poses = capabilityIds(binding, 'pose');
      const faces = capabilityIds(binding, 'face');
      if (poseId && poses.length && !poses.includes(String(poseId))) {
        gaps.push({ code: 'CAPABILITY_MISMATCH', shotId, characterId, capabilityType: 'pose', requested: poseId, available: poses });
      }
      if (faceId && faces.length && !faces.includes(String(faceId))) {
        gaps.push({ code: 'CAPABILITY_MISMATCH', shotId, characterId, capabilityType: 'face', requested: faceId, available: faces });
      }
      return {
        characterId,
        role: actor.role || 'supporting',
        assetRef: { assetId: binding.assetId, versionId: binding.versionId },
        poseId,
        faceId,
        slot: actor.slot || null,
        flipX: Boolean(actor.flipX),
        motion: actor.motion || actor.tracks?.motion || null,
        events: asArray(actor.events || actor.tracks?.events).map((event) => ({ ...event })),
        action: actor.action || shot.action || 'hold',
        gaze: actor.gaze || null,
        status: 'ready',
      };
    });

    const dialogue = String(shot.dialogue || shot.content || '').trim();
    const ttsRequest = asObject(shot.ttsRequest);
    const dialogueCueRefs = dialogue ? [{
      cueId: `${shotId}-cue-01`,
      speakerId: shot.speakerId || shot.speaker || null,
      text: dialogue,
      audioPath: shot.audioPath || null,
      measuredDurationSec: Number.isFinite(Number(shot.measuredDurationSec)) ? Number(shot.measuredDurationSec) : null,
      voiceId: ttsRequest.voiceId || shot.voiceId || null,
      language: ttsRequest.language || brief.language,
      speed: ttsRequest.speed == null ? 1 : Number(ttsRequest.speed),
      providerSettings: ttsRequest.providerSettings || null,
      ttsRequest: Object.keys(ttsRequest).length ? structuredClone(ttsRequest) : null,
    }] : [];
    if (dialogue && !shot.audioPath && !Number.isFinite(Number(shot.measuredDurationSec)) && !Object.keys(ttsRequest).length) {
      gaps.push({ code: 'AUDIO_MEASUREMENT_REQUIRED', shotId, message: `Shot ${shotId} có thoại nhưng chưa có audioPath hoặc measuredDurationSec.` });
    }
    const durationSec = Number.isFinite(Number(shot.durationSec)) ? Number(shot.durationSec) : null;
    if (!dialogue && !(durationSec > 0)) {
      gaps.push({ code: 'SILENT_DURATION_REQUIRED', shotId, message: `Shot không thoại ${shotId} phải có durationSec tường minh.` });
    }
    const props = asArray(shot.props).map((item) => {
      const propId = String(item.propId || item.id || '').trim();
      const binding = bindings?.props?.[propId] || bindings?.assets?.[propId];
      if (!propId || !binding?.assetId || !binding?.versionId || binding.ready === false || !['bound', 'bound_verified'].includes(binding.bindingStatus || 'bound_verified')) {
        gaps.push({ code: 'PROP_ASSET_GAP', shotId, propId: propId || null, message: `Shot ${shotId} cần prop binding assetId/versionId đã pin.` });
        return { propId, status: 'asset-gap' };
      }
      return {
        propId,
        assetId: binding.assetId,
        versionId: binding.versionId,
        capabilityId: item.capabilityId || item.capabilityKey || null,
        placement: item.placement || null,
        ownerActorId: item.ownerActorId || null,
        action: item.action || 'static',
        status: 'ready',
      };
    });
    return {
      shotId,
      beatId: String(shot.beatId || `${sceneId}-BEAT-${String(index + 1).padStart(2, '0')}`),
      shotOrder: index + 1,
      sourceRef: sourceRefFor(shot, sceneIntent),
      purpose: shot.purpose || shot.summary || '',
      cast,
      props,
      blocking: shot.blocking || null,
      actions: asArray(shot.actions || [shot.action || 'hold']).map(String),
      poseFaceRequirements: cast.map((actor) => ({ characterId: actor.characterId, poseId: actor.poseId, faceId: actor.faceId })),
      dialogueCueRefs,
      durationSec,
      cameraIntent: {
        shotSize: shot.camera?.shotSize || shot.camera || 'medium',
        movement: shot.camera?.movement || null,
        focusMode: shot.camera?.focusMode || (shot.camera?.subject ? 'actor' : 'center'),
        subject: shot.camera?.subject || cast[0]?.characterId || null,
      },
      continuityIn: shot.continuityIn || sceneIntent.continuityIn || null,
      continuityOut: shot.continuityOut || sceneIntent.continuityOut || null,
      dependencies: asArray(shot.dependencies).map(String),
    };
  });

  try {
    return validateSceneProductionPlan({
      schemaVersion: 1,
      sceneId,
      status: gaps.length ? 'blocked' : 'ready',
      shotOrder: planShots.map((shot) => shot.shotId),
      shots: planShots,
      continuityIn: sceneIntent.continuityIn || null,
      continuityOut: sceneIntent.continuityOut || null,
      dependencies: [
        { type: 'film-brief', filmId: brief.filmId },
        ...planShots.flatMap((shot) => shot.cast.filter((actor) => actor.assetRef).map((actor) => ({
          type: 'asset-version', assetId: actor.assetRef.assetId, versionId: actor.assetRef.versionId,
        }))),
      ],
      assetGaps: gaps,
      rationale: 'Planner chỉ chọn asset/version/capability đã có trong binding; không fuzzy-match và không tự thay nhân vật.',
    });
  } catch (error) {
    if (error instanceof ContractError) throw error;
    throw new ContractError(error.message, 'PLANNER_INVALID');
  }
}
