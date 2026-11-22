import {
  ContractError,
  sha256,
  validateFilmBible,
  validateFilmBrief,
  validateFilmPlan,
} from './contracts.mjs';

const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

function continuityFacts(scene) {
  return asObject(scene.continuityIn);
}

function stateMap(value) {
  return asObject(value.propStates || value.props || value.propState);
}

function factValue(facts, key) {
  return firstDefined(facts[key], facts[`${key}Id`]);
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function addFinding(findings, sceneId, code, message, details = {}) {
  findings.push({ scopeType: 'scene', scopeId: sceneId, code, message, details });
}

export function validateFilmContinuity({ filmPlan, filmBible, scenes } = {}) {
  const plan = validateFilmPlan(filmPlan);
  const bible = validateFilmBible(filmBible);
  const sceneInputs = new Map(asArray(scenes).map((scene) => [scene?.sceneId || scene?.sceneIntent?.sceneId, scene]));
  const characterIds = new Set(bible.characters.map((character) => character.characterId));
  const propIds = new Set(bible.props.map((prop) => prop.propId));
  const findings = [];

  for (const planScene of plan.scenes) {
    const input = sceneInputs.get(planScene.sceneId);
    if (!input?.sceneIntent || input.sceneIntent.sceneId !== planScene.sceneId) {
      addFinding(findings, planScene.sceneId, 'SCENE_INPUT_MISSING', `Thiếu SceneIntent cho ${planScene.sceneId}.`);
      continue;
    }
    const bindings = asObject(input.bindings);
    for (const shot of asArray(input.sceneIntent.shots)) {
      for (const actor of asArray(shot.actors || shot.cast)) {
        const characterId = String(actor.characterId || actor.actorId || '').trim();
        if (characterId && !characterIds.has(characterId)) addFinding(findings, planScene.sceneId, 'CHARACTER_NOT_IN_FILM_BIBLE', `Character ${characterId} không có trong FilmBible.`, { shotId: shot.shotId });
        if (characterId && !bindings.characters?.[characterId]) addFinding(findings, planScene.sceneId, 'SCENE_CAST_BINDING_MISSING', `Scene ${planScene.sceneId} chưa pin binding cho ${characterId}.`, { shotId: shot.shotId });
      }
      const speakerId = String(shot.speakerId || shot.speaker || '').trim();
      if (shot.dialogue && speakerId && !characterIds.has(speakerId)) addFinding(findings, planScene.sceneId, 'DIALOGUE_SPEAKER_NOT_IN_FILM_BIBLE', `Speaker ${speakerId} không có trong FilmBible.`, { shotId: shot.shotId });
    }

    const declaredFacts = { ...asObject(planScene.continuityIn), ...asObject(planScene.continuityOut) };
    for (const [propId, state] of Object.entries(stateMap(declaredFacts))) {
      if (!propIds.has(propId)) addFinding(findings, planScene.sceneId, 'PROP_NOT_IN_FILM_BIBLE', `Prop ${propId} chưa được khai báo trong FilmBible.`, { propId });
      const owner = firstDefined(state?.owner, state?.holder, state?.heldBy);
      if (owner && !characterIds.has(String(owner))) addFinding(findings, planScene.sceneId, 'PROP_OWNER_NOT_IN_FILM_BIBLE', `Prop ${propId} có owner không xác định: ${owner}.`, { propId, owner });
    }
  }

  for (let index = 1; index < plan.scenes.length; index += 1) {
    const previous = plan.scenes[index - 1];
    const current = plan.scenes[index];
    const currentInput = sceneInputs.get(current.sceneId);
    const previousFacts = asObject(previous.continuityOut);
    const currentFacts = continuityFacts(current);
    const isTimeJump = current.transition?.type === 'time-jump' || current.transition?.type === 'intentional-change';
    if (current.dependencySceneIds.length && !current.dependencySceneIds.includes(previous.sceneId)) {
      addFinding(findings, current.sceneId, 'SCENE_ORDER_DEPENDENCY_MISMATCH', `Scene ${current.sceneId} không khai báo dependency của scene liền trước ${previous.sceneId}.`, { dependencySceneIds: current.dependencySceneIds });
    }
    if (isTimeJump) continue;
    if (!Object.keys(currentFacts).length) {
      addFinding(findings, current.sceneId, 'CONTINUITY_IN_MISSING', `Scene ${current.sceneId} thiếu continuityIn bắt buộc.`, { dependsOn: previous.sceneId });
      continue;
    }
    for (const key of ['location', 'locationId', 'time', 'timeOfDay']) {
      const expected = factValue(previousFacts, key);
      const actual = factValue(currentFacts, key);
      if (expected !== undefined && actual === undefined) addFinding(findings, current.sceneId, 'CONTINUITY_FACT_MISSING', `Scene ${current.sceneId} thiếu continuity fact ${key}.`, { expected, fromSceneId: previous.sceneId });
      else if (expected !== undefined && actual !== undefined && expected !== actual) addFinding(findings, current.sceneId, 'CONTINUITY_FACT_MISMATCH', `Scene ${current.sceneId} đổi ${key} từ ${expected} thành ${actual} nhưng không khai báo time jump/chủ ý.`, { expected, actual, fromSceneId: previous.sceneId });
    }
    const expectedProps = stateMap(previousFacts);
    const actualProps = stateMap(currentFacts);
    for (const [propId, expected] of Object.entries(expectedProps)) {
      if (!Object.hasOwn(actualProps, propId)) {
        addFinding(findings, current.sceneId, 'PROP_CONTINUITY_MISSING', `Scene ${current.sceneId} không khai báo trạng thái tiếp nối của prop ${propId}.`, { expected, fromSceneId: previous.sceneId });
        continue;
      }
      const actual = actualProps[propId];
      const expectedOwner = firstDefined(expected?.owner, expected?.holder, expected?.heldBy);
      const actualOwner = firstDefined(actual?.owner, actual?.holder, actual?.heldBy);
      if (expectedOwner && actualOwner && expectedOwner !== actualOwner && !sameValue(expected, actual)) {
        // A deliberate handoff is valid only when the scene explicitly records the transition.
        const handoff = asObject(currentFacts.transitions || currentFacts.propTransitions)[propId];
        if (!handoff) addFinding(findings, current.sceneId, 'PROP_HANDOFF_UNDECLARED', `Prop ${propId} đổi owner giữa scene nhưng chưa có transition declaration.`, { expectedOwner, actualOwner, fromSceneId: previous.sceneId });
      }
    }
    if (!currentInput?.sceneIntent) addFinding(findings, current.sceneId, 'SCENE_INPUT_MISSING', `SceneIntent ${current.sceneId} không sẵn sàng để kiểm continuity.`);
  }

  return { valid: findings.length === 0, findings, filmId: plan.filmId, revision: plan.revision };
}

export function validateFilmPackage({ filmBrief, filmPlan, filmBible, scenes } = {}) {
  const brief = validateFilmBrief(filmBrief);
  const plan = validateFilmPlan(filmPlan);
  const bible = validateFilmBible(filmBible);
  if (brief.filmId !== plan.filmId || plan.filmId !== bible.filmId) throw new ContractError('FilmBrief, FilmPlan và FilmBible phải cùng filmId.');
  const normalizedScenes = asArray(scenes).map((scene, index) => {
    if (!scene || typeof scene !== 'object') throw new ContractError(`FilmPackage.scenes[${index}] phải là object.`);
    const sceneId = String(scene.sceneId || scene.sceneIntent?.sceneId || '').trim();
    if (!sceneId) throw new ContractError(`FilmPackage.scenes[${index}].sceneId bị thiếu.`);
    return { ...scene, sceneId };
  });
  if (normalizedScenes.length !== plan.sceneOrder.length || normalizedScenes.some((scene, index) => scene.sceneId !== plan.sceneOrder[index])) {
    throw new ContractError('FilmPackage.scenes phải có đúng thứ tự và số lượng như FilmPlan.sceneOrder.');
  }
  const continuity = validateFilmContinuity({ filmPlan: plan, filmBible: bible, scenes: normalizedScenes });
  return {
    filmBrief: brief,
    filmPlan: plan,
    filmBible: bible,
    scenes: structuredClone(normalizedScenes),
    continuity,
    inputHash: sha256({ filmBrief: brief, filmPlan: plan, filmBible: bible, scenes: normalizedScenes }),
  };
}
