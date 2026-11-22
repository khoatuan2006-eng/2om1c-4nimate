import { createHash } from 'node:crypto';

export const DOMAIN_SCHEMA_VERSION = 1;

export class ContractError extends Error {
  constructor(message, code = 'CONTRACT_INVALID', details = {}) {
    super(message);
    this.name = 'ContractError';
    this.code = code;
    this.details = details;
  }
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireObject = (value, name) => {
  if (!isObject(value)) throw new ContractError(`${name} phải là object.`);
  return value;
};
const requireString = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new ContractError(`${name} phải là chuỗi không rỗng.`);
  return value.trim();
};
const requirePositive = (value, name) => {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    throw new ContractError(`${name} phải là số dương.`);
  }
  return Number(value);
};

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

export function validateFilmBrief(input) {
  const brief = requireObject(input, 'FilmBrief');
  requireString(brief.filmId, 'FilmBrief.filmId');
  requireString(brief.title, 'FilmBrief.title');
  requireString(brief.language, 'FilmBrief.language');
  requirePositive(brief.fps, 'FilmBrief.fps');
  const width = requirePositive(brief.width, 'FilmBrief.width');
  const height = requirePositive(brief.height, 'FilmBrief.height');
  if (!isObject(brief.style)) throw new ContractError('FilmBrief.style phải là object.');
  if (!isObject(brief.runPolicy)) throw new ContractError('FilmBrief.runPolicy phải là object.');
  return {
    schemaVersion: DOMAIN_SCHEMA_VERSION,
    filmId: brief.filmId.trim(),
    title: brief.title.trim(),
    language: brief.language.trim(),
    fps: Number(brief.fps),
    width,
    height,
    style: structuredClone(brief.style),
    runPolicy: {
      maxAttempts: Math.max(1, Number(brief.runPolicy.maxAttempts ?? 2)),
      maxConcurrentSteps: Math.max(1, Number(brief.runPolicy.maxConcurrentSteps ?? 2)),
      allowPaidProviders: brief.runPolicy.allowPaidProviders === true,
      enableRender: brief.runPolicy.enableRender === true,
      goal: brief.runPolicy.goal === 'scene-preview' || brief.runPolicy.enableRender === true ? 'scene-preview' : 'compile-preview',
    },
  };
}

export function validateCharacterBible(input) {
  const bible = requireObject(input, 'CharacterBible');
  const characters = Array.isArray(bible.characters) ? bible.characters : [];
  if (!characters.length) throw new ContractError('CharacterBible phải có ít nhất một character.');
  const seen = new Set();
  const normalized = characters.map((character, index) => {
    requireObject(character, `CharacterBible.characters[${index}]`);
    const characterId = requireString(character.characterId, `CharacterBible.characters[${index}].characterId`);
    if (seen.has(characterId)) throw new ContractError(`CharacterId bị trùng: ${characterId}.`);
    seen.add(characterId);
    return {
      characterId,
      displayName: requireString(character.displayName || character.characterId, `CharacterBible.characters[${index}].displayName`),
      aliases: Array.isArray(character.aliases) ? character.aliases.map(String) : [],
      voiceId: character.voiceId ? String(character.voiceId) : null,
      sourceRefs: Array.isArray(character.sourceRefs) ? structuredClone(character.sourceRefs) : [],
    };
  });
  return { schemaVersion: DOMAIN_SCHEMA_VERSION, characters: normalized };
}

export function validateArtifactRef(input, name = 'ArtifactRef') {
  const ref = requireObject(input, name);
  requireString(ref.artifactId, `${name}.artifactId`);
  if (!Number.isInteger(Number(ref.revision)) || Number(ref.revision) < 1) {
    throw new ContractError(`${name}.revision phải là số nguyên dương.`);
  }
  requireString(ref.contentHash, `${name}.contentHash`);
  return {
    artifactId: ref.artifactId.trim(),
    revision: Number(ref.revision),
    contentHash: ref.contentHash.trim(),
  };
}

export function validateDependencyRefs(input) {
  if (!Array.isArray(input)) throw new ContractError('dependencies phải là array.');
  return input.map((ref, index) => validateArtifactRef(ref, `dependencies[${index}]`));
}

export function validateArtifactEnvelope(input) {
  const envelope = requireObject(input, 'ArtifactEnvelope');
  requireString(envelope.artifactId, 'ArtifactEnvelope.artifactId');
  requireString(envelope.kind, 'ArtifactEnvelope.kind');
  if (!Number.isInteger(Number(envelope.schemaVersion)) || Number(envelope.schemaVersion) < 1) {
    throw new ContractError('ArtifactEnvelope.schemaVersion không hợp lệ.');
  }
  if (!Number.isInteger(Number(envelope.revision)) || Number(envelope.revision) < 1) {
    throw new ContractError('ArtifactEnvelope.revision phải là số nguyên dương.');
  }
  requireObject(envelope.scope, 'ArtifactEnvelope.scope');
  requireObject(envelope.producer, 'ArtifactEnvelope.producer');
  requireString(envelope.producer.runId, 'ArtifactEnvelope.producer.runId');
  requireString(envelope.producer.stepId, 'ArtifactEnvelope.producer.stepId');
  requireString(envelope.producer.toolVersion, 'ArtifactEnvelope.producer.toolVersion');
  validateDependencyRefs(envelope.inputRefs || []);
  if (!Object.hasOwn(envelope, 'payload')) throw new ContractError('ArtifactEnvelope.payload bị thiếu.');
  const expectedHash = `sha256:${sha256(envelope.payload)}`;
  if (envelope.contentHash !== expectedHash) {
    throw new ContractError('contentHash không khớp payload.', 'ARTIFACT_HASH_MISMATCH', { expectedHash });
  }
  return structuredClone({
    ...envelope,
    schemaVersion: Number(envelope.schemaVersion),
    revision: Number(envelope.revision),
    inputRefs: validateDependencyRefs(envelope.inputRefs || []),
  });
}

export function createArtifactEnvelope({ artifactId, kind, revision = 1, scope, inputRefs = [], producer, payload }) {
  requireString(artifactId, 'artifactId');
  requireString(kind, 'kind');
  requireObject(scope, 'scope');
  requireObject(producer, 'producer');
  requireString(producer.runId, 'producer.runId');
  requireString(producer.stepId, 'producer.stepId');
  requireString(producer.toolVersion, 'producer.toolVersion');
  const envelope = {
    artifactId,
    kind,
    schemaVersion: DOMAIN_SCHEMA_VERSION,
    revision: Number(revision),
    scope: structuredClone(scope),
    inputRefs: validateDependencyRefs(inputRefs),
    producer: structuredClone(producer),
    contentHash: `sha256:${sha256(payload)}`,
    payload: structuredClone(payload),
  };
  return validateArtifactEnvelope(envelope);
}

export function validateTypedPatch(input) {
  const patch = requireObject(input, 'TypedPatch');
  requireString(patch.patchId, 'TypedPatch.patchId');
  requireString(patch.targetType, 'TypedPatch.targetType');
  requireString(patch.targetId, 'TypedPatch.targetId');
  if (!Number.isInteger(Number(patch.expectedRevision)) || Number(patch.expectedRevision) < 1) {
    throw new ContractError('TypedPatch.expectedRevision phải là số nguyên dương.');
  }
  validateDependencyRefs(patch.inputRefs || []);
  if (!Array.isArray(patch.operations) || !patch.operations.length) {
    throw new ContractError('TypedPatch.operations phải có ít nhất một operation.');
  }
  const operationTypes = new Set(['change-face', 'change-pose', 'change-dialogue', 'change-dialogue-speed', 'change-silent-duration', 'change-prop-continuity']);
  for (const [index, operation] of patch.operations.entries()) {
    requireObject(operation, `TypedPatch.operations[${index}]`);
    const type = requireString(operation.type, `TypedPatch.operations[${index}].type`);
    if (!operationTypes.has(type)) throw new ContractError(`TypedPatch operation không được hỗ trợ: ${type}.`);
    requireObject(operation.target, `TypedPatch.operations[${index}].target`);
    requireString(operation.target.sceneId || patch.targetId, `TypedPatch.operations[${index}].target.sceneId`);
    if (type === 'change-face' || type === 'change-pose') {
      requireString(operation.target.characterId, `TypedPatch.operations[${index}].target.characterId`);
      requireString(operation.value?.[type === 'change-face' ? 'faceId' : 'poseId'], `TypedPatch.operations[${index}].value.${type === 'change-face' ? 'faceId' : 'poseId'}`);
    } else if (type === 'change-dialogue') {
      requireString(operation.target.shotId || operation.target.cueId, `TypedPatch.operations[${index}].target.shotId/cueId`);
      requireString(operation.value?.text, `TypedPatch.operations[${index}].value.text`);
      if (operation.value.audioPath != null) requireString(operation.value.audioPath, `TypedPatch.operations[${index}].value.audioPath`);
    } else if (type === 'change-dialogue-speed') {
      requireString(operation.target.shotId || operation.target.cueId, `TypedPatch.operations[${index}].target.shotId/cueId`);
      const speed = Number(operation.value?.speed);
      if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) {
        throw new ContractError(`TypedPatch.operations[${index}].value.speed phải nằm trong khoảng 0.5–2.0x.`);
      }
    } else if (type === 'change-silent-duration') {
      requireString(operation.target.shotId, `TypedPatch.operations[${index}].target.shotId`);
      requirePositive(operation.value?.durationSec, `TypedPatch.operations[${index}].value.durationSec`);
    } else if (type === 'change-prop-continuity') {
      requireString(operation.target.propId, `TypedPatch.operations[${index}].target.propId`);
      requireString(operation.value?.owner, `TypedPatch.operations[${index}].value.owner`);
      requireString(operation.value?.state, `TypedPatch.operations[${index}].value.state`);
    }
  }
  return structuredClone({
    ...patch,
    expectedRevision: Number(patch.expectedRevision),
    inputRefs: validateDependencyRefs(patch.inputRefs || []),
  });
}

export function validateReviewComment(input) {
  const comment = requireObject(input, 'ReviewComment');
  requireString(comment.commentId, 'ReviewComment.commentId');
  requireString(comment.filmId, 'ReviewComment.filmId');
  requireString(comment.filmRunId, 'ReviewComment.filmRunId');
  requireIntegerAtLeast(comment.filmRevision, 'ReviewComment.filmRevision');
  requireString(comment.text, 'ReviewComment.text');
  const scope = requireObject(comment.scope || {}, 'ReviewComment.scope');
  requireString(scope.sceneId, 'ReviewComment.scope.sceneId');
  if (scope.shotId == null && scope.cueId == null && scope.characterId == null && comment.timecode == null) {
    throw new ContractError('ReviewComment phải gắn với shot/cue/character hoặc timecode cụ thể.');
  }
  let timecode = null;
  if (comment.timecode != null) {
    const raw = requireObject(comment.timecode, 'ReviewComment.timecode');
    if (!['film-global', 'scene-local'].includes(raw.timebase || 'film-global')) throw new ContractError('ReviewComment.timecode.timebase không hợp lệ.');
    if (!Number.isFinite(Number(raw.seconds)) || Number(raw.seconds) < 0) throw new ContractError('ReviewComment.timecode.seconds phải >= 0.');
    timecode = { ...raw, seconds: Number(raw.seconds), timebase: raw.timebase || 'film-global', frame: raw.frame == null ? null : requireIntegerAtLeast(raw.frame, 'ReviewComment.timecode.frame', 0) };
  }
  return structuredClone({ ...comment, commentId: comment.commentId.trim(), filmId: comment.filmId.trim(), filmRunId: comment.filmRunId.trim(), filmRevision: Number(comment.filmRevision), scope: { ...scope, sceneId: scope.sceneId.trim() }, timecode, status: comment.status || 'open' });
}

export function validateRevisionRequest(input) {
  const request = requireObject(input, 'RevisionRequest');
  requireString(request.requestId, 'RevisionRequest.requestId');
  requireString(request.filmId, 'RevisionRequest.filmId');
  requireString(request.baseFilmRunId, 'RevisionRequest.baseFilmRunId');
  requireIntegerAtLeast(request.baseRevision, 'RevisionRequest.baseRevision');
  if (!Array.isArray(request.commentIds)) throw new ContractError('RevisionRequest.commentIds phải là array.');
  const patch = validateTypedPatch(request.patch || request.typedPatch);
  return structuredClone({ ...request, requestId: request.requestId.trim(), filmId: request.filmId.trim(), baseFilmRunId: request.baseFilmRunId.trim(), baseRevision: Number(request.baseRevision), commentIds: request.commentIds.map((id) => requireString(id, 'RevisionRequest.commentIds[]')), patch, status: request.status || 'requested' });
}

export function validateImpactSet(input) {
  const impact = requireObject(input, 'ImpactSet');
  if (!Array.isArray(impact.items)) throw new ContractError('ImpactSet.items phải là array.');
  const items = impact.items.map((item, index) => {
    requireObject(item, `ImpactSet.items[${index}]`);
    const scopeType = requireString(item.scopeType, `ImpactSet.items[${index}].scopeType`);
    if (!['film', 'scene', 'shot', 'cue', 'character', 'prop', 'assembly', 'subtitle'].includes(scopeType)) throw new ContractError(`ImpactSet scopeType không hợp lệ: ${scopeType}.`);
    requireString(item.scopeId, `ImpactSet.items[${index}].scopeId`);
    if (!['recompute', 'reuse', 'continuity-check', 'blocked'].includes(item.action)) throw new ContractError(`ImpactSet action không hợp lệ: ${item.action}.`);
    return structuredClone(item);
  });
  return structuredClone({ ...impact, items, affectedSceneIds: Array.isArray(impact.affectedSceneIds) ? impact.affectedSceneIds.map(String) : [], reusedSceneIds: Array.isArray(impact.reusedSceneIds) ? impact.reusedSceneIds.map(String) : [] });
}

export function validateRevisionPlan(input) {
  const plan = requireObject(input, 'RevisionPlan');
  requireString(plan.revisionId, 'RevisionPlan.revisionId');
  requireString(plan.filmId, 'RevisionPlan.filmId');
  requireString(plan.baseFilmRunId, 'RevisionPlan.baseFilmRunId');
  requireIntegerAtLeast(plan.baseRevision, 'RevisionPlan.baseRevision');
  requireIntegerAtLeast(plan.revision, 'RevisionPlan.revision');
  const impactSet = validateImpactSet(plan.impactSet);
  if (!Array.isArray(plan.patches) || !plan.patches.length) throw new ContractError('RevisionPlan.patches phải có ít nhất một patch.');
  const patches = plan.patches.map(validateTypedPatch);
  if (!Array.isArray(plan.recomputeArtifactRefs) || !Array.isArray(plan.reuseArtifactRefs)) throw new ContractError('RevisionPlan phải khai báo recomputeArtifactRefs và reuseArtifactRefs.');
  return structuredClone({ ...plan, baseRevision: Number(plan.baseRevision), revision: Number(plan.revision), impactSet, patches, recomputeArtifactRefs: plan.recomputeArtifactRefs.map((ref) => validateArtifactRef(ref, 'RevisionPlan.recomputeArtifactRefs[]')), reuseArtifactRefs: plan.reuseArtifactRefs.map((ref) => validateArtifactRef(ref, 'RevisionPlan.reuseArtifactRefs[]')) });
}

export function validateRevisionDecision(input) {
  const decision = requireObject(input, 'RevisionDecision');
  requireString(decision.decisionId, 'RevisionDecision.decisionId');
  requireString(decision.revisionId, 'RevisionDecision.revisionId');
  if (!['approved', 'rejected'].includes(decision.decision)) throw new ContractError('RevisionDecision.decision phải là approved hoặc rejected.');
  requireString(decision.expectedBaseFilmRunId, 'RevisionDecision.expectedBaseFilmRunId');
  requireIntegerAtLeast(decision.expectedBaseRevision, 'RevisionDecision.expectedBaseRevision');
  if (!decision.expectedBaseAssemblyRef) throw new ContractError('RevisionDecision.expectedBaseAssemblyRef là bắt buộc để approve/reject theo hash.');
  validateArtifactRef(decision.expectedBaseAssemblyRef, 'RevisionDecision.expectedBaseAssemblyRef');
  return structuredClone(decision);
}

export function validateRevisionAdapterResult(input) {
  const result = requireObject(input, 'RevisionAdapterResult');
  const status = requireString(result.status, 'RevisionAdapterResult.status');
  if (!['proposed', 'needs-clarification', 'unsupported'].includes(status)) {
    throw new ContractError('RevisionAdapterResult.status phải là proposed, needs-clarification hoặc unsupported.');
  }
  const provenance = requireObject(result.provenance || {}, 'RevisionAdapterResult.provenance');
  requireString(provenance.provider, 'RevisionAdapterResult.provenance.provider');
  requireString(provenance.model, 'RevisionAdapterResult.provenance.model');
  if (!Number.isInteger(Number(provenance.attempts)) || Number(provenance.attempts) < 1) {
    throw new ContractError('RevisionAdapterResult.provenance.attempts phải là số nguyên dương.');
  }
  if (status === 'proposed') {
    const plan = validateRevisionPlan(result.plan);
    if (!result.patch) throw new ContractError('RevisionAdapterResult.proposed phải giữ lại patch đã được planner dùng.');
    const patch = validateTypedPatch(result.patch);
    return structuredClone({ ...result, status, plan, patch, provenance: { ...provenance, attempts: Number(provenance.attempts) } });
  }
  if (status === 'needs-clarification') {
    const clarification = requireObject(result.clarification || {}, 'RevisionAdapterResult.clarification');
    requireString(clarification.question, 'RevisionAdapterResult.clarification.question');
    if (clarification.options != null && (!Array.isArray(clarification.options) || clarification.options.some((option) => typeof option !== 'string' || !option.trim()))) {
      throw new ContractError('RevisionAdapterResult.clarification.options phải là array chuỗi.');
    }
    return structuredClone({ ...result, status, clarification: { ...clarification, question: clarification.question.trim(), options: clarification.options?.map((option) => option.trim()) || [] }, provenance: { ...provenance, attempts: Number(provenance.attempts) } });
  }
  requireString(result.reason, 'RevisionAdapterResult.reason');
  return structuredClone({ ...result, status, reason: result.reason.trim(), provenance: { ...provenance, attempts: Number(provenance.attempts) } });
}

export function validateStepState(input) {
  const step = requireObject(input, 'StepState');
  requireString(step.stepId, 'StepState.stepId');
  const allowed = ['pending', 'ready', 'running', 'succeeded', 'retry_wait', 'blocked', 'failed', 'cancelled', 'superseded', 'interrupted'];
  if (!allowed.includes(step.status)) throw new ContractError(`StepState.status không hợp lệ: ${step.status}.`);
  if (!Array.isArray(step.dependencies)) throw new ContractError('StepState.dependencies phải là array.');
  return structuredClone(step);
}

export function validateSceneProductionPlan(input) {
  const plan = requireObject(input, 'SceneProductionPlan');
  requireString(plan.sceneId, 'SceneProductionPlan.sceneId');
  if (!Array.isArray(plan.shots) || !plan.shots.length) throw new ContractError('SceneProductionPlan phải có shots.');
  if (!Array.isArray(plan.dependencies)) throw new ContractError('SceneProductionPlan.dependencies phải là array.');
  if (!['ready', 'blocked'].includes(plan.status)) throw new ContractError('SceneProductionPlan.status không hợp lệ.');
  for (const shot of plan.shots) {
    requireString(shot.shotId, 'SceneProductionPlan.shot.shotId');
    if (!Array.isArray(shot.cast)) throw new ContractError(`Shot ${shot.shotId} thiếu cast.`);
    if (!Array.isArray(shot.actions)) throw new ContractError(`Shot ${shot.shotId} thiếu actions.`);
    if (!Array.isArray(shot.dialogueCueRefs)) throw new ContractError(`Shot ${shot.shotId} thiếu dialogueCueRefs.`);
  }
  return structuredClone(plan);
}

function requireIntegerAtLeast(value, name, minimum = 1) {
  if (!Number.isInteger(Number(value)) || Number(value) < minimum) {
    throw new ContractError(`${name} phải là số nguyên >= ${minimum}.`);
  }
  return Number(value);
}

function requireArrayOfStrings(value, name) {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new ContractError(`${name} phải là array chuỗi không rỗng.`);
  }
  return value.map((item) => item.trim());
}

function validateMediaMetadata(input, name = 'MediaMetadata') {
  const media = requireObject(input, name);
  if (!media.videoUrl && !media.mediaPath) throw new ContractError(`${name}.videoUrl/mediaPath phải được khai báo.`);
  const durationSec = requirePositive(media.durationSec, `${name}.durationSec`);
  const frameCount = requireIntegerAtLeast(media.frameCount, `${name}.frameCount`);
  const fps = requirePositive(media.fps, `${name}.fps`);
  const width = requireIntegerAtLeast(media.width, `${name}.width`);
  const height = requireIntegerAtLeast(media.height, `${name}.height`);
  return structuredClone({ ...media, durationSec, frameCount, fps, width, height });
}

export function validateFilmPlan(input) {
  const plan = requireObject(input, 'FilmPlan');
  const filmId = requireString(plan.filmId, 'FilmPlan.filmId');
  const revision = requireIntegerAtLeast(plan.revision, 'FilmPlan.revision');
  const profile = requireObject(plan.profile, 'FilmPlan.profile');
  const fps = requirePositive(profile.fps, 'FilmPlan.profile.fps');
  const width = requireIntegerAtLeast(profile.width, 'FilmPlan.profile.width');
  const height = requireIntegerAtLeast(profile.height, 'FilmPlan.profile.height');
  const sceneOrder = requireArrayOfStrings(plan.sceneOrder, 'FilmPlan.sceneOrder');
  if (!Array.isArray(plan.scenes) || plan.scenes.length !== sceneOrder.length) {
    throw new ContractError('FilmPlan.scenes phải khớp chính xác với sceneOrder.');
  }
  const seen = new Set();
  const scenes = plan.scenes.map((scene, index) => {
    requireObject(scene, `FilmPlan.scenes[${index}]`);
    const sceneId = requireString(scene.sceneId, `FilmPlan.scenes[${index}].sceneId`);
    if (sceneId !== sceneOrder[index]) throw new ContractError(`FilmPlan.sceneOrder[${index}] không khớp ${sceneId}.`);
    if (seen.has(sceneId)) throw new ContractError(`FilmPlan.sceneId bị trùng: ${sceneId}.`);
    seen.add(sceneId);
    const dependencySceneIds = Array.isArray(scene.dependencySceneIds) ? scene.dependencySceneIds.map(String) : [];
    if (dependencySceneIds.includes(sceneId)) throw new ContractError(`Scene ${sceneId} không thể phụ thuộc chính nó.`);
    return structuredClone({
      ...scene,
      sceneId,
      ordinal: requireIntegerAtLeast(scene.ordinal ?? index + 1, `FilmPlan.scenes[${index}].ordinal`),
      dependencySceneIds,
      continuityIn: scene.continuityIn ?? null,
      continuityOut: scene.continuityOut ?? null,
      transition: scene.transition || { type: 'hard-cut' },
    });
  });
  const sceneIds = new Set(sceneOrder);
  for (const scene of scenes) {
    for (const dependencySceneId of scene.dependencySceneIds) {
      if (!sceneIds.has(dependencySceneId)) throw new ContractError(`FilmPlan dependency ${dependencySceneId} của ${scene.sceneId} không tồn tại trong sceneOrder.`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (sceneId) => {
    if (visiting.has(sceneId)) throw new ContractError(`FilmPlan dependency cycle tại ${sceneId}.`);
    if (visited.has(sceneId)) return;
    visiting.add(sceneId);
    for (const dependencySceneId of scenes.find((scene) => scene.sceneId === sceneId).dependencySceneIds) visit(dependencySceneId);
    visiting.delete(sceneId);
    visited.add(sceneId);
  };
  for (const sceneId of sceneOrder) visit(sceneId);
  return structuredClone({ ...plan, schemaVersion: DOMAIN_SCHEMA_VERSION, filmId, revision, profile: { ...profile, fps, width, height }, sceneOrder, scenes });
}

export function validateFilmBible(input) {
  const bible = requireObject(input, 'FilmBible');
  const filmId = requireString(bible.filmId, 'FilmBible.filmId');
  const revision = requireIntegerAtLeast(bible.revision, 'FilmBible.revision');
  if (!Array.isArray(bible.characters) || !bible.characters.length) throw new ContractError('FilmBible.characters phải có ít nhất một character.');
  const seenCharacters = new Set();
  const characters = bible.characters.map((character, index) => {
    requireObject(character, `FilmBible.characters[${index}]`);
    const characterId = requireString(character.characterId, `FilmBible.characters[${index}].characterId`);
    if (seenCharacters.has(characterId)) throw new ContractError(`FilmBible.characterId bị trùng: ${characterId}.`);
    seenCharacters.add(characterId);
    const voiceBinding = requireObject(character.voiceBinding || { voiceId: character.voiceId }, `FilmBible.characters[${index}].voiceBinding`);
    return structuredClone({
      ...character,
      characterId,
      displayName: requireString(character.displayName || character.characterId, `FilmBible.characters[${index}].displayName`),
      voiceId: requireString(voiceBinding.voiceId, `FilmBible.characters[${index}].voiceBinding.voiceId`),
      voiceBinding: { ...voiceBinding, voiceId: requireString(voiceBinding.voiceId, `FilmBible.characters[${index}].voiceBinding.voiceId`) },
      sourceRefs: Array.isArray(character.sourceRefs) ? structuredClone(character.sourceRefs) : [],
    });
  });
  const locations = Array.isArray(bible.locations) ? bible.locations.map((location, index) => {
    requireObject(location, `FilmBible.locations[${index}]`);
    return structuredClone({ ...location, locationId: requireString(location.locationId, `FilmBible.locations[${index}].locationId`) });
  }) : [];
  const props = Array.isArray(bible.props) ? bible.props.map((prop, index) => {
    requireObject(prop, `FilmBible.props[${index}]`);
    return structuredClone({ ...prop, propId: requireString(prop.propId, `FilmBible.props[${index}].propId`) });
  }) : [];
  return structuredClone({ ...bible, schemaVersion: DOMAIN_SCHEMA_VERSION, filmId, revision, characters, locations, props, continuityFacts: Array.isArray(bible.continuityFacts) ? structuredClone(bible.continuityFacts) : [] });
}

export function validateSceneOutputRef(input) {
  const output = requireObject(input, 'SceneOutputReference');
  const sceneId = requireString(output.sceneId, 'SceneOutputReference.sceneId');
  const sceneRunId = requireString(output.sceneRunId, 'SceneOutputReference.sceneRunId');
  const inputHash = requireString(output.inputHash, 'SceneOutputReference.inputHash');
  const clipArtifactRef = validateArtifactRef(output.clipArtifactRef, 'SceneOutputReference.clipArtifactRef');
  const mediaArtifactRef = validateArtifactRef(output.mediaArtifactRef, 'SceneOutputReference.mediaArtifactRef');
  const manifestArtifactRef = validateArtifactRef(output.manifestArtifactRef, 'SceneOutputReference.manifestArtifactRef');
  const media = validateMediaMetadata(output.media, 'SceneOutputReference.media');
  return structuredClone({ ...output, sceneId, sceneRunId, inputHash, clipArtifactRef, mediaArtifactRef, manifestArtifactRef, media });
}

export function validateEditDecisionList(input) {
  const edl = requireObject(input, 'EditDecisionList');
  const filmId = requireString(edl.filmId, 'EditDecisionList.filmId');
  const revision = requireIntegerAtLeast(edl.revision, 'EditDecisionList.revision');
  const sceneOrder = requireArrayOfStrings(edl.sceneOrder, 'EditDecisionList.sceneOrder');
  if (!Array.isArray(edl.edits) || edl.edits.length !== sceneOrder.length) throw new ContractError('EditDecisionList.edits phải đủ một edit cho mỗi scene.');
  const edits = edl.edits.map((edit, index) => {
    requireObject(edit, `EditDecisionList.edits[${index}]`);
    const sceneId = requireString(edit.sceneId, `EditDecisionList.edits[${index}].sceneId`);
    if (sceneId !== sceneOrder[index]) throw new ContractError(`EDL scene order không khớp tại ${sceneId}.`);
    const source = requireObject(edit.source, `EditDecisionList.edits[${index}].source`);
    const timeline = requireObject(edit.timeline, `EditDecisionList.edits[${index}].timeline`);
    const inSec = Number(source.inSec);
    const outSec = Number(source.outSec);
    if (!(Number.isFinite(inSec) && inSec >= 0 && Number.isFinite(outSec) && outSec > inSec)) throw new ContractError(`EDL source range không hợp lệ cho ${sceneId}.`);
    if (!Number.isFinite(Number(timeline.startSec)) || !Number.isFinite(Number(timeline.endSec)) || Number(timeline.endSec) <= Number(timeline.startSec)) throw new ContractError(`EDL timeline range không hợp lệ cho ${sceneId}.`);
    return structuredClone({ ...edit, sceneId, ordinal: index + 1, source: { ...source, inSec, outSec }, timeline: { ...timeline, startSec: Number(timeline.startSec), endSec: Number(timeline.endSec), startFrame: requireIntegerAtLeast(timeline.startFrame, `EDL ${sceneId}.timeline.startFrame`, 0), endFrame: requireIntegerAtLeast(timeline.endFrame, `EDL ${sceneId}.timeline.endFrame`, 1) } });
  });
  return structuredClone({ ...edl, schemaVersion: DOMAIN_SCHEMA_VERSION, filmId, revision, sceneOrder, edits });
}

export function validateFilmAssemblyManifest(input) {
  const manifest = requireObject(input, 'FilmAssemblyManifest');
  const filmId = requireString(manifest.filmId, 'FilmAssemblyManifest.filmId');
  const revision = requireIntegerAtLeast(manifest.revision, 'FilmAssemblyManifest.revision');
  const profile = requireObject(manifest.profile, 'FilmAssemblyManifest.profile');
  const edl = validateEditDecisionList(manifest.edl);
  const mediaArtifactRef = validateArtifactRef(manifest.mediaArtifactRef, 'FilmAssemblyManifest.mediaArtifactRef');
  const subtitleArtifactRef = validateArtifactRef(manifest.subtitleArtifactRef, 'FilmAssemblyManifest.subtitleArtifactRef');
  const media = validateMediaMetadata(manifest.media, 'FilmAssemblyManifest.media');
  const subtitle = requireObject(manifest.subtitle, 'FilmAssemblyManifest.subtitle');
  requireString(subtitle.url || subtitle.path, 'FilmAssemblyManifest.subtitle.url/path');
  if (subtitle.format !== 'srt' && subtitle.format !== 'webvtt') throw new ContractError('FilmAssemblyManifest.subtitle.format phải là srt hoặc webvtt.');
  requireObject(manifest.provenance, 'FilmAssemblyManifest.provenance');
  return structuredClone({ ...manifest, schemaVersion: DOMAIN_SCHEMA_VERSION, filmId, revision, profile, edl, mediaArtifactRef, subtitleArtifactRef, media, subtitle, provenance: structuredClone(manifest.provenance) });
}

export function validateFilmRunState(input) {
  const state = requireObject(input, 'FilmRunState');
  requireString(state.filmRunId, 'FilmRunState.filmRunId');
  const allowed = ['queued', 'running', 'partial', 'blocked', 'failed', 'succeeded', 'cancelled', 'interrupted'];
  if (!allowed.includes(state.status)) throw new ContractError(`FilmRunState.status không hợp lệ: ${state.status}.`);
  if (!Array.isArray(state.sceneStatuses)) throw new ContractError('FilmRunState.sceneStatuses phải là array.');
  return structuredClone(state);
}

export function errorToContractDetails(error) {
  return {
    code: error?.code || 'WORKFLOW_ERROR',
    message: error?.message || String(error),
    details: error?.details || {},
  };
}
