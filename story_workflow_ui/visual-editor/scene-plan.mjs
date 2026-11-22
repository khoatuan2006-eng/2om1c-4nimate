// Scene plan: one declarative file per scene (who stands where, which pose/face, which effect) that compiles
// into the existing authoring operations. The agent names things the way contact sheets show them
// (Chinese pose/face names or cell numbers); the compiler computes placement, keyframes and beats.
//
//   {version:1,id:'ep02-s03',title,
//    location:{asset:'Phòng vệ sinh'},                         // catalog name or id
//    cast:{hero:{asset:'Nhật Thành · nguồn cơ thể/face S05',faceStyle:'detailed'}},
//    transitions:{in:{type:'fade-black',frames:10},out:{type:'wipe-left',frames:14}},
//    beats:[{id:'b1',quote:'…',frames:84,shot:'medium',
//            actors:[{who:'hero',pose:'逃跑',face:'惊吓',at:'left',enter:'pop-in'}],
//            fx:[{effect:'Hiệu ứng va chạm',at:50,frames:10}],shake:true}]}
import { createHash } from 'node:crypto';
import { applyAuthoringOperations } from './authoring-operations.mjs';
import { validateDocument } from './model.mjs';
import { validateParallax } from './parallax.mjs';
import { inverse, worldMatrix } from './scene-graph.mjs';
import { matchCatalogItem, resolveActorFlip, locationStageFor, characterMetaFor, fxMetaFor, loadSemanticRegistry, loadTranslations } from './semantic-catalog.mjs';
import { resolvePlanTiming } from './timing-resolver.mjs';
import { prepareAudioPreset, BGM_DEFAULT_VOLUME, BGM_DEFAULT_DUCK_VOLUME, SFX_DEFAULT_VOLUMES } from './audio-presets.mjs';
import {
  AURA_NAMES, LINE_NAMES, FLASH_NAMES, MOOD_NAMES, PARTICLE_NAMES, IMPACT_NAMES, SFX_STYLE_NAMES,
  CUT_TRANSITION_NAMES, CUT_TRANSITION_DEFAULTS, FILM_BURN_NAMES, PANEL_STYLE_NAMES, BGM_PRESET_NAMES, SFX_PRESET_NAMES,
  IMPACT_FRAME_NAMES, TRAIL_COLOR_NAMES, LIGHTING_NAMES, CAPTION_STYLE_NAMES,
  EMOTE_NAMES, SPEECH_VARIANT_NAMES, CAMERA_ANGLE_NAMES, splitSpeechChunks, allocateChunkSpans, locateQuoteSpan, extractQuotedDialogueSegments,
} from './fx-presets.mjs';

export const PLAN_VERSION = 1;
export const CAMERA_PRESETS = Object.freeze(['off', 'push-in', 'pull-out', 'pan-left', 'pan-right', 'drift', 'zoom-punch', 'whip-left', 'whip-right']);
export const MOTION_PRESETS = Object.freeze(['none', 'dash-left', 'dash-right', 'step-in', 'recoil', 'run-left', 'run-right', 'slide-in-left', 'slide-in-right', 'bob', 'breathe', 'float', 'talk', 'talk-excited']);
export const PROP_MOTION_PRESETS = Object.freeze(['none', 'throw-right', 'throw-left', 'arc', 'float', 'spin']);
export const DEFAULT_STAGE = Object.freeze({
  groundY: 960,                                    // y of the feet line in 1920x1080 (leaves safe room for bottom subtitles)
  shots: { wide: 510, medium: 750, close: 900 },           // character height per shot size (safe under camera zoom)
  slots: { 'far-left': 320, left: 560, 'center-left': 760, center: 960, 'center-right': 1160, right: 1360, 'far-right': 1600 },
  depth: { near: 1, mid: .82, far: .62 },
  parallax: { bg: 0.94, far: 0.96, mid: 0.98, near: 1.0 },
});
const id = /^[a-zA-Z0-9_-]{1,40}$/, fail = message => { throw Error('Kế hoạch cảnh: ' + message); };
const keys = (object, allowed, where) => { for (const key of Object.keys(object)) if (!allowed.includes(key)) fail(where + ' có trường lạ: ' + key); };
export const planDigest = plan => createHash('sha256').update(JSON.stringify(plan)).digest('hex');

function parseCamera(cam, where) {
  if (cam === undefined || cam === null) return null;
  if (typeof cam === 'string') {
    if (!CAMERA_PRESETS.includes(cam)) fail(where + ': camera phải thuộc ' + CAMERA_PRESETS.join('/'));
    return { type: cam, intensity: 1 };
  }
  if (typeof cam === 'object' && !Array.isArray(cam)) {
    keys(cam, ['type', 'intensity'], where + '.camera');
    if (!CAMERA_PRESETS.includes(cam.type)) fail(where + ': camera.type phải thuộc ' + CAMERA_PRESETS.join('/'));
    const intensity = cam.intensity ?? 1;
    if (!Number.isFinite(intensity) || intensity <= 0 || intensity > 3) fail(where + ': camera.intensity cần trong (0, 3]');
    return { type: cam.type, intensity };
  }
  fail(where + ': camera không hợp lệ');
}

function validateActorsAndFx(container, plan, where) {
  if (container.angle !== undefined && !CAMERA_ANGLE_NAMES.includes(container.angle)) fail(where + ': angle phải thuộc ' + CAMERA_ANGLE_NAMES.join('/'));
  if (container.speaker !== undefined && !(container.speaker in plan.cast)) fail(where + ': speaker "' + container.speaker + '" không có trong cast');
  if (container.speech !== undefined) {
    if (typeof container.speech === 'string') {
      if (!container.speech.trim()) fail(where + ': speech rỗng');
    } else if (container.speech && typeof container.speech === 'object' && !Array.isArray(container.speech)) {
      keys(container.speech, ['who', 'prop', 'text', 'fromQuote', 'variant', 'title', 'color', 'maxChars', 'chunks', 'side'], where + '.speech');
      if (container.speech.who !== undefined && !(container.speech.who in plan.cast)) fail(where + '.speech: who "' + container.speech.who + '" không có trong cast');
      if (container.speech.prop !== undefined && (typeof container.speech.prop !== 'string' || !container.speech.prop.trim())) fail(where + '.speech: prop không hợp lệ');
      if (container.speech.fromQuote !== undefined && typeof container.speech.fromQuote !== 'boolean') fail(where + ': speech.fromQuote phải là boolean');
      if (container.speech.color !== undefined && typeof container.speech.color !== 'string') fail(where + ': speech.color không hợp lệ');
      const hasChunks = Array.isArray(container.speech.chunks) && container.speech.chunks.length > 0;
      if (!hasChunks && container.speech.fromQuote !== true && (typeof container.speech.text !== 'string' || !container.speech.text.trim())) fail(where + ': speech thiếu text');
      if (container.speech.chunks !== undefined && (!Array.isArray(container.speech.chunks) || !container.speech.chunks.length || container.speech.chunks.length > 16 || container.speech.chunks.some(c => typeof c !== 'string' || !c.trim()))) fail(where + ': speech.chunks cần 1–16 chuỗi không rỗng');
      if (container.speech.variant !== undefined && !SPEECH_VARIANT_NAMES.includes(container.speech.variant)) fail(where + ': speech.variant phải thuộc ' + SPEECH_VARIANT_NAMES.join('/'));
      if (container.speech.maxChars !== undefined && (!Number.isInteger(container.speech.maxChars) || container.speech.maxChars < 24 || container.speech.maxChars > 140)) fail(where + ': speech.maxChars 24–140');
      if (container.speech.side !== undefined && !['left', 'right', 'center'].includes(container.speech.side)) fail(where + ': speech.side left/right/center');
    } else fail(where + ': speech không hợp lệ');
  }
  const whoSeen = new Set();
  for (const a of container.actors ?? []) {
    if (whoSeen.has(a.who)) fail(where + ': ' + a.who + ' xuất hiện hai lần (mỗi nhân vật một layer mỗi nhịp hình)'); whoSeen.add(a.who);
    keys(a, ['who', 'pose', 'face', 'at', 'depth', 'flip', 'look', 'faceTo', 'aura', 'trail', 'motion', 'enter', 'exit', 'height', 'scale', 'framing', 'yOffset', 'speaking', 'emote', 'silhouette', 'rotate'], 'actor');
    if (!(a.who in plan.cast)) fail(where + ': who "' + a.who + '" không có trong cast');
    if (a.pose === undefined) fail(where + ': ' + a.who + ' thiếu pose');
    if (a.speaking !== undefined && typeof a.speaking !== 'boolean' && !['calm', 'excited'].includes(a.speaking)) fail(where + ': actor.speaking phải là boolean hoặc calm/excited');
    if (a.silhouette !== undefined && typeof a.silhouette !== 'boolean' && !['black', 'crimson'].includes(a.silhouette)) fail(where + ': actor.silhouette phải là boolean hoặc black/crimson');
    if (a.rotate !== undefined && (!Number.isFinite(a.rotate) || a.rotate < -45 || a.rotate > 45)) fail(where + ': actor.rotate cần trong [-45, 45]');
    if (a.emote !== undefined) {
      if (typeof a.emote === 'string') {
        if (!EMOTE_NAMES.includes(a.emote)) fail(where + ': emote phải thuộc ' + EMOTE_NAMES.join('/'));
      } else if (a.emote && typeof a.emote === 'object' && !Array.isArray(a.emote)) {
        keys(a.emote, ['type', 'at', 'frames', 'side'], where + '.emote');
        if (!EMOTE_NAMES.includes(a.emote.type)) fail(where + ': emote.type phải thuộc ' + EMOTE_NAMES.join('/'));
        if (a.emote.side !== undefined && !['left', 'right', 'auto'].includes(a.emote.side)) fail(where + ': emote.side left/right/auto');
        if (a.emote.at !== undefined && (!Number.isInteger(a.emote.at) || a.emote.at < 0)) fail(where + ': emote.at >= 0');
        if (a.emote.frames !== undefined && (!Number.isInteger(a.emote.frames) || a.emote.frames < 4 || a.emote.frames > 600)) fail(where + ': emote.frames 4–600');
      } else fail(where + ': emote không hợp lệ');
    }
    if (a.scale !== undefined && (!Number.isFinite(a.scale) || a.scale < 0.4 || a.scale > 2.0)) fail(where + ': actor.scale cần trong [0.4, 2.0]');
    if (a.framing !== undefined && !['full', 'bust', 'portrait'].includes(a.framing)) fail(where + ': actor.framing phải là full, bust hoặc portrait');
    if (a.yOffset !== undefined && (!Number.isFinite(a.yOffset) || a.yOffset < -300 || a.yOffset > 450)) fail(where + ': actor.yOffset cần trong [-300, 450]');
    if (a.aura !== undefined) {
      const at = typeof a.aura === 'string' ? a.aura : a.aura?.type;
      if (!AURA_NAMES.includes(at)) fail(where + ': aura phải thuộc ' + AURA_NAMES.join('/'));
    }
    if (a.trail !== undefined && a.trail !== true) {
      if (typeof a.trail === 'string') {
        if (!TRAIL_COLOR_NAMES.includes(a.trail)) fail(where + ': trail màu phải thuộc ' + TRAIL_COLOR_NAMES.join('/'));
      } else if (a.trail && typeof a.trail === 'object' && !Array.isArray(a.trail)) {
        keys(a.trail, ['color', 'copies', 'step'], where + '.trail');
        if (a.trail.copies !== undefined && (!Number.isInteger(a.trail.copies) || a.trail.copies < 1 || a.trail.copies > 5)) fail(where + ': trail.copies 1–5');
        if (a.trail.step !== undefined && (!Number.isInteger(a.trail.step) || a.trail.step < 1 || a.trail.step > 6)) fail(where + ': trail.step 1–6');
      } else fail(where + ': trail không hợp lệ');
    }
    if (a.motion !== undefined) {
      const mt = typeof a.motion === 'string' ? a.motion : a.motion?.type;
      if (!MOTION_PRESETS.includes(mt)) fail(where + ': motion phải thuộc ' + MOTION_PRESETS.join('/'));
    }
    if (typeof a.at === 'string' && a.at !== 'keep' && !(a.at in DEFAULT_STAGE.slots) || a.at !== undefined && typeof a.at !== 'string' && !Number.isFinite(a.at)) fail(where + ': at không hợp lệ');
    if (a.depth !== undefined && !(a.depth in DEFAULT_STAGE.depth)) fail(where + ': depth near/mid/far');
    if (a.look !== undefined && !['left', 'right'].includes(a.look)) fail(where + ': look left/right');
    if (a.faceTo !== undefined && !(a.faceTo in plan.cast)) fail(where + ': faceTo "' + a.faceTo + '" không có trong cast');
    if (a.enter !== undefined && !['pop-in', 'fade-in'].includes(a.enter) || a.exit !== undefined && a.exit !== 'fade-out') fail(where + ': enter pop-in|fade-in, exit fade-out');
  }
  for (const p of container.props ?? []) {
    keys(p, ['id', 'prop', 'item', 'at', 'y', 'height', 'flip', 'enter', 'exit', 'z', 'motion', 'trail'], 'prop');
    if (!p.prop) fail(where + ': prop thiếu tên prop');
    if (typeof p.at === 'string' && !(p.at in DEFAULT_STAGE.slots) || p.at !== undefined && typeof p.at !== 'string' && !Number.isFinite(p.at)) fail(where + ': prop.at không hợp lệ');
    if (p.enter !== undefined && !['pop-in', 'fade-in', 'drop-in'].includes(p.enter)) fail(where + ': prop.enter phải là pop-in|fade-in|drop-in');
    if (p.exit !== undefined && p.exit !== 'fade-out') fail(where + ': prop.exit phải là fade-out');
    if (p.motion !== undefined) {
      if (typeof p.motion === 'string') {
        if (!PROP_MOTION_PRESETS.includes(p.motion)) fail(where + ': prop.motion phải thuộc ' + PROP_MOTION_PRESETS.join('/'));
      } else if (p.motion && typeof p.motion === 'object' && !Array.isArray(p.motion)) {
        keys(p.motion, ['type', 'toX', 'toY', 'arcHeight', 'spin', 'at', 'frames', 'bounce', 'groundY', 'bounceX', 'endRotation', 'distance'], where + '.prop.motion');
        if (!PROP_MOTION_PRESETS.includes(p.motion.type)) fail(where + ': prop.motion.type phải thuộc ' + PROP_MOTION_PRESETS.join('/'));
        if (p.motion.toX !== undefined && (!Number.isFinite(p.motion.toX) || p.motion.toX < -500 || p.motion.toX > 2420)) fail(where + ': prop.motion.toX cần trong [-500, 2420]');
        if (p.motion.toY !== undefined && (!Number.isFinite(p.motion.toY) || p.motion.toY < -400 || p.motion.toY > 1480)) fail(where + ': prop.motion.toY cần trong [-400, 1480]');
        if (p.motion.arcHeight !== undefined && (!Number.isFinite(p.motion.arcHeight) || p.motion.arcHeight < -500 || p.motion.arcHeight > 500)) fail(where + ': prop.motion.arcHeight cần trong [-500, 500]');
        if (p.motion.spin !== undefined && (!Number.isFinite(p.motion.spin) || p.motion.spin < -2160 || p.motion.spin > 2160)) fail(where + ': prop.motion.spin cần trong [-2160, 2160]');
        if (p.motion.at !== undefined && (!Number.isInteger(p.motion.at) || p.motion.at < 0)) fail(where + ': prop.motion.at >= 0');
        if (p.motion.frames !== undefined && (!Number.isInteger(p.motion.frames) || p.motion.frames < 4 || p.motion.frames > 300)) fail(where + ': prop.motion.frames 4–300');
        if (p.motion.bounce !== undefined && typeof p.motion.bounce !== 'boolean') fail(where + ': prop.motion.bounce phải là boolean');
        if (p.motion.groundY !== undefined && (!Number.isFinite(p.motion.groundY) || p.motion.groundY < 200 || p.motion.groundY > 1200)) fail(where + ': prop.motion.groundY cần trong [200, 1200]');
        if (p.motion.bounceX !== undefined && (!Number.isFinite(p.motion.bounceX) || p.motion.bounceX < -1000 || p.motion.bounceX > 1000)) fail(where + ': prop.motion.bounceX cần trong [-1000, 1000]');
        if (p.motion.endRotation !== undefined && (!Number.isFinite(p.motion.endRotation) || p.motion.endRotation < -2160 || p.motion.endRotation > 2160)) fail(where + ': prop.motion.endRotation cần trong [-2160, 2160]');
        if (p.motion.distance !== undefined && (!Number.isFinite(p.motion.distance) || p.motion.distance < -1800 || p.motion.distance > 1800)) fail(where + ': prop.motion.distance cần trong [-1800, 1800]');
      } else fail(where + ': prop.motion không hợp lệ');
    }
    if (p.trail !== undefined && p.trail !== true) {
      if (typeof p.trail === 'string') {
        if (!TRAIL_COLOR_NAMES.includes(p.trail)) fail(where + ': prop.trail màu phải thuộc ' + TRAIL_COLOR_NAMES.join('/'));
      } else if (p.trail && typeof p.trail === 'object' && !Array.isArray(p.trail)) {
        keys(p.trail, ['color', 'copies', 'step'], where + '.prop.trail');
        if (p.trail.color !== undefined && !TRAIL_COLOR_NAMES.includes(p.trail.color)) fail(where + ': prop.trail.color phải thuộc ' + TRAIL_COLOR_NAMES.join('/'));
        if (p.trail.copies !== undefined && (!Number.isInteger(p.trail.copies) || p.trail.copies < 1 || p.trail.copies > 5)) fail(where + ': prop.trail.copies 1–5');
        if (p.trail.step !== undefined && (!Number.isInteger(p.trail.step) || p.trail.step < 1 || p.trail.step > 6)) fail(where + ': prop.trail.step 1–6');
      } else fail(where + ': prop.trail không hợp lệ');
    }
  }
  if (container.focus !== undefined) {
    const list = Array.isArray(container.focus) ? container.focus : [container.focus];
    if (!list.length) fail(where + ': focus rỗng');
    for (const w of list) if (!(w in plan.cast)) fail(where + ': focus "' + w + '" không có trong cast');
  }
  if (container.leave !== undefined) {
    const list = Array.isArray(container.leave) ? container.leave : [container.leave];
    for (const w of list) if (!(w in plan.cast)) fail(where + ': leave "' + w + '" không có trong cast');
  }
  if (container.leaveProps !== undefined && !Array.isArray(container.leaveProps)) fail(where + ': leaveProps phải là mảng');
  if (container.solo !== undefined && typeof container.solo !== 'boolean') fail(where + ': solo phải là boolean');
  if (container.panel !== undefined) {
    if (typeof container.panel === 'string') { if (!container.panel.trim()) fail(where + ': panel rỗng'); }
    else if (container.panel && typeof container.panel === 'object' && !Array.isArray(container.panel)) {
      keys(container.panel, ['title', 'text', 'side', 'style', 'speaker', 'variant', 'maxChars', 'chunks'], where + '.panel');
      const hasChunks = Array.isArray(container.panel.chunks) && container.panel.chunks.length > 0;
      if (!hasChunks && (typeof container.panel.text !== 'string' || !container.panel.text.trim())) fail(where + ': panel thiếu text');
      if (container.panel.chunks !== undefined && (!Array.isArray(container.panel.chunks) || !container.panel.chunks.length || container.panel.chunks.length > 16 || container.panel.chunks.some(c => typeof c !== 'string' || !c.trim()))) fail(where + ': panel.chunks cần 1–16 chuỗi');
      if (container.panel.side !== undefined && !['left', 'right', 'center'].includes(container.panel.side)) fail(where + ': panel.side left/right/center');
      if (container.panel.style !== undefined && !PANEL_STYLE_NAMES.includes(container.panel.style)) fail(where + ': panel.style ' + PANEL_STYLE_NAMES.join('/'));
      if (container.panel.speaker !== undefined && !(container.panel.speaker in plan.cast)) fail(where + ': panel.speaker "' + container.panel.speaker + '" không có trong cast');
      if (container.panel.variant !== undefined && !SPEECH_VARIANT_NAMES.includes(container.panel.variant)) fail(where + ': panel.variant phải thuộc ' + SPEECH_VARIANT_NAMES.join('/'));
      if (container.panel.maxChars !== undefined && (!Number.isInteger(container.panel.maxChars) || container.panel.maxChars < 24 || container.panel.maxChars > 140)) fail(where + ': panel.maxChars 24–140');
    } else fail(where + ': panel không hợp lệ');
  }
  for (const fx of container.fx ?? []) {
    keys(fx, ['effect', 'at', 'frames', 'placement', 'layer'], 'fx');
    if (!fx.effect) fail(where + ': fx thiếu effect');
    if (fx.layer !== undefined && !['behind', 'front'].includes(fx.layer)) fail(where + ': fx.layer behind/front');
  }
}

function validateVisualFx(container, where) {
  if (container.lines !== undefined) {
    const t = typeof container.lines === 'string' ? container.lines : container.lines?.type;
    if (!LINE_NAMES.includes(t)) fail(where + ': lines phải thuộc ' + LINE_NAMES.join('/'));
  }
  if (container.flash !== undefined && container.flash !== true) {
    const c = typeof container.flash === 'string' ? container.flash : (container.flash?.color ?? 'white');
    if (!FLASH_NAMES.includes(c)) fail(where + ': flash color phải thuộc ' + FLASH_NAMES.join('/'));
  }
  if (container.mood !== undefined) {
    const mt = typeof container.mood === 'string' ? container.mood : container.mood?.type;
    if (!MOOD_NAMES.includes(mt)) fail(where + ': mood phải thuộc ' + MOOD_NAMES.join('/'));
  }
  if (container.particles !== undefined) {
    const pt = typeof container.particles === 'string' ? container.particles : container.particles?.type;
    if (!PARTICLE_NAMES.includes(pt)) fail(where + ': particles phải thuộc ' + PARTICLE_NAMES.join('/'));
    if (typeof container.particles === 'object' && !Array.isArray(container.particles)) keys(container.particles, ['type', 'x', 'y', 'opacity'], where + '.particles');
  }
  if (container.impact !== undefined && container.impact !== true) {
    const c = typeof container.impact === 'string' ? container.impact : (container.impact?.color ?? 'white');
    if (!IMPACT_NAMES.includes(c)) fail(where + ': impact color phải thuộc ' + IMPACT_NAMES.join('/'));
  }
  if (container.lightning !== undefined && container.lightning !== true) {
    if (!container.lightning || typeof container.lightning !== 'object' || Array.isArray(container.lightning)) fail(where + ': lightning không hợp lệ');
    keys(container.lightning, ['x', 'color', 'frames'], where + '.lightning');
  }
  if (container.sfxText !== undefined) {
    if (typeof container.sfxText === 'string') { if (!container.sfxText.trim()) fail(where + ': sfxText rỗng'); }
    else if (container.sfxText && typeof container.sfxText === 'object' && !Array.isArray(container.sfxText)) {
      keys(container.sfxText, ['text', 'style', 'at', 'start', 'frames', 'rotate'], where + '.sfxText');
      if (typeof container.sfxText.text !== 'string' || !container.sfxText.text.trim()) fail(where + ': sfxText thiếu text');
      if (container.sfxText.style !== undefined && !SFX_STYLE_NAMES.includes(container.sfxText.style)) fail(where + ': sfxText.style phải thuộc ' + SFX_STYLE_NAMES.join('/'));
      if (container.sfxText.at !== undefined && !['left', 'right', 'center', 'top-left', 'top-right'].includes(container.sfxText.at)) fail(where + ': sfxText.at không hợp lệ');
    } else fail(where + ': sfxText không hợp lệ');
  }
  if (container.cutTransition !== undefined) {
    if (typeof container.cutTransition === 'string') {
      if (!CUT_TRANSITION_NAMES.includes(container.cutTransition)) fail(where + ': cutTransition phải thuộc ' + CUT_TRANSITION_NAMES.join('/'));
    } else if (container.cutTransition && typeof container.cutTransition === 'object' && !Array.isArray(container.cutTransition)) {
      keys(container.cutTransition, ['type', 'frames', 'color'], where + '.cutTransition');
      if (!CUT_TRANSITION_NAMES.includes(container.cutTransition.type)) fail(where + ': cutTransition.type phải thuộc ' + CUT_TRANSITION_NAMES.join('/'));
      if (container.cutTransition.frames !== undefined && (!Number.isInteger(container.cutTransition.frames) || container.cutTransition.frames < 3 || container.cutTransition.frames > 60)) fail(where + ': cutTransition.frames 3–60');
    } else fail(where + ': cutTransition không hợp lệ');
  }
  if (container.filmBurn !== undefined && container.filmBurn !== true) {
    if (typeof container.filmBurn === 'string') {
      if (!FILM_BURN_NAMES.includes(container.filmBurn)) fail(where + ': filmBurn phải thuộc ' + FILM_BURN_NAMES.join('/'));
    } else if (container.filmBurn && typeof container.filmBurn === 'object' && !Array.isArray(container.filmBurn)) {
      keys(container.filmBurn, ['preset', 'opacity'], where + '.filmBurn');
      if (container.filmBurn.preset !== undefined && !FILM_BURN_NAMES.includes(container.filmBurn.preset)) fail(where + ': filmBurn.preset phải thuộc ' + FILM_BURN_NAMES.join('/'));
      if (container.filmBurn.opacity !== undefined && (!Number.isFinite(container.filmBurn.opacity) || container.filmBurn.opacity <= 0 || container.filmBurn.opacity > 1)) fail(where + ': filmBurn.opacity (0, 1]');
    } else fail(where + ': filmBurn không hợp lệ');
  }
  if (container.halftone !== undefined && container.halftone !== true) {
    if (!container.halftone || typeof container.halftone !== 'object' || Array.isArray(container.halftone)) fail(where + ': halftone không hợp lệ');
    keys(container.halftone, ['opacity'], where + '.halftone');
    if (container.halftone.opacity !== undefined && (!Number.isFinite(container.halftone.opacity) || container.halftone.opacity <= 0 || container.halftone.opacity > 1)) fail(where + ': halftone.opacity (0, 1]');
  }
  if (container.letterbox !== undefined && container.letterbox !== true) {
    if (!container.letterbox || typeof container.letterbox !== 'object' || Array.isArray(container.letterbox)) fail(where + ': letterbox không hợp lệ');
    keys(container.letterbox, ['height'], where + '.letterbox');
    if (container.letterbox.height !== undefined && (!Number.isFinite(container.letterbox.height) || container.letterbox.height <= 0 || container.letterbox.height > 20)) fail(where + ': letterbox.height (0, 20]');
  }
  if (container.portalGlow !== undefined && container.portalGlow !== true) {
    if (!container.portalGlow || typeof container.portalGlow !== 'object' || Array.isArray(container.portalGlow)) fail(where + ': portalGlow không hợp lệ');
    keys(container.portalGlow, ['x', 'y', 'color', 'size', 'opacity'], where + '.portalGlow');
  }
  if (container.dof !== undefined && container.dof !== true && !['soft', 'strong'].includes(container.dof)) {
    if (!container.dof || typeof container.dof !== 'object' || Array.isArray(container.dof)) fail(where + ': dof phải là true/soft/strong hoặc object');
    keys(container.dof, ['blur', 'dim', 'shadow'], where + '.dof');
    if (container.dof.blur !== undefined && (!Number.isFinite(container.dof.blur) || container.dof.blur < 0 || container.dof.blur > 20)) fail(where + ': dof.blur [0, 20]');
  }
  if (container.sfx !== undefined) {
    const checkOne = (item, w) => {
      if (typeof item === 'string') { if (!SFX_PRESET_NAMES.includes(item)) fail(w + ': sfx phải thuộc ' + SFX_PRESET_NAMES.join('/')); return; }
      if (!item || typeof item !== 'object' || Array.isArray(item)) fail(w + ': sfx không hợp lệ');
      keys(item, ['preset', 'at', 'volume'], w);
      if (!SFX_PRESET_NAMES.includes(item.preset)) fail(w + ': sfx.preset phải thuộc ' + SFX_PRESET_NAMES.join('/'));
      if (item.at !== undefined && (!Number.isInteger(item.at) || item.at < 0)) fail(w + ': sfx.at >= 0');
      if (item.volume !== undefined && (!Number.isFinite(item.volume) || item.volume <= 0 || item.volume > 1.5)) fail(w + ': sfx.volume (0, 1.5]');
    };
    if (Array.isArray(container.sfx)) {
      if (!container.sfx.length || container.sfx.length > 4) fail(where + ': sfx[] cần 1–4 item');
      container.sfx.forEach((it, idx) => checkOne(it, `${where}.sfx[${idx}]`));
    } else checkOne(container.sfx, where + '.sfx');
  }
  if (container.impactFrame !== undefined && container.impactFrame !== true) {
    if (typeof container.impactFrame === 'string') {
      if (!IMPACT_FRAME_NAMES.includes(container.impactFrame)) fail(where + ': impactFrame phải thuộc ' + IMPACT_FRAME_NAMES.join('/'));
    } else if (container.impactFrame && typeof container.impactFrame === 'object' && !Array.isArray(container.impactFrame)) {
      keys(container.impactFrame, ['at', 'frames', 'style'], where + '.impactFrame');
      if (container.impactFrame.style !== undefined && !IMPACT_FRAME_NAMES.includes(container.impactFrame.style)) fail(where + ': impactFrame.style ' + IMPACT_FRAME_NAMES.join('/'));
      if (container.impactFrame.frames !== undefined && (!Number.isInteger(container.impactFrame.frames) || container.impactFrame.frames < 1 || container.impactFrame.frames > 6)) fail(where + ': impactFrame.frames 1–6');
      if (container.impactFrame.at !== undefined && (!Number.isInteger(container.impactFrame.at) || container.impactFrame.at < 0)) fail(where + ': impactFrame.at >= 0');
    } else fail(where + ': impactFrame không hợp lệ');
  }
  if (container.lighting !== undefined) {
    if (typeof container.lighting === 'string') {
      if (!LIGHTING_NAMES.includes(container.lighting)) fail(where + ': lighting phải thuộc ' + LIGHTING_NAMES.join('/'));
    } else if (container.lighting && typeof container.lighting === 'object' && !Array.isArray(container.lighting)) {
      keys(container.lighting, ['type', 'x', 'y', 'radius', 'color', 'intensity', 'darkness'], where + '.lighting');
      if (!LIGHTING_NAMES.includes(container.lighting.type)) fail(where + ': lighting.type phải thuộc ' + LIGHTING_NAMES.join('/'));
      if (container.lighting.intensity !== undefined && (!Number.isFinite(container.lighting.intensity) || container.lighting.intensity <= 0 || container.lighting.intensity > 2)) fail(where + ': lighting.intensity (0, 2]');
      if (container.lighting.darkness !== undefined && (!Number.isFinite(container.lighting.darkness) || container.lighting.darkness < 0 || container.lighting.darkness > 1)) fail(where + ': lighting.darkness [0, 1]');
    } else fail(where + ': lighting không hợp lệ');
  }
  if (container.splitPanel !== undefined && container.splitPanel !== true) {
    if (!container.splitPanel || typeof container.splitPanel !== 'object' || Array.isArray(container.splitPanel)) fail(where + ': splitPanel không hợp lệ');
    keys(container.splitPanel, ['slant', 'gutter', 'leftTint', 'rightTint', 'borderColor', 'accentColor'], where + '.splitPanel');
    if (container.splitPanel.slant !== undefined && (!Number.isFinite(container.splitPanel.slant) || container.splitPanel.slant < 0 || container.splitPanel.slant > 20)) fail(where + ': splitPanel.slant [0, 20]');
    if (container.splitPanel.gutter !== undefined && (!Number.isFinite(container.splitPanel.gutter) || container.splitPanel.gutter < 4 || container.splitPanel.gutter > 30)) fail(where + ': splitPanel.gutter [4, 30]');
  }
}

export function validatePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) || plan.version !== PLAN_VERSION) fail('cần version ' + PLAN_VERSION);
  keys(plan, ['version', 'id', 'title', 'location', 'cast', 'transitions', 'timing', 'camera', 'bgm', 'captionStyle', 'persistStage', 'beats'], 'kế hoạch');
  if (!id.test(plan.id ?? '')) fail('id không hợp lệ');
  if (plan.persistStage !== undefined && typeof plan.persistStage !== 'boolean') fail('persistStage phải là boolean');
  if (plan.captionStyle !== undefined && !CAPTION_STYLE_NAMES.includes(plan.captionStyle)) fail('captionStyle phải thuộc ' + CAPTION_STYLE_NAMES.join('/'));
  if (!plan.location?.asset) fail('thiếu location.asset'); keys(plan.location, ['asset', 'item'], 'location');
  if (plan.timing !== undefined) {
    if (!plan.timing || typeof plan.timing !== 'object' || Array.isArray(plan.timing)) fail('timing không hợp lệ');
    keys(plan.timing, ['mode', 'voiceId', 'padFrames', 'fps'], 'timing');
    if (plan.timing.mode !== undefined && !['draft', 'auto-tts'].includes(plan.timing.mode)) fail('timing.mode phải là draft hoặc auto-tts');
    if (plan.timing.padFrames !== undefined && (!Number.isInteger(plan.timing.padFrames) || plan.timing.padFrames < 0 || plan.timing.padFrames > 120)) fail('timing.padFrames 0–120');
  }
  parseCamera(plan.camera, 'kế hoạch');
  if (plan.bgm !== undefined) {
    if (typeof plan.bgm === 'string') {
      if (!BGM_PRESET_NAMES.includes(plan.bgm)) fail('bgm phải thuộc ' + BGM_PRESET_NAMES.join('/'));
    } else if (plan.bgm && typeof plan.bgm === 'object' && !Array.isArray(plan.bgm)) {
      keys(plan.bgm, ['preset', 'volume', 'duckVolume', 'fadeIn', 'fadeOut'], 'bgm');
      if (!BGM_PRESET_NAMES.includes(plan.bgm.preset)) fail('bgm.preset phải thuộc ' + BGM_PRESET_NAMES.join('/'));
      if (plan.bgm.volume !== undefined && (!Number.isFinite(plan.bgm.volume) || plan.bgm.volume < 0 || plan.bgm.volume > 1)) fail('bgm.volume [0, 1]');
      if (plan.bgm.duckVolume !== undefined && (!Number.isFinite(plan.bgm.duckVolume) || plan.bgm.duckVolume < 0 || plan.bgm.duckVolume > 1)) fail('bgm.duckVolume [0, 1]');
      if (plan.bgm.fadeIn !== undefined && (!Number.isInteger(plan.bgm.fadeIn) || plan.bgm.fadeIn < 0 || plan.bgm.fadeIn > 180)) fail('bgm.fadeIn 0–180');
      if (plan.bgm.fadeOut !== undefined && (!Number.isInteger(plan.bgm.fadeOut) || plan.bgm.fadeOut < 0 || plan.bgm.fadeOut > 180)) fail('bgm.fadeOut 0–180');
    } else fail('bgm không hợp lệ');
  }
  if (!plan.cast || typeof plan.cast !== 'object' || Array.isArray(plan.cast)) fail('thiếu cast');
  for (const [alias, c] of Object.entries(plan.cast)) { if (!id.test(alias) || !c?.asset) fail('cast.' + alias + ' cần asset'); keys(c, ['asset', 'faceStyle', 'scale', 'name', 'color'], 'cast.' + alias); if (c.faceStyle !== undefined && !['bean', 'detailed', 'generic'].includes(c.faceStyle)) fail('cast.' + alias + '.faceStyle không hợp lệ'); if (c.scale !== undefined && (!Number.isFinite(c.scale) || c.scale < 0.4 || c.scale > 2.0)) fail('cast.' + alias + '.scale cần trong [0.4, 2.0]'); if (c.name !== undefined && (typeof c.name !== 'string' || !c.name.trim())) fail('cast.' + alias + '.name không hợp lệ'); if (c.color !== undefined && typeof c.color !== 'string') fail('cast.' + alias + '.color không hợp lệ'); }
  if (!Array.isArray(plan.beats) || !plan.beats.length || plan.beats.length > 60) fail('cần 1–60 beat');
  const seen = new Set();
  const timingMode = plan.timing?.mode;
  for (const beat of plan.beats) {
    keys(beat, ['id', 'quote', 'frames', 'shot', 'framing', 'angle', 'speaker', 'speech', 'action', 'before', 'after', 'location', 'actors', 'props', 'panel', 'fx', 'shake', 'cameraShake', 'lines', 'flash', 'mood', 'particles', 'impact', 'lightning', 'sfxText', 'camera', 'cuts', 'sfx', 'cutTransition', 'filmBurn', 'halftone', 'letterbox', 'portalGlow', 'dof', 'impactFrame', 'lighting', 'splitPanel', 'highlightColor', 'focus', 'solo', 'leave', 'leaveProps'], 'beat');
    if (beat.framing !== undefined && !['full', 'bust', 'portrait'].includes(beat.framing)) fail('beat ' + beat.id + ': framing phải là full, bust hoặc portrait');
    if (!id.test(beat.id ?? '') || seen.has(beat.id)) fail('beat id trùng/không hợp lệ: ' + beat.id); seen.add(beat.id);
    if (typeof beat.quote !== 'string' || !beat.quote.trim()) fail('beat ' + beat.id + ' thiếu quote');
    if (beat.highlightColor !== undefined && typeof beat.highlightColor !== 'string') fail('beat ' + beat.id + ': highlightColor không hợp lệ');
    if (beat.frames !== undefined || !timingMode) {
      if (!Number.isInteger(beat.frames) || beat.frames < 6 || beat.frames > 3600) fail('beat ' + beat.id + ': frames 6–3600');
    }
    if (beat.shot !== undefined && !(beat.shot in DEFAULT_STAGE.shots)) fail('beat ' + beat.id + ': shot ' + Object.keys(DEFAULT_STAGE.shots).join('/'));
    if (beat.location !== undefined) {
      if (!beat.location?.asset) fail('beat ' + beat.id + ': location thiếu asset');
      keys(beat.location, ['asset', 'item'], 'beat ' + beat.id + '.location');
    }
    validateVisualFx(beat, 'beat ' + beat.id);
    parseCamera(beat.camera, 'beat ' + beat.id);
    validateActorsAndFx(beat, plan, 'beat ' + beat.id);
    if (beat.cuts !== undefined) {
      if (!Array.isArray(beat.cuts) || !beat.cuts.length || beat.cuts.length > 8) fail('beat ' + beat.id + ': cuts cần 1–8 nhịp hình');
      beat.cuts.forEach((cut, ci) => {
        const where = `beat ${beat.id}.cuts[${ci}]`;
        keys(cut, ['ratio', 'shot', 'framing', 'angle', 'speaker', 'speech', 'location', 'camera', 'cameraShake', 'lines', 'flash', 'mood', 'particles', 'impact', 'lightning', 'sfxText', 'shake', 'actors', 'props', 'panel', 'fx', 'sfx', 'cutTransition', 'filmBurn', 'halftone', 'letterbox', 'portalGlow', 'dof', 'impactFrame', 'lighting', 'splitPanel', 'focus', 'solo', 'leave', 'leaveProps'], 'cut');
        if (cut.framing !== undefined && !['full', 'bust', 'portrait'].includes(cut.framing)) fail(where + ': framing phải là full, bust hoặc portrait');
        if (cut.ratio !== undefined && (!Number.isFinite(cut.ratio) || cut.ratio <= 0)) fail(where + ': ratio phải > 0');
        if (cut.shot !== undefined && !(cut.shot in DEFAULT_STAGE.shots)) fail(where + ': shot ' + Object.keys(DEFAULT_STAGE.shots).join('/'));
        if (cut.location !== undefined) { if (!cut.location?.asset) fail(where + ': location thiếu asset'); keys(cut.location, ['asset', 'item'], where + '.location'); }
        validateVisualFx(cut, where);
        parseCamera(cut.camera, where);
        validateActorsAndFx(cut, plan, where);
      });
    }
  }
  return plan;
}

const norm = text => String(text ?? '').normalize('NFC').trim().toLowerCase();
function findAsset(catalog, ref, types, label) {
  const matches = catalog.filter(a => types.includes(a.type) && (a.id === ref || norm(a.name) === norm(ref)));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) fail(label + ' "' + ref + '" khớp ' + matches.length + ' asset; dùng id: ' + matches.map(a => a.id).join(', '));
  const near = catalog.filter(a => types.includes(a.type) && norm(a.name).includes(norm(ref))).slice(0, 6).map(a => a.name);
  fail(label + ' "' + ref + '" không có trong catalog' + (near.length ? '. Gần giống: ' + near.join(' | ') : ''));
}
function pick(list, ref, label, assetName, translations) {
  const { item, ambiguous } = matchCatalogItem(list, ref, { translations });
  if (item) return item;
  if (ambiguous.length) fail(label + ' "' + ref + '" khớp nhiều mục trong ' + assetName + ': ' + ambiguous.slice(0, 12).map(i => i.name).join(' | ') + ' (chọn tên cụ thể hoặc số ô)');
  fail(label + ' "' + ref + '" không có trong ' + assetName + '. Có: ' + list.slice(0, 40).map((i, n) => (n + 1) + ':' + i.name).join(' ') + (list.length > 40 ? ' …' : ''));
}

/** Expand a beat into 1..N visual cuts whose frames sum strictly to beat.frames. */
function expandBeatCuts(beat) {
  if (!beat.cuts?.length) {
    return [{
      index: 0, frames: beat.frames,
      shot: beat.shot, framing: beat.framing, angle: beat.angle, speaker: beat.speaker, speech: beat.speech, location: beat.location, camera: beat.camera, cameraShake: beat.cameraShake,
      lines: beat.lines, flash: beat.flash, mood: beat.mood, particles: beat.particles, impact: beat.impact, lightning: beat.lightning, sfxText: beat.sfxText, shake: beat.shake,
      cutTransition: beat.cutTransition, filmBurn: beat.filmBurn, halftone: beat.halftone, letterbox: beat.letterbox, portalGlow: beat.portalGlow, dof: beat.dof, sfx: beat.sfx,
      impactFrame: beat.impactFrame, lighting: beat.lighting, splitPanel: beat.splitPanel,
      focus: beat.focus, solo: beat.solo, leave: beat.leave, leaveProps: beat.leaveProps,
      actors: beat.actors ?? [], props: beat.props ?? [], panel: beat.panel, fx: beat.fx ?? [],
    }];
  }
  const weights = beat.cuts.map(c => c.ratio ?? 1), sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map(w => Math.max(6, Math.round(beat.frames * (w / sum))));
  let diff = beat.frames - raw.reduce((a, b) => a + b, 0);
  raw[raw.length - 1] = Math.max(6, raw[raw.length - 1] + diff);
  const hasCutSpeech = beat.cuts.some(c => c.speech !== undefined);
  const beatSpeaker = beat.speaker ?? (typeof beat.speech === 'object' ? beat.speech?.who : undefined);
  return beat.cuts.map((c, i) => ({
    index: i, frames: raw[i],
    shot: c.shot ?? beat.shot, framing: c.framing ?? beat.framing, angle: c.angle ?? beat.angle,
    speaker: c.speaker ?? (hasCutSpeech ? (i === 0 ? beatSpeaker : undefined) : beatSpeaker),
    speech: (!hasCutSpeech && beat.speech !== undefined) ? undefined : c.speech,
    location: c.location ?? beat.location, camera: c.camera ?? beat.camera,
    cameraShake: c.cameraShake ?? (i === 0 ? beat.cameraShake : undefined),
    lines: c.lines, flash: c.flash, mood: c.mood ?? beat.mood, particles: c.particles, impact: c.impact, lightning: c.lightning, sfxText: c.sfxText, shake: c.shake,
    cutTransition: c.cutTransition, filmBurn: c.filmBurn ?? beat.filmBurn, halftone: c.halftone ?? beat.halftone, letterbox: c.letterbox ?? beat.letterbox, portalGlow: c.portalGlow, dof: c.dof ?? beat.dof, sfx: c.sfx ?? (i === 0 ? beat.sfx : undefined),
    impactFrame: c.impactFrame ?? (i === 0 ? beat.impactFrame : undefined), lighting: c.lighting ?? beat.lighting, splitPanel: c.splitPanel,
    focus: c.focus ?? beat.focus, solo: c.solo ?? beat.solo, leave: c.leave ?? (i === 0 ? beat.leave : undefined), leaveProps: c.leaveProps ?? (i === 0 ? beat.leaveProps : undefined),
    actors: c.actors ?? [], props: c.props ?? [], panel: c.panel ?? (i === 0 ? beat.panel : undefined), fx: c.fx ?? [],
  }));
}

/** Phase 1: resolve every name to catalog ids. Returns the prepare requests plus per-actor choices. */
export function resolvePlan(plan, catalog, { translations = loadTranslations() } = {}) {
  validatePlan(plan);
  const requests = {}, uses = [];
  const resolveBg = (loc, label) => {
    const asset = findAsset(catalog, loc.asset, ['backgrounds'], label), group = Object.keys(asset.groups).find(k => asset.groups[k].length);
    const bgItem = loc.item !== undefined ? pick(asset.groups[group], loc.item, 'item nền', asset.name, translations) : asset.groups[group][0];
    return { asset, item: bgItem };
  };
  const rootBg = resolveBg(plan.location, 'location');
  requests.bg = { catalogId: rootBg.asset.id, itemIds: [rootBg.item.id] };
  const bgMap = new Map([[`${rootBg.asset.id}:${rootBg.item.id}`, { key: 'bg', name: rootBg.asset.name }]]);
  const cutLocations = [];
  const cast = {};
  for (const [alias, c] of Object.entries(plan.cast)) {
    const asset = findAsset(catalog, c.asset, ['characters'], 'cast.' + alias), styles = [...new Set((asset.groups.faces ?? []).map(f => f.style).filter(Boolean))];
    if (styles.length > 1 && !c.faceStyle) fail('cast.' + alias + ' (' + asset.name + ') có 2 kiểu mặt (' + styles.join('/') + '): chọn faceStyle và giữ cả tập');
    cast[alias] = { asset, style: c.faceStyle ?? styles[0] };
    if (c.faceStyle && styles.length && !styles.includes(c.faceStyle)) fail('cast.' + alias + ': ' + asset.name + ' không có kiểu mặt ' + c.faceStyle + ' (có ' + styles.join('/') + ')');
  }
  const pairs = new Map(), effects = {}, props = new Map(), propUses = [];
  plan.beats.forEach((beat, bi) => {
    const cuts = expandBeatCuts(beat);
    cuts.forEach((cut, ci) => {
      if (cut.location) {
        const bbg = resolveBg(cut.location, `beat ${beat.id}.location`);
        const sig = `${bbg.asset.id}:${bbg.item.id}`;
        if (!bgMap.has(sig)) { const key = 'bg' + bgMap.size; bgMap.set(sig, { key, name: bbg.asset.name }); requests[key] = { catalogId: bbg.asset.id, itemIds: [bbg.item.id] }; }
        cutLocations.push({ beat: bi, cut: ci, ...bgMap.get(sig) });
      } else {
        cutLocations.push({ beat: bi, cut: ci, key: 'bg', name: rootBg.asset.name });
      }
      for (const actor of cut.actors ?? []) {
        const { asset, style } = cast[actor.who], pose = pick(asset.groups.poses ?? [], actor.pose, 'pose ' + actor.pose, asset.name, translations);
        let face = null; if (actor.face !== undefined) {
          const all = asset.groups.faces ?? [], numeric = /^\d+$/.test(String(actor.face));
          face = pick(numeric ? all : all.filter(f => !style || f.style === style), actor.face, 'mặt ' + actor.face + (style ? ' (' + style + ')' : ''), asset.name, translations);
          if (style && face.style && face.style !== style) fail('mặt ' + actor.face + ' của ' + actor.who + ' thuộc kiểu ' + face.style + ' nhưng cast chọn ' + style + ' (số ô trên tờ ảnh là vị trí trong cả nhóm mặt)');
        }
        const key = 'c' + pairs.size, hit = [...pairs].find(([, v]) => v.catalogId === asset.id && v.itemIds.join() === [pose.id, face?.id].filter(Boolean).join());
        const useKey = hit ? hit[0] : key; if (!hit) { pairs.set(key, { catalogId: asset.id, itemIds: [pose.id, face?.id].filter(Boolean) }); requests[key] = pairs.get(key); }
        uses.push({ beat: bi, cut: ci, who: actor.who, key: useKey, pose: pose.name, face: face?.name ?? null, asset: asset.name });
      }
      (cut.props ?? []).forEach((p, pi) => {
        const asset = findAsset(catalog, p.prop, ['props'], 'prop');
        const group = Object.keys(asset.groups).find(k => asset.groups[k].length);
        const propItem = p.item !== undefined ? pick(asset.groups[group], p.item, 'item prop', asset.name, translations) : asset.groups[group][0];
        const sig = `${asset.id}:${propItem.id}`;
        let key = props.get(sig);
        if (!key) { key = 'p' + props.size; props.set(sig, key); requests[key] = { catalogId: asset.id, itemIds: [propItem.id] }; }
        propUses.push({ beat: bi, cut: ci, index: pi, key, name: asset.name });
      });
      for (const fx of cut.fx ?? []) {
        if (!effects[fx.effect]) { const asset = findAsset(catalog, fx.effect, ['effects'], 'effect'), key = 'fx' + Object.keys(effects).length; effects[fx.effect] = key; requests[key] = { catalogId: asset.id, itemIds: [asset.groups.props[0].id] }; }
      }
    });
  });
  return { requests, uses, propUses, effects, location: rootBg.asset.name, cutLocations };
}

function cameraSpan(spec, from, to, offset = null) {
  const k = spec.intensity ?? 1, endFrame = Math.max(from, to - 1), snap = Math.min(endFrame, from + 8);
  let a = { x: 0, y: 0, scale: 1 }, b = { x: 0, y: 0, scale: 1 }, midKeys = [];
  if (spec.type === 'push-in') { a = { x: 0, y: 0, scale: 1 }; b = { x: 0, y: 0, scale: Math.min(1.5, 1 + 0.08 * k) }; }
  else if (spec.type === 'pull-out') { a = { x: 0, y: 0, scale: Math.min(1.5, 1 + 0.08 * k) }; b = { x: 0, y: 0, scale: 1 }; }
  else if (spec.type === 'pan-left') { a = { x: 0, y: 0, scale: Math.min(1.5, 1 + 0.06 * k) }; b = { x: -90 * k, y: 0, scale: Math.min(1.5, 1 + 0.06 * k) }; }
  else if (spec.type === 'pan-right') { a = { x: 0, y: 0, scale: Math.min(1.5, 1 + 0.06 * k) }; b = { x: 90 * k, y: 0, scale: Math.min(1.5, 1 + 0.06 * k) }; }
  else if (spec.type === 'drift') { a = { x: -18 * k, y: 0, scale: Math.min(1.5, 1 + 0.02 * k) }; b = { x: 18 * k, y: 0, scale: Math.min(1.5, 1 + 0.05 * k) }; }
  else if (spec.type === 'zoom-punch') {
    a = { x: 0, y: 0, scale: 1 }; b = { x: 0, y: 0, scale: Math.min(1.5, +(1 + 0.10 * k).toFixed(4)) };
    if (snap > from && snap < endFrame) midKeys = [{ frame: snap, x: 0, y: 0, scale: Math.min(1.5, +(1 + 0.15 * k).toFixed(4)), easing: 'ease-out' }];
  } else if (spec.type === 'whip-left' || spec.type === 'whip-right') {
    const dir = spec.type === 'whip-left' ? -1 : 1;
    a = { x: Math.round(-dir * 140 * k), y: 0, scale: 1.08 };
    b = { x: Math.round(dir * 85 * k), y: 0, scale: 1.05 };
    if (snap > from && snap < endFrame) midKeys = [{ frame: snap, x: Math.round(dir * 55 * k), y: 0, scale: 1.06, easing: 'ease-out' }];
  }
  const ox = offset?.x ?? 0, oy = offset?.y ?? 0, os = offset?.scale ?? 1;
  if (!ox && !oy && os === 1) return { from, endFrame, a, b, midKeys };
  const combine = pt => {
    const s = Math.min(1.6, Math.max(1, +(pt.scale * os).toFixed(4)));
    const maxX = Math.floor(960 * (s - 1) * 0.90);
    const maxY = Math.floor(540 * (s - 1) * 0.90);
    return {
      ...(pt.frame !== undefined ? { frame: pt.frame } : {}),
      x: Math.max(-maxX, Math.min(maxX, Math.round(pt.x + ox))),
      y: Math.max(-maxY, Math.min(maxY, Math.round(pt.y + oy))),
      scale: s,
      ...(pt.easing ? { easing: pt.easing } : {}),
    };
  };
  return { from, endFrame, a: combine(a), b: combine(b), midKeys: midKeys.map(combine) };
}

function applyActorMotion(layer, motion, from, to, flipX, actorX) {
  if (!motion || motion === 'none' || to - from < 6) return;
  const spec = typeof motion === 'string' ? { type: motion } : motion;
  const type = spec.type;
  if (!type || type === 'none') return;
  const bx = layer.base?.x ?? 0, by = layer.base?.y ?? 0, bs = layer.base?.scale ?? 1, brot = layer.base?.rotation ?? 0;
  layer.keys ??= {};
  const setKeys = (field, points) => {
    const map = new Map((layer.keys[field] ?? []).map(k => [k.frame, k]));
    for (const p of points) if (p.frame >= from && p.frame < to) map.set(p.frame, p);
    layer.keys[field] = [...map.values()].sort((a, b) => a.frame - b.frame);
  };
  const end = to - 1;
  const at = from + Math.min(spec.at ?? 0, Math.max(0, to - from - 5));
  const dur = Math.min(spec.frames ?? 14, Math.max(4, end - at));
  const fin = Math.min(end, at + dur);

  if (type === 'dash-left' || type === 'dash-right') {
    const dir = type === 'dash-left' ? -1 : 1, dist = spec.distance ?? 220;
    setKeys('x', [{ frame: at, value: bx, easing: 'smooth' }, { frame: fin, value: bx + dir * dist, easing: 'smooth' }]);
    setKeys('rotation', [{ frame: at, value: brot, easing: 'smooth' }, { frame: Math.min(end, at + 4), value: brot + dir * 7, easing: 'smooth' }, { frame: fin, value: brot, easing: 'smooth' }]);
  } else if (type === 'slide-in-left' || type === 'slide-in-right') {
    const dir = type === 'slide-in-left' ? -1 : 1, dist = spec.distance ?? 380;
    setKeys('x', [{ frame: from, value: bx + dir * dist, easing: 'smooth' }, { frame: Math.min(end, from + (spec.frames ?? 12)), value: bx, easing: 'smooth' }]);
  } else if (type === 'step-in') {
    const dir = actorX < 960 ? 1 : actorX > 960 ? -1 : (flipX ? -1 : 1), dist = spec.distance ?? 95;
    setKeys('x', [{ frame: at, value: bx, easing: 'smooth' }, { frame: Math.min(end, at + (spec.frames ?? 18)), value: bx + dir * dist, easing: 'smooth' }]);
    setKeys('scale', [{ frame: at, value: bs, easing: 'smooth' }, { frame: Math.min(end, at + (spec.frames ?? 18)), value: +(bs * 1.06).toFixed(4), easing: 'smooth' }]);
  } else if (type === 'recoil') {
    const dir = actorX < 960 ? -1 : 1, dist = spec.distance ?? 110;
    setKeys('x', [{ frame: at, value: bx, easing: 'smooth' }, { frame: Math.min(end, at + (spec.frames ?? 10)), value: bx + dir * dist, easing: 'smooth' }]);
    setKeys('rotation', [{ frame: at, value: brot, easing: 'smooth' }, { frame: Math.min(end, at + 5), value: brot + dir * 6, easing: 'smooth' }, { frame: Math.min(end, at + 12), value: brot, easing: 'smooth' }]);
  } else if (type === 'run-left' || type === 'run-right') {
    const dir = type === 'run-left' ? -1 : 1, dist = spec.distance ?? 320;
    setKeys('x', [{ frame: from, value: bx - dir * Math.round(dist * 0.35), easing: 'linear' }, { frame: end, value: bx + dir * Math.round(dist * 0.65), easing: 'linear' }]);
    const yPts = [];
    for (let f = from, step = 0; f <= end; f += 8, step++) { yPts.push({ frame: f, value: by - (step % 2 === 0 ? 0 : 8), easing: 'smooth' }); }
    setKeys('y', yPts);
  } else if (type === 'bob') {
    const amp = spec.distance ?? 3, yPts = [];
    for (let f = from, step = 0; f <= end; f += 18, step++) { yPts.push({ frame: f, value: by - (step % 2 === 0 ? 0 : amp), easing: 'smooth' }); }
    setKeys('y', yPts);
  } else if (type === 'breathe') {
    const amp = spec.distance ?? 1, yPts = [], sPts = [];
    for (let f = from, step = 0; f <= end; f += 18, step++) {
      const w = Math.sin(step * Math.PI * 0.5);
      yPts.push({ frame: f, value: Math.round(by - Math.max(0, w) * amp), easing: 'smooth' });
      sPts.push({ frame: f, value: +(bs * (1 + Math.max(0, w) * 0.004)).toFixed(4), easing: 'smooth' });
    }
    setKeys('y', yPts); setKeys('scale', sPts);
  } else if (type === 'float') {
    const amp = spec.distance ?? 12, yPts = [], rPts = [];
    for (let f = from, step = 0; f <= end; f += 12, step++) {
      const w = Math.sin(step * Math.PI * 0.5);
      yPts.push({ frame: f, value: Math.round(by - w * amp), easing: 'smooth' });
      rPts.push({ frame: f, value: +(brot + w * 2.5).toFixed(2), easing: 'smooth' });
    }
    setKeys('y', yPts); setKeys('rotation', rPts);
  } else if (type === 'talk' || type === 'talk-excited') {
    const excited = type === 'talk-excited';
    const stepF = excited ? 4 : 6, cycleLen = excited ? 7 : 6, activeCount = excited ? 5 : 4;
    const jump = spec.distance ?? (excited ? 9 : 5);
    const scaleBoost = excited ? 0.032 : 0.016, tiltMax = excited ? 2.2 : 1.1;
    const yPts = [], sPts = [], rPts = [];
    for (let f = from, step = 0; f <= end; f += stepF, step++) {
      const ph = step % cycleLen;
      const peak = ph < activeCount && step % 2 === 1;
      const alt = step % 4 === 1 ? 1 : -1;
      yPts.push({ frame: f, value: Math.round(by - (peak ? jump : 0)), easing: 'smooth' });
      sPts.push({ frame: f, value: +(bs * (peak ? 1 + scaleBoost : 1)).toFixed(4), easing: 'smooth' });
      rPts.push({ frame: f, value: +(brot + (peak ? alt * tiltMax : 0)).toFixed(2), easing: 'smooth' });
    }
    if (yPts.length && yPts.at(-1).frame < end) {
      yPts.push({ frame: end, value: Math.round(by), easing: 'smooth' });
      sPts.push({ frame: end, value: bs, easing: 'smooth' });
      rPts.push({ frame: end, value: brot, easing: 'smooth' });
    }
    setKeys('y', yPts); setKeys('scale', sPts); setKeys('rotation', rPts);
  }
}

function applyPropEnter(layer, { type, from, to, finalY }) {
  if (type !== 'drop-in' || to - from < 8) return;
  const by = layer.base?.y ?? 0;
  const bs = layer.base?.scale ?? 1;
  const end = to - 1;
  layer.keys ??= {};
  const setKeys = (field, points) => {
    const map = new Map((layer.keys[field] ?? []).map(k => [k.frame, k]));
    for (const p of points) if (p.frame >= from && p.frame < to) map.set(p.frame, p);
    layer.keys[field] = [...map.values()].sort((a, b) => a.frame - b.frame);
  };
  // Start completely off the top edge of the 1920x1080 frame
  const dropDist = Math.max(760, Math.round((finalY ?? 900) + 160));
  if ((finalY ?? 900) < 780) {
    // Mid-air sky descent (e.g. descending overhead before landing): smooth drop into sky + gentle continued fall
    const arriveDur = Math.min(20, Math.max(8, Math.floor((to - from) * 0.36)));
    const arrive = Math.min(end, from + arriveDur);
    const pts = [
      { frame: from, value: Math.round(by - dropDist), easing: 'ease-out' },
      { frame: arrive, value: Math.round(by - 28), easing: 'linear' },
    ];
    if (end > arrive) pts.push({ frame: end, value: Math.round(by + 36), easing: 'linear' });
    setKeys('y', pts);
  } else {
    // Heavy ground/rooftop slam: accelerating gravity fall + brief landing impact squash/settle
    const dropDur = Math.min(12, Math.max(6, Math.floor((to - from) * 0.22)));
    const land = Math.min(end, from + dropDur);
    const settle = Math.min(end, land + 4);
    const yPts = [{ frame: from, value: Math.round(by - dropDist), easing: 'ease-in' }];
    if (settle > land) {
      yPts.push({ frame: land, value: Math.round(by + 16), easing: 'ease-out' });
      yPts.push({ frame: settle, value: Math.round(by), easing: 'smooth' });
    } else {
      yPts.push({ frame: land, value: Math.round(by), easing: 'ease-out' });
    }
    setKeys('y', yPts);
    if (settle > land && bs > 0.05) {
      const preLand = Math.max(from + 1, land - 1);
      setKeys('scale', [
        { frame: from, value: bs, easing: 'hold' },
        { frame: preLand, value: bs, easing: 'linear' },
        { frame: land, value: +(bs * 1.045).toFixed(4), easing: 'ease-out' },
        { frame: settle, value: bs, easing: 'smooth' },
      ]);
    }
  }
}

function applyPropMotion(layer, motion, from, to, startX, startY, defaultGroundY) {
  if (!motion || motion === 'none' || to - from < 6) return;
  const spec = typeof motion === 'string' ? { type: motion } : motion;
  const type = spec.type;
  if (!type || type === 'none') return;
  const bx = layer.base?.x ?? 0, by = layer.base?.y ?? 0, brot = layer.base?.rotation ?? 0;
  layer.keys ??= {};
  const setKeys = (field, points) => {
    const map = new Map((layer.keys[field] ?? []).map(k => [k.frame, k]));
    for (const p of points) if (p.frame >= from && p.frame < to) map.set(p.frame, p);
    layer.keys[field] = [...map.values()].sort((a, b) => a.frame - b.frame);
  };
  const end = to - 1;
  const f0 = from + Math.min(spec.at ?? 0, Math.max(0, end - from - 4));

  if (type === 'throw-right' || type === 'throw-left' || type === 'arc') {
    const dir = type === 'throw-left' ? -1 : type === 'throw-right' ? 1 : ((spec.toX ?? startX + 600) >= startX ? 1 : -1);
    if (f0 > from) {
      setKeys('opacity', [{ frame: from, value: 0, easing: 'hold' }, { frame: f0, value: 1, easing: 'linear' }]);
    }
    const dx = spec.toX !== undefined ? spec.toX - startX : dir * (spec.distance ?? 720);
    const dy = spec.toY !== undefined ? spec.toY - startY : 0;
    const arcH = spec.arcHeight ?? 120;
    const flightFrames = Math.min(spec.frames ?? 18, Math.max(4, end - f0));
    const fImpact = Math.min(end, f0 + flightFrames);
    const r0 = brot - dir * 18;
    const spin = spec.spin ?? (dir * 380);
    const xPts = [], yPts = [], rPts = [];

    for (let f = f0; f <= fImpact; f += 2) {
      const t = (f - f0) / Math.max(1, fImpact - f0);
      xPts.push({ frame: f, value: Math.round(bx + dx * t), easing: 'linear' });
      yPts.push({ frame: f, value: Math.round(by + dy * t - 4 * arcH * t * (1 - t)), easing: 'linear' });
      rPts.push({ frame: f, value: +(r0 + spin * t).toFixed(1), easing: 'linear' });
    }
    if (xPts.at(-1)?.frame !== fImpact) {
      xPts.push({ frame: fImpact, value: Math.round(bx + dx), easing: 'linear' });
      yPts.push({ frame: fImpact, value: Math.round(by + dy), easing: 'linear' });
      rPts.push({ frame: fImpact, value: +(r0 + spin).toFixed(1), easing: 'linear' });
    }

    if (spec.bounce === true && end > fImpact + 4) {
      const groundDy = (spec.groundY ?? (defaultGroundY + 15)) - startY;
      const bounceBack = spec.bounceX ?? (-dir * 210);
      const ricochetDur = Math.min(13, Math.max(4, end - fImpact));
      const fLand1 = Math.min(end, fImpact + ricochetDur);
      const land1Dx = dx + bounceBack * 0.72;
      const rImp = r0 + spin;
      const rLand1 = rImp + dir * 210;
      const hasHop = end > fLand1 + 3;

      for (let f = Math.min(fLand1, fImpact + 2); f <= fLand1; f += 2) {
        const u = (f - fImpact) / Math.max(1, fLand1 - fImpact);
        const ease = f === fLand1 && hasHop ? 'smooth' : 'linear';
        xPts.push({ frame: f, value: Math.round(bx + dx + (land1Dx - dx) * u), easing: ease });
        yPts.push({ frame: f, value: Math.round(by + dy + (groundDy - dy) * (u * u) - 65 * u * (1 - u)), easing: ease });
        rPts.push({ frame: f, value: +(rImp + (rLand1 - rImp) * u).toFixed(1), easing: ease });
      }
      if (xPts.at(-1)?.frame !== fLand1) {
        const ease = hasHop ? 'smooth' : 'linear';
        xPts.push({ frame: fLand1, value: Math.round(bx + land1Dx), easing: ease });
        yPts.push({ frame: fLand1, value: Math.round(by + groundDy), easing: ease });
        rPts.push({ frame: fLand1, value: +rLand1.toFixed(1), easing: ease });
      }

      if (hasHop) {
        const hopDur = Math.min(8, end - fLand1);
        const fLand2 = Math.min(end, fLand1 + hopDur);
        const fHopMid = Math.floor((fLand1 + fLand2) / 2);
        const rRest = spec.endRotation ?? (rLand1 + dir * 112);
        if (fHopMid > fLand1 && fHopMid < fLand2) {
          xPts.push({ frame: fHopMid, value: Math.round(bx + dx + bounceBack * 0.88), easing: 'smooth' });
          yPts.push({ frame: fHopMid, value: Math.round(by + groundDy - 44), easing: 'smooth' });
          rPts.push({ frame: fHopMid, value: +((rLand1 + rRest) * 0.5).toFixed(1), easing: 'smooth' });
        }
        xPts.push({ frame: fLand2, value: Math.round(bx + dx + bounceBack), easing: 'smooth' });
        yPts.push({ frame: fLand2, value: Math.round(by + groundDy), easing: 'smooth' });
        rPts.push({ frame: fLand2, value: +rRest.toFixed(1), easing: 'smooth' });
      }
    }

    setKeys('x', xPts);
    setKeys('y', yPts);
    setKeys('rotation', rPts);
  } else if (type === 'float') {
    const amp = spec.distance ?? 10, yPts = [], rPts = [];
    for (let f = from, step = 0; f <= end; f += 12, step++) {
      const w = Math.sin(step * Math.PI * 0.5);
      yPts.push({ frame: f, value: Math.round(by - w * amp), easing: 'smooth' });
      rPts.push({ frame: f, value: +(brot + w * 2.5).toFixed(2), easing: 'smooth' });
    }
    setKeys('y', yPts);
    setKeys('rotation', rPts);
  } else if (type === 'spin') {
    const rotDelta = spec.spin ?? 360;
    setKeys('rotation', [{ frame: f0, value: brot, easing: 'linear' }, { frame: end, value: +(brot + rotDelta).toFixed(1), easing: 'linear' }]);
  }
}

/** Predict final screen-space X of an actor after motion so a subsequent cut with `at: 'keep'` continues seamlessly. */
function motionEndX(startX, motion, flipX) {
  if (!motion || motion === 'none') return startX;
  const spec = typeof motion === 'string' ? { type: motion } : motion;
  const t = spec.type;
  if (t === 'dash-left') return startX - (spec.distance ?? 220);
  if (t === 'dash-right') return startX + (spec.distance ?? 220);
  if (t === 'step-in') { const dir = startX < 960 ? 1 : startX > 960 ? -1 : (flipX ? -1 : 1); return startX + dir * (spec.distance ?? 95); }
  if (t === 'recoil') { const dir = startX < 960 ? -1 : 1; return startX + dir * (spec.distance ?? 110); }
  if (t === 'run-left') return startX - Math.round((spec.distance ?? 360) * 0.65);
  if (t === 'run-right') return startX + Math.round((spec.distance ?? 360) * 0.65);
  return startX;
}

/**
 * Resolve horizontal positions for all actors in a cut:
 * 1. Respect per-location walkableX corridor & forbiddenZones (e.g. stone well, flowerbeds, water rocks).
 * 2. Separate overlapping actors horizontally while preserving left-to-right order so no actor eclipses another.
 */
function resolveStagePositions(entries, S, warnings, where) {
  const [minX, maxX] = Array.isArray(S.walkableX) && S.walkableX.length === 2 ? S.walkableX : [180, 1740];
  const zones = Array.isArray(S.forbiddenZones) ? S.forbiddenZones : [];
  const clamp = x => Math.max(minX, Math.min(maxX, Math.round(x)));
  const avoidZones = (x, who, explicitNumeric) => {
    let nx = clamp(x);
    for (const z of zones) {
      if (nx >= z.xMin && nx <= z.xMax) {
        const leftCand = z.xMin - 24, rightCand = z.xMax + 24;
        const pickLeft = leftCand >= minX && (rightCand > maxX || Math.abs(nx - leftCand) < Math.abs(rightCand - nx));
        const nudged = clamp(pickLeft ? leftCand : rightCand);
        if (explicitNumeric) {
          warnings.push(`${where}: nhân vật "${who}" ở x=${Math.round(x)} rơi vào vùng cấm "${z.label ?? 'vật cản'}" [${z.xMin}..${z.xMax}] -> tự dời sang x=${nudged}`);
        }
        nx = nudged;
      }
    }
    return nx;
  };
  const items = entries.map((e, idx) => ({
    idx, who: e.actor.who, depth: e.effDepth,
    x: avoidZones(e.rawX, e.actor.who, typeof e.actor.at === 'number'),
    pinned: e.pinned,
  }));
  // Iterative deterministic anti-overlap solver (preserves left-to-right order)
  if (items.length >= 2) {
    const sorted = [...items].sort((a, b) => a.x - b.x || a.idx - b.idx);
    for (let pass = 0; pass < 6; pass++) {
      let moved = false;
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i], b = sorted[i + 1];
        const sameDepth = a.depth === b.depth;
        const minGap = sameDepth ? (a.depth === 'near' ? 220 : 175) : 140;
        const gap = b.x - a.x;
        if (gap < minGap) {
          const need = minGap - gap;
          const pushA = Math.floor(need / 2), pushB = need - pushA;
          a.x -= pushA; b.x += pushB;
          moved = true;
        }
      }
      // Re-clamp inside walkable corridor without collapsing order
      if (sorted[0].x < minX) {
        const shift = minX - sorted[0].x;
        for (const it of sorted) it.x += shift;
      }
      if (sorted.at(-1).x > maxX) {
        const shift = sorted.at(-1).x - maxX;
        for (const it of sorted) it.x -= shift;
      }
      for (const it of sorted) it.x = clamp(it.x);
      if (!moved) break;
    }
  }
  return new Map(items.map(it => [it.who, Math.round(it.x)]));
}

/** Phase 2: compile with prepared selections (from prepareCatalogSelections) into a saved-document shape. */
export function compilePlan(plan, resolved, selections, { stage, registry = loadSemanticRegistry(), cues = [], timingMode = 'draft', audioTracks = [] } = {}) {
  const customStage = stage ?? {};
  const stageFor = locName => {
    const locStage = locationStageFor(locName, registry) ?? {};
    return {
      ...DEFAULT_STAGE, ...locStage, ...customStage,
      shots: { ...DEFAULT_STAGE.shots, ...locStage.shots, ...customStage.shots },
      slots: { ...DEFAULT_STAGE.slots, ...locStage.slots, ...customStage.slots },
      depth: { ...DEFAULT_STAGE.depth, ...locStage.depth, ...customStage.depth },
      parallax: { ...DEFAULT_STAGE.parallax, ...locStage.parallax, ...customStage.parallax },
    };
  };
  const duration = plan.beats.reduce((n, b) => n + b.frames, 0), source = { id: plan.id, duration };
  const layerOf = (from, name) => plan.id + '/shot-' + from + '/op-' + name;

  // Flatten all beats into visual cuts while keeping beat boundaries intact
  const flatCuts = []; let segCursor = 0;
  const cutLocs = resolved.cutLocations ?? [];
  plan.beats.forEach((beat, bi) => {
    const beatFrom = segCursor;
    const cuts = expandBeatCuts(beat);
    cuts.forEach((cut, ci) => {
      const from = segCursor, to = from + cut.frames; segCursor = to;
      const loc = cutLocs.find(l => l.beat === bi && l.cut === ci) ?? { key: 'bg', name: resolved.location };
      flatCuts.push({ beat, bi, cut, ci, beatFrom, from, to, loc });
    });
  });

  // Build contiguous background segments across all visual cuts
  const bgSegments = [];
  flatCuts.forEach((fc, fi) => {
    const prev = bgSegments.at(-1);
    if (prev && prev.key === fc.loc.key && prev.to === fc.from) { prev.to = fc.to; prev.cutIndices.push(fi); }
    else {
      const opId = bgSegments.length === 0 ? 'bg' : 'bg' + bgSegments.length;
      bgSegments.push({ opId, layerId: layerOf(fc.from, opId), key: fc.loc.key, name: fc.loc.name, from: fc.from, to: fc.to, cutIndices: [fi], camSpans: [], anyCamera: false, actors: [] });
    }
  });

  const commands = [];
  for (const seg of bgSegments) {
    const bg = selections[seg.key], bgHeight = Math.max(1080, Math.ceil(1920 * bg.height / bg.width));
    commands.push({ op: 'add-asset', id: seg.opId, asset: seg.key, from: seg.from, to: seg.to, placement: { anchor: 'center', x: 960, y: 540, height: bgHeight } });
  }

  const beats = [], panels = [], effects = [], planWarnings = [], actorMotions = [], actorTilts = [], propEnters = [], propMotions = [];
  const defaultCam = parseCamera(plan.camera, 'kế hoạch') ?? { type: 'off', intensity: 1 };
  const persistStage = Boolean(plan.persistStage);
  // Track each actor & prop within the current background segment for spatial & presence continuity.
  let lastSegKey = null, lastActorX = new Map(), stageActors = new Map(), stageProps = new Map(), prevCutActors = new Set();

  plan.beats.forEach((beat, bi) => {
    const beatCuts = flatCuts.filter(fc => fc.bi === bi);
    const beatFrom = beatCuts[0].from, beatTo = beatCuts.at(-1).to;
    const beatCue = cues[bi] ?? null;
    const beatAudioEnd = beatCue ? beatCue.to : beatTo;
    const hasCutSpeech = Boolean(beat.cuts?.some(c => c.speech !== undefined));
    const beatSpeechSpec = (beat.cuts?.length && !hasCutSpeech && beat.speech)
      ? (typeof beat.speech === 'string' ? { text: beat.speech } : beat.speech)
      : null;
    const beatCutStages = [];
    const beatLayerIds = new Set(), lines = [], actorSet = new Set();

    const beatQuotedSegs = extractQuotedDialogueSegments(beat.quote).filter(s => s.quoted);
    const spanToAudioFrames = (startRatio, endRatio, winFrom, winTo) => {
      const audioFrom = beatFrom + Math.round((beatAudioEnd - beatFrom) * startRatio);
      let audioTo = beatFrom + Math.round((beatAudioEnd - beatFrom) * endRatio);
      if (endRatio >= 0.96 && winTo === beatTo) audioTo = beatTo;
      return [Math.max(winFrom, audioFrom), Math.min(winTo, audioTo)];
    };
    const emitSpeechPanels = ({ spec, windowFrom, windowTo, stages, idPrefix, seedBase }) => {
      const segInputs = spec.chunks?.length
        ? [{ rawText: spec.chunks.join(' '), presetChunks: spec.chunks, located: locateQuoteSpan(beat.quote, spec.chunks.join(' ')) }]
        : spec.fromQuote
          ? extractQuotedDialogueSegments(beat.quote).map(seg => ({
              rawText: seg.text,
              quoted: seg.quoted,
              startRatio: seg.startRatio,
              endRatio: seg.endRatio,
            }))
          : [{ rawText: spec.text, located: locateQuoteSpan(beat.quote, spec.text) }];

      const turnSpans = [];
      for (const item of segInputs) {
        const rawChunks = item.presetChunks ?? splitSpeechChunks(item.rawText, spec.maxChars ?? 58);
        if (!rawChunks.length || windowTo <= windowFrom) continue;
        let sFrom = windowFrom, sTo = windowTo;
        if (spec.fromQuote && !item.presetChunks) {
          if (item.quoted) {
            const [iFrom, iTo] = spanToAudioFrames(item.startRatio, item.endRatio, windowFrom, windowTo);
            if (iTo - iFrom < 4) continue;
            sFrom = iFrom;
            sTo = iTo;
          }
        } else if (item.located) {
          const [iFrom, iTo] = spanToAudioFrames(item.located.startRatio, item.located.endRatio, windowFrom, windowTo);
          if (iTo - iFrom >= Math.max(12, rawChunks.length * 6)) {
            sFrom = iFrom;
            sTo = iTo;
          }
        }
        if (sTo <= sFrom) continue;
        turnSpans.push(...allocateChunkSpans(rawChunks, sFrom, sTo, 2));
      }
      if (!turnSpans.length) return;
      const totalTurns = turnSpans.length;
      turnSpans.forEach((sp, ti) => {
        sp.turnIndex = ti;
        sp.turnTotal = totalTurns;
      });
      const multiCut = stages.length > 1;
      let segCounter = 0;
      for (const span of turnSpans) {
        const overlapping = stages.filter(st => st.to > span.from && st.from < span.to);
        const rawTargets = overlapping.length ? overlapping : [stages[0]];
        const hasRealSeg = overlapping.length > 1 && rawTargets.some(st => Math.min(span.to, st.to) - Math.max(span.from, st.from) >= 4);
        for (const st of rawTargets) {
          const subFrom = overlapping.length ? Math.max(span.from, st.from) : span.from;
          const subTo = overlapping.length ? Math.min(span.to, st.to) : span.to;
          if (hasRealSeg && subTo - subFrom < 4) continue;
          const targetWho = spec.who ?? spec.speaker ?? st.cut.speaker
            ?? (st.focusSet?.size === 1 ? [...st.focusSet][0] : st.cutActorLayers.find(a => !a.dimmed && !a.isOtsShoulder)?.who ?? st.cutActorLayers[0]?.who);
          let mouthX, headTopY, mouthY, isCloseHead = false, speakerObj = null, anchored = false;
          if (spec.prop) {
            const propObj = st.cutPropPlacements.find(p => p.id === spec.prop);
            if (propObj) {
              mouthX = Math.max(180, Math.min(1740, Math.round(propObj.x)));
              headTopY = Math.round(propObj.y - propObj.h);
              mouthY = Math.round(Math.max(120, Math.min(720, propObj.y - propObj.h * 0.68)));
              isCloseHead = headTopY < 185;
              anchored = true;
            }
          } else {
            speakerObj = (targetWho ? st.cutActorLayers.find(a => a.who === targetWho && !a.isOtsShoulder) : null)
              ?? (!spec.who && !spec.speaker ? st.cutActorLayers.find(a => !a.isOtsShoulder) : null);
            if (speakerObj) {
              mouthX = Math.max(180, Math.min(1740, Math.round(speakerObj.x)));
              const speakerH = speakerObj.h ?? 750;
              headTopY = Math.round(speakerObj.y - speakerH);
              mouthY = Math.round(Math.max(120, Math.min(720, speakerObj.y - speakerH * 0.78)));
              isCloseHead = headTopY < 185 || speakerObj.framing === 'portrait' || Boolean(st.otsShoulderSide);
              anchored = true;
            }
          }
          if (!anchored) {
            mouthX = spec.side === 'left' ? 560 : spec.side === 'right' ? 1360 : 960;
            headTopY = 250;
            mouthY = 380;
          }
          const otherEntities = [
            ...st.cutActorLayers
              .filter(a => !a.isOtsShoulder && (spec.prop ? true : a.who !== targetWho))
              .map(a => ({ x: a.x, halfW: 115 })),
            ...st.cutPropPlacements
              .filter(p => p.h >= 380 && p.id !== spec.prop)
              .map(p => ({ x: p.x, halfW: Math.min(260, Math.round(p.h * 0.36)) })),
          ];
          const castMeta = !spec.prop && targetWho ? plan.cast[targetWho] : null;
          const resolvedTitle = spec.title ?? castMeta?.name ?? null;
          const resolvedColor = spec.color ?? castMeta?.color ?? null;

          const maxLen = span.text.length;
          const hasOthers = anchored && !st.otsShoulderSide && otherEntities.length > 0;
          const rawW = maxLen <= 28 ? maxLen * 17 + 84 : Math.round((maxLen / 2) * 19 + 110);
          const maxAllowedW = st.otsShoulderSide ? 500 : hasOthers ? 540 : 620;
          let bubbleW = Math.min(maxAllowedW, Math.max(340, rawW));
          let left;
          let top;
          const MIN_L = 64, MAX_R = 1856;

          if (!anchored) {
            if (spec.side) {
              left = spec.side === 'left' ? MIN_L : spec.side === 'right' ? MAX_R - bubbleW : Math.round(960 - bubbleW / 2);
            } else if (otherEntities.length > 0) {
              const minOX = Math.min(...otherEntities.map(o => o.x - o.halfW));
              const maxOX = Math.max(...otherEntities.map(o => o.x + o.halfW));
              const openLeft = minOX - 55 - MIN_L;
              const openRight = MAX_R - (maxOX + 55);
              if (openRight >= openLeft && openRight >= 340) {
                bubbleW = Math.min(bubbleW, Math.max(340, Math.floor(openRight)));
                left = MAX_R - bubbleW;
              } else if (openLeft >= 340) {
                bubbleW = Math.min(bubbleW, Math.max(340, Math.floor(openLeft)));
                left = MIN_L;
              } else {
                left = Math.round(960 - bubbleW / 2);
              }
            } else {
              left = Math.round(960 - bubbleW / 2);
            }
            top = 46;
          } else if (st.otsShoulderSide === 'left') {
            left = Math.max(MIN_L, Math.min(MAX_R - bubbleW, Math.round(mouthX - 200 - bubbleW)));
            top = Math.max(46, Math.min(190, Math.round(mouthY - 210)));
          } else if (st.otsShoulderSide === 'right') {
            left = Math.max(MIN_L, Math.min(MAX_R - bubbleW, Math.round(mouthX + 200)));
            top = Math.max(46, Math.min(190, Math.round(mouthY - 210)));
          } else if (hasOthers && !spec.side) {
            const leftOthers = otherEntities.filter(o => o.x < mouthX - 40);
            const rightOthers = otherEntities.filter(o => o.x > mouthX + 40);
            const safeMinLeft = leftOthers.length ? Math.max(...leftOthers.map(o => o.x + o.halfW + 38)) : MIN_L;
            const safeMaxRight = rightOthers.length ? Math.min(...rightOthers.map(o => o.x - o.halfW - 38)) : MAX_R;
            const corridorW = Math.max(0, safeMaxRight - safeMinLeft);

            if (isCloseHead) {
              const faceClear = 188;
              const gapLeft = Math.max(0, (mouthX - faceClear) - safeMinLeft);
              const gapRight = Math.max(0, safeMaxRight - (mouthX + faceClear));
              if (gapLeft >= 310 && gapLeft >= gapRight) {
                bubbleW = Math.min(bubbleW, Math.floor(gapLeft));
                left = Math.round(Math.max(safeMinLeft, mouthX - faceClear - bubbleW));
                top = Math.max(54, Math.min(205, Math.round(mouthY - 205)));
              } else if (gapRight >= 310) {
                bubbleW = Math.min(bubbleW, Math.floor(gapRight));
                left = Math.round(Math.min(safeMaxRight - bubbleW, mouthX + faceClear));
                top = Math.max(54, Math.min(205, Math.round(mouthY - 205)));
              } else {
                if (corridorW >= 320) bubbleW = Math.min(bubbleW, Math.floor(corridorW));
                const desired = mouthX >= 960 ? mouthX - bubbleW * 0.55 : mouthX - bubbleW * 0.45;
                left = Math.round(Math.max(safeMinLeft, Math.min(safeMaxRight - bubbleW, desired)));
                left = Math.max(MIN_L, Math.min(MAX_R - bubbleW, left));
                top = 34;
              }
            } else {
              if (corridorW >= 320) bubbleW = Math.min(bubbleW, Math.floor(corridorW));
              const desired = mouthX < 760
                ? mouthX - bubbleW * 0.36
                : mouthX > 1160
                  ? mouthX - bubbleW * 0.64
                  : mouthX - bubbleW * 0.50;
              left = Math.round(Math.max(safeMinLeft, Math.min(safeMaxRight - bubbleW, desired)));
              left = Math.max(MIN_L, Math.min(MAX_R - bubbleW, left));
              top = Math.max(26, Math.min(200, Math.round(headTopY - 190)));
            }
          } else if (isCloseHead) {
            const onLeft = spec.side ? spec.side === 'left' : mouthX >= 960;
            left = onLeft
              ? Math.max(MIN_L, Math.min(MAX_R - bubbleW, Math.round(mouthX - 205 - bubbleW)))
              : Math.max(MIN_L, Math.min(MAX_R - bubbleW, Math.round(mouthX + 205)));
            top = Math.max(54, Math.min(205, Math.round(mouthY - 210)));
          } else {
            const frac = spec.side === 'left' ? 0.72 : spec.side === 'right' ? 0.28 : mouthX < 760 ? 0.34 : mouthX > 1160 ? 0.66 : 0.50;
            left = Math.max(MIN_L, Math.min(MAX_R - bubbleW, Math.round(mouthX - bubbleW * frac)));
            top = Math.max(26, Math.min(200, Math.round(headTopY - 190)));
          }
          let tailTipX = null, tailTipY = null;
          if (anchored) {
            if (left + bubbleW <= mouthX - 110) {
              tailTipX = Math.round(Math.max(left + bubbleW + 24, Math.min(mouthX - 142, left + bubbleW + 38)));
              tailTipY = Math.round(mouthY);
            } else if (left >= mouthX + 110) {
              tailTipX = Math.round(Math.min(left - 24, Math.max(mouthX + 142, left - 38)));
              tailTipY = Math.round(mouthY);
            } else {
              tailTipX = mouthX;
              tailTipY = Math.round(Math.max(top + 100, headTopY - 24));
            }
          }
          if (speakerObj) {
            const emoteFx = effects.find(fx => fx.kind === 'emote' && fx.layerId === speakerObj.layer);
            if (emoteFx && emoteFx.side === 'auto') {
              const bubbleCenter = left + bubbleW / 2;
              emoteFx.side = bubbleCenter <= mouthX ? 'right' : 'left';
            }
          }
          panels.push({
            id: multiCut ? `${idPrefix}-speech-${span.turnIndex}-${segCounter++}` : `${idPrefix}-speech-${span.turnIndex}`,
            from: subFrom,
            to: subTo,
            title: resolvedTitle,
            ...(resolvedColor ? { speakerColor: resolvedColor } : {}),
            text: span.text,
            style: 'speech',
            variant: spec.variant ?? 'normal',
            side: spec.side ?? (mouthX >= 960 ? 'right' : 'left'),
            left,
            top,
            width: bubbleW,
            tailTipX,
            tailTipY,
            noTail: !anchored,
            speakerLayerId: speakerObj?.layer ?? null,
            turnIndex: span.turnIndex,
            turnTotal: span.turnTotal,
            seed: seedBase + span.turnIndex * 3 + 3,
          });
        }
      }
    };

    for (const fc of beatCuts) {
      const { cut, ci, from, to } = fc;
      const seg = bgSegments.find(s => s.cutIndices.includes(flatCuts.indexOf(fc)));
      if (seg.layerId !== lastSegKey) {
        lastSegKey = seg.layerId;
        lastActorX = new Map();
        stageActors = new Map();
        stageProps = new Map();
        prevCutActors = new Set();
      }
      const S = stageFor(seg.name);
      beatLayerIds.add(seg.layerId);
      if (cut.frames > 90) {
        planWarnings.push(`beat ${beat.id}${beat.cuts ? `[${ci}]` : ''}: kéo dài ${cut.frames}f (> 90f / 3s) trong một bố cục; nên chia beat.cuts[] hoặc thêm chuyển động để tránh đứng hình lâu`);
      }

      // Handle explicit exits from the current stage before carrying over persistent actors/props
      const leaveSet = new Set(cut.leave ? (Array.isArray(cut.leave) ? cut.leave : [cut.leave]) : []);
      for (const w of leaveSet) stageActors.delete(w);
      const leavePropSet = new Set(cut.leaveProps ?? []);
      for (const pid of leavePropSet) stageProps.delete(pid);

      const cutAngle = cut.angle ?? 'standard';
      const speechSpec = cut.speech
        ? (typeof cut.speech === 'string' ? { text: cut.speech } : cut.speech)
        : (!beatSpeechSpec && cut.panel && typeof cut.panel === 'object' && cut.panel.style === 'speech' ? cut.panel : null);
      const effectiveSpeech = speechSpec ?? beatSpeechSpec;
      const speechWho = (typeof cut.speech === 'object' ? cut.speech?.who : null)
        ?? (typeof cut.panel === 'object' ? cut.panel?.speaker : null)
        ?? (typeof beatSpeechSpec === 'object' ? beatSpeechSpec?.who : null)
        ?? cut.speaker
        ?? null;
      const speechExcited = Boolean(effectiveSpeech?.variant === 'shout');

      const explicitActors = cut.actors ?? [];
      const explicitWho = new Set(explicitActors.map(a => a.who));
      const focusSet = cut.focus ? new Set(Array.isArray(cut.focus) ? cut.focus : [cut.focus]) : null;
      const primaryWho = speechWho ?? (focusSet?.size === 1 ? [...focusSet][0] : explicitActors[0]?.who ?? null);

      // Build effective actor list: explicit actors + auto-carried stage actors (skip auto-carry on solo reverse shots)
      let effectiveActors = explicitActors.map(a => ({ actor: a, carried: false, use: resolved.uses.find(u => u.beat === bi && (u.cut ?? 0) === ci && u.who === a.who) }));
      if (persistStage && !cut.solo && cutAngle !== 'reverse') {
        for (const [who, saved] of stageActors) {
          if (!explicitWho.has(who)) {
            effectiveActors.push({
              actor: { who, pose: saved.actor.pose, face: saved.actor.face, at: 'keep', depth: saved.depth, look: saved.look, height: saved.actor.height, scale: saved.actor.scale, framing: saved.actor.framing, yOffset: saved.actor.yOffset, ...(saved.actor.silhouette !== undefined ? { silhouette: saved.actor.silhouette } : {}), ...(saved.actor.rotate !== undefined ? { rotate: saved.actor.rotate } : {}) },
              carried: true,
              use: saved.use,
            });
          }
        }
      } else if (!cut.solo && cutAngle !== 'reverse') {
        for (const w of prevCutActors) {
          if (!explicitWho.has(w) && !leaveSet.has(w)) {
            planWarnings.push(`beat ${beat.id}${beat.cuts ? `[${ci}]` : ''}: nhân vật "${w}" biến mất đột ngột trên cùng nền "${seg.name}" (nên bật persistStage: true, giữ nhân vật trong cut, hoặc đánh dấu leave/solo)`);
          }
        }
      }

      if (cutAngle === 'reverse' && primaryWho && effectiveActors.some(e => e.actor.who === primaryWho)) {
        effectiveActors = effectiveActors.filter(e => e.actor.who === primaryWho);
      }

      let otsShoulderWho = null;
      if (cutAngle === 'ots' && primaryWho && effectiveActors.length >= 2) {
        const peer = effectiveActors.find(e => e.actor.who !== primaryWho);
        if (peer) {
          otsShoulderWho = peer.actor.who;
          effectiveActors = effectiveActors.filter(e => e.actor.who === primaryWho || e.actor.who === otsShoulderWho);
        }
      }

      const height = S.shots[cut.shot ?? 'medium'];
      const actorEntries = effectiveActors.map(entry => {
        const a = entry.actor;
        let x;
        const atSpec = (a.at === undefined && persistStage && lastActorX.has(a.who)) ? 'keep' : a.at;
        if (atSpec === 'keep') { x = lastActorX.has(a.who) ? lastActorX.get(a.who) : S.slots.center; }
        else { x = typeof atSpec === 'number' ? atSpec : S.slots[atSpec ?? 'center']; }
        const effDepth = entry.carried && focusSet && !focusSet.has(a.who) ? (a.depth === 'near' ? 'mid' : a.depth ?? 'mid') : (a.depth ?? 'near');
        return { ...entry, rawX: Math.max(120, Math.min(1800, Math.round(x))), effDepth, pinned: atSpec === 'keep' };
      });
      const cutLabel = `beat ${beat.id}${beat.cuts ? `[${ci}]` : ''}`;
      const beatPositions = resolveStagePositions(actorEntries, S, planWarnings, cutLabel);
      const flipPositions = new Map([...lastActorX, ...beatPositions]);

      // Compute bold camera-angle framing & stage overrides without corrupting lastActorX
      let camOffset = null;
      let otsShoulderSide = null;
      let primaryFacesRight = true;
      let primaryOnRight = false;
      if (primaryWho && (cutAngle === 'reverse' || cutAngle === 'ots')) {
        const primaryEntry = actorEntries.find(e => e.actor.who === primaryWho);
        const rawPrimaryX = beatPositions.get(primaryWho) ?? lastActorX.get(primaryWho) ?? 960;
        if (primaryEntry?.actor.look) {
          primaryFacesRight = primaryEntry.actor.look === 'right';
        } else {
          const peerKey = otsShoulderWho ?? primaryEntry?.actor.faceTo ?? [...lastActorX.keys()].find(k => k !== primaryWho);
          const peerX = peerKey ? flipPositions.get(peerKey) : undefined;
          primaryFacesRight = Number.isFinite(peerX) && peerX !== rawPrimaryX ? peerX > rawPrimaryX : rawPrimaryX < 960;
        }
        primaryOnRight = !primaryFacesRight;
        if (cutAngle === 'ots' && otsShoulderWho) {
          otsShoulderSide = primaryOnRight ? 'left' : 'right';
          camOffset = { scale: 1.22, x: primaryOnRight ? 135 : -135, y: -22 };
        } else {
          camOffset = { scale: 1.24, x: primaryFacesRight ? -150 : 150, y: -24 };
        }
      } else if (cutAngle === 'hero-low') {
        camOffset = { scale: 1.18, x: 0, y: 20 };
      } else if (cutAngle === 'dutch-left' || cutAngle === 'dutch-right') {
        camOffset = { scale: 1.14, x: 0, y: 0 };
      }

      const cutCam = cut.camera !== undefined ? parseCamera(cut.camera, `beat ${beat.id}`) : defaultCam;
      if ((cutCam && cutCam.type !== 'off') || camOffset || cut.cameraShake) seg.anyCamera = true;
      seg.camSpans.push({ ...cameraSpan(cutCam ?? { type: 'off', intensity: 1 }, from, to, camOffset), cameraShake: cut.cameraShake });

      const cutActorLayers = [];
      const dimLayerIds = [];
      const silhouetteLayerIds = new Set();
      for (const { actor, carried, use, effDepth } of actorEntries) {
        const name = beat.cuts ? `b${bi}c${ci}-${actor.who}` : `b${bi}-${actor.who}`, layer = layerOf(from, name);
        const isPrimary = actor.who === primaryWho;
        const isOtsShoulder = cutAngle === 'ots' && actor.who === otsShoulderWho;
        let x = beatPositions.get(actor.who);
        const charMeta = characterMetaFor(use.asset, registry);
        const castScale = plan.cast[actor.who]?.scale ?? 1;
        const charScale = (charMeta?.heightScale ?? 1) * castScale * (actor.scale ?? 1);
        const motionType = typeof actor.motion === 'string' ? actor.motion : actor.motion?.type;
        const isLocomotion = motionType === 'run-left' || motionType === 'run-right' || motionType === 'dash-left' || motionType === 'dash-right';
        const autoFraming = (cut.shot === 'close' && !isLocomotion) ? 'portrait' : (S.defaultFraming ?? 'full');
        let framing = actor.framing ?? cut.framing ?? autoFraming;
        const depthScale = S.depth[effDepth] ?? 1;
        let angleCustomDepth;

        if (cutAngle === 'reverse' && isPrimary) {
          x = primaryFacesRight ? 620 : 1300;
          framing = actor.framing ?? cut.framing ?? 'portrait';
          angleCustomDepth = 0.12;
        } else if (cutAngle === 'ots' && isPrimary) {
          x = primaryOnRight ? 1250 : 670;
          framing = actor.framing ?? cut.framing ?? 'portrait';
          angleCustomDepth = 0.14;
        } else if (isOtsShoulder) {
          x = primaryOnRight ? 175 : 1745;
          framing = 'full';
          angleCustomDepth = 0.28;
        } else if (cutAngle === 'hero-low' && effDepth !== 'far') {
          angleCustomDepth = 0.16;
        }

        const rawBaseY = isOtsShoulder ? 2020 : framing === 'portrait' ? (S.portraitY ?? 1520) : framing === 'bust' ? (S.bustY ?? 1240) : S.groundY;
        const baseY = (framing === 'full' && !isOtsShoulder) ? S.groundY : Math.round(S.groundY + (rawBaseY - S.groundY) * depthScale);
        const actorY = Math.round(baseY + (actor.yOffset ?? 0));
        let h = actor.height ?? (
          isOtsShoulder
            ? Math.round(1750 * charScale)
            : framing === 'portrait'
              ? Math.round((S.portraitHeight ?? 1320) * S.depth[effDepth] * charScale)
              : framing === 'bust'
                ? Math.round(height * S.depth[effDepth] * charScale * (S.bustScale ?? 1.24))
                : Math.round(height * S.depth[effDepth] * charScale)
        );
        if (!actor.height && !isOtsShoulder && isPrimary && (cutAngle === 'reverse' || cutAngle === 'hero-low')) {
          h = Math.round(h * 1.12);
        } else if (!actor.height && cutAngle === 'ots' && isPrimary) {
          h = Math.round(h * 1.06);
        }

        let flipActor = actor;
        if (isOtsShoulder) {
          flipActor = { ...actor, look: primaryOnRight ? 'right' : 'left' };
        } else if ((cutAngle === 'ots' || cutAngle === 'reverse') && isPrimary && typeof actor.flip !== 'boolean' && !actor.look) {
          flipActor = { ...actor, look: primaryFacesRight ? 'right' : 'left' };
        } else if (typeof actor.flip !== 'boolean' && !actor.look && !actor.faceTo && !isLocomotion) {
          if (primaryWho && primaryWho !== actor.who && flipPositions.has(primaryWho)) {
            flipActor = { ...actor, faceTo: primaryWho };
          } else {
            const peer = actorEntries.find(e => e.actor.who !== actor.who && !(cutAngle === 'ots' && e.actor.who === otsShoulderWho));
            if (peer) {
              flipActor = { ...actor, faceTo: peer.actor.who };
            } else if (effectiveSpeech?.prop) {
              const spId = effectiveSpeech.prop;
              const pSpec = (cut.props ?? []).find(p => (p.id ?? `${p.prop}:${p.item ?? 0}`) === spId) ?? stageProps.get(spId)?.p;
              if (pSpec) {
                const propX = typeof pSpec.at === 'number' ? pSpec.at : S.slots[pSpec.at ?? 'center'];
                if (Number.isFinite(propX) && propX !== x) flipActor = { ...actor, look: propX < x ? 'left' : 'right' };
              }
            }
          }
        }
        const flipX = resolveActorFlip({ actor: flipActor, poseName: use.pose, x, beatPositions: flipPositions, assetName: use.asset, registry });
        if (cutAngle !== 'reverse' && cutAngle !== 'ots' && !isOtsShoulder) {
          lastActorX.set(actor.who, motionEndX(x, actor.motion, flipX));
        }

        const isDimmed = isOtsShoulder || (focusSet && !focusSet.has(actor.who)) || (carried && cut.shot === 'close' && explicitWho.size > 0);
        const actorZ = isOtsShoulder
          ? 152
          : (cutAngle === 'ots' && isPrimary)
            ? 120
            : (isDimmed ? 95 : 100) + (effDepth === 'far' ? 0 : effDepth === 'mid' ? 10 : 20);
        commands.push({ op: 'add-character', id: name, asset: use.key, from, to, placement: { x, y: actorY, height: h, anchor: 'bottom-center', flipX, z: actorZ } });
        seg.actors.push({ layer, depthKey: effDepth, parallax: S.parallax, ...(angleCustomDepth !== undefined ? { customDepth: angleCustomDepth } : {}) });
        cutActorLayers.push({ layer, depth: effDepth, who: actor.who, dimmed: isDimmed, x, y: actorY, h, framing, isOtsShoulder });
        if (isDimmed && !actor.silhouette) dimLayerIds.push(layer);

        const baseTilt = (cutAngle === 'dutch-left' ? -4.5 : cutAngle === 'dutch-right' ? 4.5 : 0) + (actor.rotate ?? 0);
        if (baseTilt) {
          actorTilts.push({ layer, rotation: baseTilt });
        }

        const isActorSpeaking = Boolean(actor.speaking) || (speechWho && actor.who === speechWho);
        if (actor.motion) {
          actorMotions.push({ layer, motion: actor.motion, from, to, flipX, x });
        } else if (isActorSpeaking && !isOtsShoulder) {
          const excited = actor.speaking === 'excited' || speechExcited;
          const mType = excited ? 'talk-excited' : 'talk';
          let activeSpans = null;
          if (effectiveSpeech?.fromQuote && beatQuotedSegs.length) {
            activeSpans = beatQuotedSegs
              .map(seg => spanToAudioFrames(seg.startRatio, seg.endRatio, from, to))
              .filter(([a, b]) => b - a >= 6);
          } else if (effectiveSpeech?.text && beatQuotedSegs.length) {
            const loc = locateQuoteSpan(beat.quote, effectiveSpeech.text);
            if (loc) {
              const [a, b] = spanToAudioFrames(loc.startRatio, loc.endRatio, from, to);
              activeSpans = b - a >= 6 ? [[a, b]] : [];
            }
          } else if (actor.speaking && beatQuotedSegs.length && beatQuotedSegs.reduce((s, seg) => s + (seg.endRatio - seg.startRatio), 0) < 0.92) {
            activeSpans = beatQuotedSegs
              .map(seg => spanToAudioFrames(seg.startRatio, seg.endRatio, from, to))
              .filter(([a, b]) => b - a >= 6);
          }
          if (activeSpans) {
            for (const [spFrom, spTo] of activeSpans) {
              actorMotions.push({ layer, motion: mType, from: spFrom, to: spTo, flipX, x });
            }
          } else {
            actorMotions.push({ layer, motion: mType, from, to, flipX, x });
          }
        }

        if (!carried && actor.emote && !isOtsShoulder) {
          const em = typeof actor.emote === 'string' ? { type: actor.emote } : actor.emote;
          const emFrom = from + Math.min(em.at ?? 0, Math.max(0, cut.frames - 4));
          const emTo = em.frames ? Math.min(to, emFrom + em.frames) : to;
          effects.push({
            id: `${plan.id}-${beat.id}-c${ci}-emote-${actor.who}`,
            kind: 'emote', layerId: layer, preset: em.type,
            x, y: actorY, height: h, flipX, side: em.side ?? 'auto',
            from: emFrom, to: emTo, z: 9100,
          });
        }
        if (!carried && actor.aura && !isOtsShoulder) {
          const aSpec = typeof actor.aura === 'string' ? { type: actor.aura } : actor.aura;
          effects.push({ id: `${plan.id}-${beat.id}-c${ci}-aura-${actor.who}`, kind: 'aura', layerId: layer, preset: aSpec.type, intensity: aSpec.intensity ?? 1, from, to, x, y: actorY, height: h, z: actorZ - 5 });
        }
        if (!carried && actor.trail && !isOtsShoulder) {
          const tSpec = actor.trail === true ? {} : typeof actor.trail === 'string' ? { color: actor.trail } : actor.trail;
          effects.push({ id: `${plan.id}-${beat.id}-c${ci}-trail-${actor.who}`, kind: 'trail', layerId: layer, color: tSpec.color ?? 'cyan', copies: tSpec.copies ?? 3, step: tSpec.step ?? 2, from, to, z: actorZ - 2 });
        }
        if (actor.silhouette && !isOtsShoulder) {
          silhouetteLayerIds.add(layer);
          effects.push({ id: `${plan.id}-${beat.id}-c${ci}-silhouette-${actor.who}`, kind: 'silhouette', layerId: layer, style: actor.silhouette === 'crimson' ? 'crimson' : 'black', from, to, z: 8060 });
        }
        if (!carried && !isOtsShoulder && actor.enter === 'pop-in' && cut.frames >= 12) commands.push({ op: 'pop-in', layerId: layer, from, frames: 8 });
        if (!carried && !isOtsShoulder && actor.enter === 'fade-in' && cut.frames >= 12) commands.push({ op: 'fade', layerId: layer, from, to: from + 10, opacity: [0, 1] });
        if (!carried && !isOtsShoulder && actor.exit === 'fade-out' && cut.frames >= 12) commands.push({ op: 'fade', layerId: layer, from: to - 10, to, opacity: [1, 0] });
        if (!carried && cut.shake && cut.frames >= 12) {
          const sh = typeof cut.shake === 'object' ? cut.shake : {};
          const shFrom = sh.at !== undefined ? from + Math.min(sh.at, cut.frames - 4) : Math.max(from, to - Math.min(20, cut.frames - 2));
          const shTo = sh.frames !== undefined ? Math.min(to, shFrom + sh.frames) : to;
          if (shTo - shFrom >= 2) commands.push({ op: 'shake', layerId: layer, from: shFrom, to: shTo, amplitude: sh.intensity ?? 14, step: 2 });
        }
        if (!carried) {
          stageActors.set(actor.who, { actor, use, depth: actor.depth ?? 'near', look: actor.look });
          beatLayerIds.add(layer); actorSet.add(actor.who); lines.push(actor.who + ': ' + use.pose + (use.face ? ' + ' + use.face : ''));
        } else {
          beatLayerIds.add(layer);
        }
      }
      if (cutAngle !== 'reverse' && cutAngle !== 'ots') {
        prevCutActors = new Set(effectiveActors.map(e => e.actor.who));
      }

      // Effective props: explicit props + auto-carried stage props (skip carry in solo/reverse closeup shots)
      const explicitProps = cut.props ?? [];
      const seenPropKeys = new Set();
      const effectiveProps = [];
      explicitProps.forEach((p, pi) => {
        const use = (resolved.propUses ?? []).find(u => u.beat === bi && (u.cut ?? 0) === ci && u.index === pi);
        const pKey = p.id ?? `${p.prop}:${p.item ?? 0}`;
        seenPropKeys.add(pKey);
        effectiveProps.push({ p, pi, use, pKey, carried: false });
      });
      if (persistStage && !cut.solo && cutAngle !== 'reverse' && cutAngle !== 'ots') {
        let carryIdx = explicitProps.length;
        for (const [pKey, saved] of stageProps) {
          if (!seenPropKeys.has(pKey)) {
            effectiveProps.push({ p: saved.p, pi: carryIdx++, use: saved.use, pKey, carried: true });
          }
        }
      }
      const cutPropPlacements = [];
      for (const { p, pi, use, pKey, carried } of effectiveProps) {
        const name = beat.cuts ? `b${bi}c${ci}-prop${pi}` : `b${bi}-prop${pi}`, layer = layerOf(from, name);
        const x = typeof p.at === 'number' ? p.at : S.slots[p.at ?? 'center'];
        const y = p.y ?? S.groundY, h = p.height ?? 280;
        cutPropPlacements.push({ id: pKey, x, y, h });
        const hasPropMotion = !carried && Boolean(p.motion && p.motion !== 'none');
        const propDimmed = !hasPropMotion && (Boolean(focusSet) || (carried && cut.shot === 'close'));
        const overlapsActor = cutActorLayers.some(a => Math.abs((a.x ?? 0) - x) < 210);
        const basePropZ = p.z !== undefined ? p.z : (overlapsActor ? 92 : 150);
        const propZ = propDimmed ? Math.min(basePropZ, 90) : basePropZ;
        commands.push({ op: 'add-asset', id: name, asset: use.key, from, to, placement: { x, y, height: h, anchor: 'bottom-center', flipX: !!p.flip, z: propZ } });
        seg.actors.push({ layer, depthKey: hasPropMotion ? 'near' : 'bg', parallax: S.parallax });
        if (propDimmed) dimLayerIds.push(layer);
        if (!carried && p.enter === 'pop-in' && cut.frames >= 12) commands.push({ op: 'pop-in', layerId: layer, from, frames: 8 });
        if (!carried && p.enter === 'fade-in' && cut.frames >= 12) commands.push({ op: 'fade', layerId: layer, from, to: from + 10, opacity: [0, 1] });
        if (!carried && p.enter === 'drop-in' && cut.frames >= 10) propEnters.push({ layer, type: 'drop-in', from, to, finalY: y });
        if (hasPropMotion) propMotions.push({ layer, motion: p.motion, from, to, startX: x, startY: y, defaultGroundY: S.groundY });
        if (!carried && p.trail) {
          const tSpec = p.trail === true ? {} : typeof p.trail === 'string' ? { color: p.trail } : p.trail;
          effects.push({ id: `${plan.id}-${beat.id}-c${ci}-prop${pi}-trail`, kind: 'trail', layerId: layer, color: tSpec.color ?? 'white', copies: tSpec.copies ?? 3, step: tSpec.step ?? 1, from, to, z: Math.max(1, propZ - 2) });
        }
        if (!carried && p.exit === 'fade-out' && cut.frames >= 12) commands.push({ op: 'fade', layerId: layer, from: to - 10, to, opacity: [1, 0] });
        if (!carried) { stageProps.set(pKey, { p, use }); lines.push('prop: ' + use.name); }
        beatLayerIds.add(layer);
      }

      if (cut.dof || dimLayerIds.length || cutAngle === 'reverse' || cutAngle === 'ots') {
        const defaultDof = (cutAngle === 'ots' || cutAngle === 'reverse') ? { blur: 4.2, dim: 0.90, shadow: true } : { blur: 2.8, dim: 0.94, shadow: true };
        const dSpec = cut.dof === true || cut.dof === 'soft' ? { blur: 3.5, dim: 0.92, shadow: true } : cut.dof === 'strong' ? { blur: 7, dim: 0.85, shadow: true } : (cut.dof && typeof cut.dof === 'object' ? cut.dof : defaultDof);
        effects.push({
          id: `${plan.id}-${beat.id}-c${ci}-dof`, kind: 'dof',
          bgLayerId: seg.layerId,
          actorLayerIds: cutActorLayers.filter(a => !a.dimmed && a.depth !== 'far' && !silhouetteLayerIds.has(a.layer)).map(a => a.layer),
          ...(dimLayerIds.length ? { dimLayerIds } : {}),
          ...(cutAngle === 'ots' ? { dimBlur: 6.2, dimBrightness: 0.44, dimSaturate: 0.65, dimOpacity: 0.92 } : {}),
          blur: dSpec.blur ?? 3.5, dim: dSpec.dim ?? 0.92, shadow: dSpec.shadow ?? true, from, to, z: 8000,
        });
      }
      if (cut.portalGlow) {
        const pg = cut.portalGlow === true ? {} : cut.portalGlow;
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-portalglow`, kind: 'portalGlow', x: pg.x ?? 960, y: pg.y ?? 540, color: pg.color ?? '#38bdf8', size: pg.size ?? 620, opacity: pg.opacity ?? 0.85, from, to, z: 90 });
      }
      if (cut.halftone) {
        const ht = cut.halftone === true ? {} : cut.halftone;
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-halftone`, kind: 'halftone', opacity: ht.opacity ?? 0.38, from, to, z: 8150 });
      }
      if (cut.mood) {
        const mSpec = typeof cut.mood === 'string' ? { type: cut.mood } : cut.mood;
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-mood`, kind: 'mood', preset: mSpec.type, opacity: mSpec.opacity ?? 1, from, to, z: 8200 });
      }
      if (cut.lighting) {
        const lg = typeof cut.lighting === 'string' ? { type: cut.lighting } : cut.lighting;
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-lighting`, kind: 'lighting', preset: lg.type, ...(lg.x !== undefined ? { x: lg.x } : {}), ...(lg.y !== undefined ? { y: lg.y } : {}), ...(lg.radius !== undefined ? { radius: lg.radius } : {}), ...(lg.color !== undefined ? { color: lg.color } : {}), intensity: lg.intensity ?? 1, ...(lg.darkness !== undefined ? { darkness: lg.darkness } : {}), from, to, z: 8250 });
      }
      if (cut.particles) {
        const pSpec = typeof cut.particles === 'string' ? { type: cut.particles } : cut.particles;
        const pZ = (pSpec.type === 'smoke' || pSpec.type === 'rain') ? 8420 : 8400;
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-particles`, kind: 'particles', preset: pSpec.type, ...(pSpec.x !== undefined ? { x: pSpec.x } : {}), ...(pSpec.y !== undefined ? { y: pSpec.y } : {}), opacity: pSpec.opacity ?? 1, from, to, z: pZ });
      }
      if (cut.filmBurn) {
        const fb = cut.filmBurn === true ? { preset: 'warm' } : typeof cut.filmBurn === 'string' ? { preset: cut.filmBurn } : cut.filmBurn;
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-filmburn`, kind: 'filmBurn', preset: fb.preset ?? 'warm', opacity: fb.opacity ?? 0.82, from, to, z: 8450 });
      }
      if (cut.lines) {
        const lSpec = typeof cut.lines === 'string' ? { type: cut.lines } : cut.lines;
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-lines`, kind: 'lines', preset: lSpec.type, color: lSpec.color ?? null, opacity: lSpec.opacity ?? 1, from, to, z: 8500 });
      }
      if (cut.lightning) {
        const ln = cut.lightning === true ? {} : cut.lightning;
        const lnTo = ln.frames ? Math.min(to, from + ln.frames) : to;
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-lightning`, kind: 'lightning', x: ln.x ?? 960, color: ln.color ?? '#93c5fd', from, to: lnTo, z: 8600 });
      }
      if (cut.impact) {
        const im = cut.impact === true ? {} : typeof cut.impact === 'string' ? { color: cut.impact } : cut.impact;
        const imFrom = from + Math.min(im.at ?? 0, Math.max(0, cut.frames - 3));
        const imTo = Math.min(to, imFrom + (im.frames ?? 10));
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-impact`, kind: 'impact', x: im.x ?? 960, y: im.y ?? 540, color: im.color ?? 'white', from: imFrom, to: imTo, z: 8700 });
      }
      if (cut.letterbox) {
        const lb = cut.letterbox === true ? {} : cut.letterbox;
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-letterbox`, kind: 'letterbox', height: lb.height ?? 8, from, to, z: 8800 });
      }
      if (cut.splitPanel) {
        const sp = cut.splitPanel === true ? {} : cut.splitPanel;
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-split`, kind: 'splitPanel', slant: sp.slant ?? 9, gutter: sp.gutter ?? 14, ...(sp.leftTint ? { leftTint: sp.leftTint } : {}), ...(sp.rightTint ? { rightTint: sp.rightTint } : {}), ...(sp.borderColor ? { borderColor: sp.borderColor } : {}), ...(sp.accentColor ? { accentColor: sp.accentColor } : {}), from, to, z: 8850 });
      }
      if (cut.sfxText) {
        const sx = typeof cut.sfxText === 'string' ? { text: cut.sfxText } : cut.sfxText;
        const sxFrom = from + Math.min(sx.start ?? 0, Math.max(0, cut.frames - 4));
        const sxTo = sx.frames ? Math.min(to, sxFrom + sx.frames) : to;
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-sfxtext`, kind: 'sfxText', text: sx.text, style: sx.style ?? 'impact', at: sx.at ?? 'top-right', rotate: sx.rotate ?? -8, from: sxFrom, to: sxTo, z: 9200 });
      }
      if (cut.cutTransition) {
        const ct = typeof cut.cutTransition === 'string' ? { type: cut.cutTransition } : cut.cutTransition;
        const ctDur = Math.min(cut.frames, ct.frames ?? CUT_TRANSITION_DEFAULTS[ct.type].frames);
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-cuttrans`, kind: 'cutTransition', preset: ct.type, color: ct.color ?? null, from, to: from + ctDur, z: 8950 });
      }
      if (cut.impactFrame) {
        const imf = cut.impactFrame === true ? {} : typeof cut.impactFrame === 'string' ? { style: cut.impactFrame } : cut.impactFrame;
        const ifFrom = from + Math.min(imf.at ?? 0, Math.max(0, cut.frames - 2));
        const ifTo = Math.min(to, ifFrom + (imf.frames ?? 2));
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-impactframe`, kind: 'impactFrame', style: imf.style ?? 'invert', from: ifFrom, to: ifTo, z: 8960 });
      }
      if (cut.flash) {
        const fSpec = cut.flash === true ? {} : typeof cut.flash === 'string' ? { color: cut.flash } : cut.flash;
        const fFrom = from + Math.min(fSpec.at ?? 0, Math.max(0, cut.frames - 2));
        const fTo = Math.min(to, fFrom + (fSpec.frames ?? 3));
        effects.push({ id: `${plan.id}-${beat.id}-c${ci}-flash`, kind: 'flash', color: fSpec.color ?? 'white', from: fFrom, to: fTo, z: 25000 });
      }
      const cutStage = { ci, from, to, cutActorLayers, cutPropPlacements, otsShoulderSide, focusSet, cut };
      beatCutStages.push(cutStage);
      if (speechSpec) {
        emitSpeechPanels({
          spec: speechSpec,
          windowFrom: from,
          windowTo: to,
          stages: [cutStage],
          idPrefix: `${plan.id}-${beat.id}-c${ci}`,
          seedBase: bi * 17 + ci * 5,
        });
      } else if (cut.panel) {
        const spec = typeof cut.panel === 'string' ? { text: cut.panel } : cut.panel;
        panels.push({ id: `${plan.id}-${beat.id}-c${ci}-panel`, from, to, title: spec.title ?? null, text: spec.text, side: spec.side ?? 'right', style: spec.style ?? 'system', seed: bi * 17 + ci * 5 + 3 });
      }
      (cut.fx ?? []).forEach((fx, i) => {
        const meta = fxMetaFor(fx.effect, registry);
        if (meta?.scope === 'full-screen' && (cut.actors?.length ?? 0) > 0) {
          planWarnings.push(`beat ${beat.id}: FX "${fx.effect}" là hiệu ứng toàn màn hình (full-screen)${meta.note ? ' — ' + meta.note : ''}`);
        }
        const start = from + Math.min(fx.at ?? 0, cut.frames - 3), end = Math.min(to, start + (fx.frames ?? 10)), name = beat.cuts ? `b${bi}c${ci}-fx${i}` : `b${bi}-fx${i}`;
        const span = end - start, outFrames = Math.max(0, Math.min(6, span - 3)), inFrames = Math.max(0, Math.min(2, span - outFrames - 1));
        const fxPlacement = fx.layer ? { ...(fx.placement ?? {}), z: fx.layer === 'behind' ? 80 : 200 } : fx.placement;
        commands.push({ op: 'effect', id: name, asset: resolved.effects[fx.effect], from: start, to: end, inFrames, outFrames, ...(fxPlacement ? { placement: fxPlacement } : {}) });
        beatLayerIds.add(layerOf(start, name)); lines.push('fx: ' + fx.effect);
      });
    }
    if (beatSpeechSpec && beatCutStages.length) {
      emitSpeechPanels({
        spec: beatSpeechSpec,
        windowFrom: beatFrom,
        windowTo: beatTo,
        stages: beatCutStages,
        idPrefix: `${plan.id}-${beat.id}`,
        seedBase: bi * 17,
      });
    }

    beats.push({
      id: beat.id, quote: beat.quote, actor: [...actorSet].join(', ') || '(không có nhân vật)', action: beat.action ?? (lines.join(' · ') || 'cảnh trống'),
      ...(beat.before ? { before: beat.before } : {}), ...(beat.after ? { after: beat.after } : {}), from: beatFrom, to: beatTo, layerIds: [...beatLayerIds], review: { status: 'pending' }
    });
  });

  const built = applyAuthoringOperations(source, { version: 1, revision: 0, layers: {} }, commands, selections);
  const document = built.document; document.beats = { version: 1, items: beats };
  if (plan.transitions) document.transitions = structuredClone(plan.transitions);

  for (const t of actorTilts) {
    const layer = document.layers[t.layer];
    if (layer) {
      layer.base ??= {};
      layer.base.rotation = t.rotation;
    }
  }

  for (const m of actorMotions) {
    const layer = document.layers[m.layer];
    if (layer) applyActorMotion(layer, m.motion, m.from, m.to, m.flipX, m.x);
  }

  for (const pe of propEnters) {
    const layer = document.layers[pe.layer];
    if (layer) applyPropEnter(layer, pe);
  }

  for (const pm of propMotions) {
    const layer = document.layers[pm.layer];
    if (layer) applyPropMotion(layer, pm.motion, pm.from, pm.to, pm.startX, pm.startY, pm.defaultGroundY);
  }

  for (const seg of bgSegments) {
    if (!seg.anyCamera) continue;
    const bgLayer = document.layers[seg.layerId];
    const keyMaps = { x: new Map(), y: new Map(), scale: new Map() };
    for (const sp of seg.camSpans) {
      for (const f of ['x', 'y', 'scale']) {
        keyMaps[f].set(sp.from, { frame: sp.from, value: sp.a[f], easing: 'smooth' });
        for (const mk of sp.midKeys ?? []) keyMaps[f].set(mk.frame, { frame: mk.frame, value: mk[f], easing: mk.easing ?? 'ease-out' });
        if (sp.endFrame > sp.from) keyMaps[f].set(sp.endFrame, { frame: sp.endFrame, value: sp.b[f], easing: 'smooth' });
      }
      if (sp.cameraShake && sp.endFrame - sp.from >= 4) {
        const cs = typeof sp.cameraShake === 'object' ? sp.cameraShake : {};
        const shFrom = sp.from + Math.min(cs.at ?? 0, Math.max(0, sp.endFrame - sp.from - 3));
        const shTo = Math.min(sp.endFrame, shFrom + (cs.frames ?? 12));
        const amp = cs.intensity ?? 16, dur = Math.max(1, shTo - shFrom);
        let hitEnd = false;
        for (let f = shFrom; f <= shTo; f += 2) {
          if (f === shTo) hitEnd = true;
          const p = (f - shFrom) / dur;
          const t = sp.endFrame > sp.from ? (f - sp.from) / (sp.endFrame - sp.from) : 0;
          const bx = sp.a.x + (sp.b.x - sp.a.x) * t, by = sp.a.y + (sp.b.y - sp.a.y) * t, bs = Math.max(1.04, sp.a.scale + (sp.b.scale - sp.a.scale) * t);
          const decay = f === shTo ? 0 : Math.pow(1 - p, 1.5);
          const dx = Math.round(Math.sin(p * Math.PI * 10 + 0.9) * amp * decay);
          const dy = Math.round(Math.cos(p * Math.PI * 7.5 + 0.4) * amp * 0.65 * decay);
          const punchScale = Math.min(1.5, +(bs + 0.03 * decay).toFixed(4));
          keyMaps.x.set(f, { frame: f, value: bx + dx, easing: 'linear' });
          keyMaps.y.set(f, { frame: f, value: by + dy, easing: 'linear' });
          keyMaps.scale.set(f, { frame: f, value: punchScale, easing: 'linear' });
        }
        if (!hitEnd) {
          const t = sp.endFrame > sp.from ? (shTo - sp.from) / (sp.endFrame - sp.from) : 0;
          const bx = sp.a.x + (sp.b.x - sp.a.x) * t, by = sp.a.y + (sp.b.y - sp.a.y) * t, bs = Math.max(1.04, sp.a.scale + (sp.b.scale - sp.a.scale) * t);
          keyMaps.x.set(shTo, { frame: shTo, value: bx, easing: 'linear' });
          keyMaps.y.set(shTo, { frame: shTo, value: by, easing: 'linear' });
          keyMaps.scale.set(shTo, { frame: shTo, value: +bs.toFixed(4), easing: 'linear' });
        }
      }
    }
    const camKeys = Object.fromEntries(['x', 'y', 'scale'].map(f => [f, [...keyMaps[f].values()].sort((a, b) => a.frame - b.frame)]));
    bgLayer.depth = stageFor(seg.name).parallax.bg;
    bgLayer.camera = { enabled: true, base: { x: 0, y: 0, scale: 1 }, keys: camKeys };
    validateParallax(bgLayer);
    for (const { layer, depthKey, parallax, customDepth } of seg.actors) {
      const actorLayer = document.layers[layer];
      if (actorLayer) {
        actorLayer.parentId = seg.layerId;
        actorLayer.parentInverse = inverse(worldMatrix(document.layers, seg.layerId, actorLayer.asset.from));
        actorLayer.depth = customDepth ?? parallax[depthKey] ?? 1;
        validateParallax(actorLayer);
      }
    }
  }

  validateDocument(document, duration);
  const subtitleCues = (cues.length ? cues : beats).map((entry, bi) => {
    const b = plan.beats[bi];
    const beatSp = typeof b?.speech === 'object' ? b.speech : null;
    const cutSp = (b?.cuts ?? []).map(c => (typeof c.speech === 'object' ? c.speech : null)).find(Boolean) ?? null;
    const spAlias = b?.speaker ?? beatSp?.who ?? (b?.cuts ?? []).find(c => c.speaker)?.speaker ?? cutSp?.who ?? null;
    const castInfo = spAlias ? plan.cast[spAlias] : null;
    const hasQuotedSpeech = extractQuotedDialogueSegments(b?.quote).some(s => s.quoted);
    const speakerName = hasQuotedSpeech ? (beatSp?.title ?? cutSp?.title ?? castInfo?.name ?? null) : null;
    const speakerColor = hasQuotedSpeech ? (beatSp?.color ?? cutSp?.color ?? castInfo?.color ?? null) : null;
    return {
      ...(cues.length ? structuredClone(entry) : { cueId: `${plan.id}-${entry.id}`, from: entry.from, to: entry.to, text: entry.quote }),
      ...(speakerName ? { speakerName } : {}),
      ...(speakerColor ? { speakerColor } : {}),
      ...(b?.highlightColor ? { highlightColor: b.highlightColor } : {}),
    };
  });
  return {
    source: {
      id: plan.id, title: plan.title ?? plan.id, duration, kind: 'created', fps: plan.timing?.fps ?? 30,
      cues: structuredClone(cues),
      subtitleCues,
      ...(plan.captionStyle ? { captionStyle: plan.captionStyle } : {}),
      ...(audioTracks.length ? { audioTracks } : {}),
      ...(panels.length ? { panels } : {}),
      ...(effects.length ? { effects } : {}),
      shots: flatCuts.map(fc => ({ from: fc.from, to: fc.to, label: fc.beat.cuts ? `${fc.beat.id}.${fc.ci + 1}` : fc.beat.id })),
      scenePlan: { version: PLAN_VERSION, digest: planDigest(plan), timingMode, plan: structuredClone(plan) },
    },
    document,
    warnings: [...built.warnings, ...planWarnings],
  };
}

/** Both phases with injected catalog, timing resolver, audio presets and prepare function. */
export async function buildScene(plan, { catalog, prepareSelections, prepareAudio, prepareAudioPreset: customAudioPreset, mediaDirectory, stage, registry, translations }) {
  validatePlan(plan);
  const timed = plan.timing ? await resolvePlanTiming(plan, { prepareAudio }) : { plan, cues: [], timingMode: 'draft' };
  const fps = timed.plan.timing?.fps ?? 30;
  const totalDuration = timed.plan.beats.reduce((n, b) => n + b.frames, 0);
  const prepAudio = customAudioPreset ?? prepareAudioPreset;
  const audioTracks = [];
  if (timed.plan.bgm) {
    const bSpec = typeof timed.plan.bgm === 'string' ? { preset: timed.plan.bgm } : timed.plan.bgm;
    const prepared = await prepAudio(bSpec.preset, { kind: 'bgm', mediaDirectory });
    audioTracks.push({
      id: `${plan.id}-bgm`,
      role: 'bgm',
      preset: bSpec.preset,
      from: 0,
      to: totalDuration,
      publicPath: prepared.publicPath,
      ...(prepared.contentHash ? { contentHash: prepared.contentHash } : {}),
      volume: bSpec.volume ?? BGM_DEFAULT_VOLUME,
      duckVolume: bSpec.duckVolume ?? BGM_DEFAULT_DUCK_VOLUME,
      fadeIn: bSpec.fadeIn ?? 12,
      fadeOut: bSpec.fadeOut ?? 18,
    });
  }
  let cursor = 0;
  for (let bi = 0; bi < timed.plan.beats.length; bi++) {
    const beat = timed.plan.beats[bi];
    const cuts = expandBeatCuts(beat);
    for (let ci = 0; ci < cuts.length; ci++) {
      const cut = cuts[ci], from = cursor; cursor += cut.frames;
      if (cut.sfx) {
        const list = Array.isArray(cut.sfx) ? cut.sfx : [cut.sfx];
        for (let si = 0; si < list.length; si++) {
          const sSpec = typeof list[si] === 'string' ? { preset: list[si] } : list[si];
          const prepared = await prepAudio(sSpec.preset, { kind: 'sfx', mediaDirectory });
          const sFrom = from + Math.min(sSpec.at ?? 0, Math.max(0, cut.frames - 3));
          const sDurFrames = Math.max(12, Math.ceil((prepared.durationSec ?? 1.5) * fps));
          const sTo = Math.min(totalDuration, sFrom + sDurFrames);
          audioTracks.push({
            id: `${plan.id}-b${bi}-c${ci}-sfx${si}`,
            role: 'sfx',
            preset: sSpec.preset,
            from: sFrom,
            to: sTo,
            publicPath: prepared.publicPath,
            ...(prepared.contentHash ? { contentHash: prepared.contentHash } : {}),
            volume: sSpec.volume ?? SFX_DEFAULT_VOLUMES[sSpec.preset] ?? 0.85,
          });
        }
      }
    }
  }
  const resolved = resolvePlan(timed.plan, catalog, { translations }), selections = await prepareSelections(resolved.requests);
  return { ...compilePlan(timed.plan, resolved, selections, { stage, registry, cues: timed.cues, timingMode: timed.timingMode, audioTracks }), resolved, timingMode: timed.timingMode };
}
