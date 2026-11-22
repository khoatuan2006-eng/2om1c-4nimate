import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScene } from './scene-plan.mjs';
import { validateDocument, valueAt } from './model.mjs';
import { validateParallax } from './parallax.mjs';
import { splitSpeechChunks, allocateChunkSpans, locateQuoteSpan, weightedChunkAt, extractQuotedDialogueSegments, splitSubtitleSegments } from './fx-presets.mjs';

const h = (c) => c.repeat(64);
const item = (id, name, extra = {}) => ({ id: h(id), name, width: 100, height: 100, bbox: [0, 0, 100, 100], ...extra });
const catalog = [
  { id: 'bg/onsen', name: 'Suối nước nóng', type: 'backgrounds', collection: 'imports', canvas: [1920, 1080], groups: { layers: [item('1', 'nền')] } },
  { id: 'prop/kurama', name: 'Cửu Vĩ', type: 'props', collection: 'imports', canvas: [800, 600], groups: { layers: [item('k', 'kurama')] } },
  {
    id: 'char/naruto',
    name: 'Naruto',
    type: 'characters',
    collection: 'imports',
    canvas: [800, 1200],
    groups: {
      poses: [item('2', '站立'), item('3', '举起拳头')],
      faces: [item('4', '严肃', { style: 'detailed' }), item('5', '大喊', { style: 'detailed' })],
    },
  },
  {
    id: 'char/jiraiya',
    name: 'Jiraiya',
    type: 'characters',
    collection: 'imports',
    canvas: [800, 1200],
    groups: {
      poses: [item('6', '站立'), item('7', '抱头')],
      faces: [],
    },
  },
];

function makePrepare(bgRel, charRel) {
  return async (requests) =>
    Object.fromEntries(
      Object.entries(requests).map(([key, r]) => {
        const owner = catalog.find((a) => a.id === r.catalogId);
        const isBg = owner.type === 'backgrounds' || owner.type === 'props';
        return [
          key,
          {
            name: owner.name,
            type: owner.type,
            width: isBg ? 1920 : 400,
            height: isBg ? 1080 : 1000,
            parts: [{ src: isBg ? bgRel : charRel, left: 0, top: 0, width: isBg ? 1920 : 400, height: isBg ? 1080 : 1000 }],
          },
        ];
      })
    );
}

test('splitSpeechChunks & allocateChunkSpans break long lines into balanced lossless turns', () => {
  const shortText = 'Mau xuống ngâm mình đi!';
  assert.deepEqual(splitSpeechChunks(shortText, 58), [shortText]);

  // Must NOT break prematurely at ellipsis followed by lowercase continuation (`... đã`)
  const ellipsisLine = 'Tiên nhân háo sắc, cha mẹ con... đã từng gây hại cho làng Lá sao?';
  const ellipsisChunks = splitSpeechChunks(ellipsisLine, 58);
  assert.equal(ellipsisChunks.join(' '), ellipsisLine);
  assert.equal(ellipsisChunks.length, 2);
  assert(ellipsisChunks[0].length >= 24 && ellipsisChunks[1].length >= 24, `balanced halves expected: ${JSON.stringify(ellipsisChunks)}`);

  // Breaks cleanly at comma clause, never mid-phrase (`luôn | bài xích`)
  const longText =
    'Vậy tại sao người trong làng lại luôn bài xích, chuyện gì cũng làm khó dễ đứa con của anh hùng như con?!';
  const chunks = splitSpeechChunks(longText, 58);
  assert.equal(chunks.length, 2, `expected 2 clean clause turns, got ${JSON.stringify(chunks)}`);
  assert.equal(chunks[0], 'Vậy tại sao người trong làng lại luôn bài xích,');
  assert.equal(chunks[1], 'chuyện gì cũng làm khó dễ đứa con của anh hùng như con?!');
  assert.equal(chunks.join(' '), longText);

  // Lossless across a 474-char Naruto monologue
  const mono =
    'Cửu Vĩ là do cha mẹ con rước tới sao? Nếu không có sự hy sinh của cha mẹ con, liệu làng Lá có thể có được cuộc sống yên bình như ngày hôm nay không? Cha mẹ con đã dùng tính mạng để bảo vệ làng Lá, vốn tưởng người trong làng sẽ đối xử tốt với con, nhưng thực tế thì sao? Họ trút hết sự căm hận đối với Cửu Vĩ lên người con, như vậy có công bằng với con không? Chút tiền trợ cấp ba bữa đói ba bữa no của bọn họ, chẳng qua chỉ là để giữ lại Cửu Vĩ — một sức mạnh chiến đấu khủng khiếp mà thôi!';
  const monoChunks = splitSpeechChunks(mono, 58);
  assert(monoChunks.length >= 7);
  assert.equal(monoChunks.join(' '), mono);

  const spans = allocateChunkSpans(chunks, 100, 220, 2);
  assert.equal(spans.length, chunks.length);
  assert.equal(spans[0].from, 100);
  assert.equal(spans.at(-1).to, 220);
  for (let i = 0; i < spans.length; i++) {
    assert(spans[i].to > spans[i].from);
    if (i > 0) assert(spans[i].from >= spans[i - 1].to);
  }
});

test('locateQuoteSpan & weightedChunkAt align exact sub-quotes and proportional subtitle turns', () => {
  const quote = 'Jiraiya vẫy tay gọi: Naruto, ngây ra đó làm gì? Mau xuống ngâm mình đi!';
  const speechText = 'Naruto, ngây ra đó làm gì? Mau xuống ngâm mình đi!';
  const span = locateQuoteSpan(quote, speechText);
  assert(span && span.exact, 'should find exact normalized span inside beat.quote');
  assert(span.startRatio > 0.2 && span.startRatio < 0.45);
  assert.equal(span.endRatio, 1);

  const partial = locateQuoteSpan(
    'Naruto nói: Cha mẹ con đã dùng tính mạng để bảo vệ làng Lá, nhưng thực tế thì sao? Sau đó cậu im lặng.',
    'Cha mẹ con đã dùng tính mạng để bảo vệ làng Lá, nhưng thực tế thì sao?'
  );
  assert(partial && partial.exact);
  assert(partial.startRatio > 0.05 && partial.endRatio < 0.9);

  const chunks = ['Một câu rất ngắn.', 'Còn đây là một câu thoại dài hơn rất nhiều so với câu đầu tiên để kiểm tra tỷ lệ!'];
  const at30 = weightedChunkAt(chunks, 0.30);
  assert.equal(at30.index, 1, 'should already be in longer second chunk at 30%');
});

test('beat-level speech with fromQuote persists across multi-cut angle changes & prop-anchored speech attaches to prop X/Y', async () => {
  const bgRel = `library-assets/${h('b')}.png`;
  const charRel = `library-assets/${h('c')}.png`;
  const monoQuote = '"Ông ấy có ơn với ta! Với cha mẹ ta cũng vô cùng quan tâm, chiếu cố! Không được phép ra tay với ông ấy dù chỉ một sợi lông!"';
  const stripped = monoQuote.slice(1, -1);
  const propQuote = '"Làm cái gì thế hả Jiraiya? Sao lại ra tay với thằng bé Naruto?"';

  const plan = {
    version: 1,
    id: 'beat-speech-sync',
    title: 'Beat-level Speech & Prop Speaker',
    location: { asset: 'Suối nước nóng' },
    persistStage: true,
    cast: {
      jiraiya: { asset: 'Jiraiya' },
      naruto: { asset: 'Naruto', faceStyle: 'detailed' },
    },
    beats: [
      {
        id: 'b1',
        quote: monoQuote,
        frames: 240,
        speech: { who: 'naruto', variant: 'shout', fromQuote: true, maxChars: 56 },
        cuts: [
          {
            ratio: 1,
            angle: 'ots',
            actors: [
              { who: 'jiraiya', pose: '站立', at: 'left', look: 'right' },
              { who: 'naruto', pose: '举起拳头', face: '大喊', at: 'right', faceTo: 'jiraiya', emote: 'anger' },
            ],
          },
          {
            // Reaction shot on off-stage listener Jiraiya while Naruto speaks off-screen: bubble must avoid Jiraiya (x=620)
            ratio: 1,
            angle: 'reverse',
            focus: 'jiraiya',
            actors: [
              { who: 'jiraiya', pose: '抱头', faceTo: 'naruto' },
            ],
          },
          {
            ratio: 1,
            angle: 'reverse',
            actors: [
              { who: 'naruto', pose: '举起拳头', face: '大喊', faceTo: 'jiraiya' },
            ],
          },
        ],
      },
      {
        id: 'b2',
        quote: propQuote,
        frames: 150,
        shot: 'wide',
        speech: { prop: 'kurama_prop', title: 'Cửu Vĩ', fromQuote: true, maxChars: 56 },
        props: [{ id: 'kurama_prop', prop: 'Cửu Vĩ', at: 'far-left', y: 900, height: 500 }],
        actors: [{ who: 'naruto', pose: '站立', face: '严肃', at: 'right', look: 'left' }],
      },
    ],
  };

  const out = await buildScene(plan, {
    catalog,
    prepareSelections: makePrepare(bgRel, charRel),
  });

  // Beat 1 panels must span all 3 cuts [0..80), [80..160) reaction on Jiraiya, and [160..240) reverse Naruto
  const b1Panels = out.source.panels.filter((p) => p.id.startsWith('beat-speech-sync-b1-'));
  assert(b1Panels.length >= 3, `expected >= 3 sequential segments across cuts, got ${b1Panels.length}`);
  assert.equal(b1Panels[0].from, 0);
  assert.equal(b1Panels.at(-1).to, 240);
  const reactPanels = b1Panels.filter((p) => p.from >= 80 && p.to <= 160);
  assert(reactPanels.length >= 1, 'reaction cut during off-screen speech must still show bubble');
  for (const rp of reactPanels) assert(rp.left >= 620 + 115, `reaction bubble (${rp.left}) must clear listening Jiraiya at x=620`);
  assert(b1Panels.some((p) => p.from >= 160), 'speech panels must continue into third cut (angle: reverse Naruto)');
  const dedupTexts = [...new Set(b1Panels.map((p) => p.text))];
  assert.equal(dedupTexts.join(' '), stripped, '100% of beat.quote must survive across chunks without losing any word');
  for (const p of b1Panels.filter((x) => !x.noTail)) {
    assert(typeof p.tailTipX === 'number' && typeof p.tailTipY === 'number');
  }
  const n0 = out.document.layers['beat-speech-sync/shot-0/op-b0c0-naruto'];
  const n1 = out.document.layers['beat-speech-sync/shot-160/op-b0c2-naruto'];
  assert((n0.keys?.y?.length ?? 0) >= 6, 'cut 0 speaking actor must have talk-excited y keyframes');
  assert((n1.keys?.y?.length ?? 0) >= 6, 'cut 2 speaking actor must retain talk-excited y keyframes');

  // Beat 2 prop-anchored speaker should point tail at prop X (far-left = 320), not Naruto (1360)
  const b2Panels = out.source.panels.filter((p) => p.id.startsWith('beat-speech-sync-b2-'));
  assert(b2Panels.length >= 2);
  for (const p of b2Panels) {
    assert.equal(p.title, 'Cửu Vĩ');
    assert.equal(p.tailTipX, 320);
  }
});

test('dialogue actors automatically face each other across wide/OTS/reverse cuts and toward speaking props', async () => {
  const bgRel = `library-assets/${h('b')}.png`;
  const charRel = `library-assets/${h('c')}.png`;
  const plan = {
    version: 1,
    id: 'mutual-facing',
    title: 'Mutual Facing Verification',
    location: { asset: 'Suối nước nóng' },
    persistStage: true,
    cast: {
      jiraiya: { asset: 'Jiraiya' },
      naruto: { asset: 'Naruto', faceStyle: 'detailed' },
    },
    beats: [
      {
        id: 'b1',
        quote: '"Chào ngươi!"',
        frames: 150,
        cuts: [
          {
            // No explicit look/faceTo on Naruto on the right -> must auto-flip left toward Jiraiya
            ratio: 1,
            shot: 'wide',
            actors: [
              { who: 'jiraiya', pose: '站立', at: 'left' },
              { who: 'naruto', pose: '站立', face: '严肃', at: 'right' },
            ],
          },
          {
            // OTS onto Naruto on right -> Naruto flips left, foreground shoulder on left faces right
            ratio: 1,
            angle: 'ots',
            speaker: 'naruto',
            speech: { who: 'naruto', text: 'Ngươi nói gì?' },
            actors: [
              { who: 'naruto', pose: '站立', face: '大喊' },
            ],
          },
          {
            // Reverse solo on Naruto -> Naruto keeps facing left across frame toward Jiraiya
            ratio: 1,
            angle: 'reverse',
            speaker: 'naruto',
            actors: [
              { who: 'naruto', pose: '站立', face: '大喊' },
            ],
          },
        ],
      },
      {
        id: 'b2',
        quote: '"Cửu Vĩ lên tiếng."',
        frames: 60,
        solo: true,
        shot: 'wide',
        speech: { prop: 'kurama_prop', title: 'Cửu Vĩ', fromQuote: true },
        props: [{ id: 'kurama_prop', prop: 'Cửu Vĩ', at: 'far-left', y: 900, height: 500 }],
        actors: [{ who: 'naruto', pose: '站立', face: '严肃', at: 'right' }],
      },
    ],
  };

  const out = await buildScene(plan, {
    catalog,
    prepareSelections: makePrepare(bgRel, charRel),
  });

  // Cut 0 (wide): Jiraiya (left) faces right (flipX=false), Naruto (right) faces left (flipX=true)
  assert.equal(out.document.layers['mutual-facing/shot-0/op-b0c0-jiraiya'].base.flipX, false);
  assert.equal(out.document.layers['mutual-facing/shot-0/op-b0c0-naruto'].base.flipX, true);

  // Cut 1 (OTS): foreground Jiraiya on left faces right (flipX=false), Naruto on right faces left (flipX=true)
  assert.equal(out.document.layers['mutual-facing/shot-50/op-b0c1-jiraiya'].base.flipX, false);
  assert.equal(out.document.layers['mutual-facing/shot-50/op-b0c1-naruto'].base.flipX, true);

  // Cut 2 (Reverse solo): Naruto faces left toward off-screen Jiraiya (flipX=true)
  assert.equal(out.document.layers['mutual-facing/shot-100/op-b0c2-naruto'].base.flipX, true);

  // Beat 2 (solo with speaking prop on left): Naruto on right faces left toward Kurama (flipX=true)
  assert.equal(out.document.layers['mutual-facing/shot-150/op-b1-naruto'].base.flipX, true);
});

test('speaking & speaker compile to lively talk keyframes, multi-turn anchored speech bubbles, bold dialogue angles & emotes', async () => {
  const bgRel = `library-assets/${h('b')}.png`;
  const charRel = `library-assets/${h('c')}.png`;
  const plan = {
    version: 1,
    id: 'dialogue-upgrade',
    title: 'Dialogue & Angles',
    location: { asset: 'Suối nước nóng' },
    persistStage: true,
    cast: {
      jiraiya: { asset: 'Jiraiya' },
      naruto: { asset: 'Naruto', faceStyle: 'detailed' },
    },
    beats: [
      {
        id: 'b1',
        quote: 'Test beat one',
        frames: 180,
        cuts: [
          {
            ratio: 1,
            shot: 'wide',
            actors: [
              { who: 'jiraiya', pose: '站立', at: 'left', look: 'right' },
              { who: 'naruto', pose: '站立', face: '严肃', at: 'right', faceTo: 'jiraiya' },
            ],
          },
          {
            ratio: 2,
            angle: 'ots',
            speaker: 'naruto',
            speech: {
              who: 'naruto',
              variant: 'shout',
              maxChars: 42,
              text: 'Vậy tại sao người trong làng lại luôn bài xích, chuyện gì cũng làm khó dễ con?!',
            },
            actors: [
              { who: 'naruto', pose: '举起拳头', face: '大喊', emote: 'anger' },
            ],
          },
          {
            ratio: 1,
            angle: 'reverse',
            speaker: 'jiraiya',
            speech: { who: 'jiraiya', variant: 'thought', text: 'Dự cảm chẳng lành...' },
            actors: [
              { who: 'jiraiya', pose: '抱头', emote: 'shock', faceTo: 'naruto' },
            ],
          },
        ],
      },
      {
        id: 'b2',
        quote: 'Return to wide restores both actors at original positions',
        frames: 60,
        shot: 'medium',
        angle: 'dutch-left',
        actors: [
          { who: 'jiraiya', pose: '站立', at: 'keep', look: 'right', speaking: true },
        ],
      },
    ],
  };

  const out = await buildScene(plan, {
    catalog,
    prepareSelections: makePrepare(bgRel, charRel),
  });

  validateDocument(out.document, out.source.duration);

  // 1. Check lively speaking bounce keyframes on Naruto in OTS cut (b0c1-naruto)
  const narutoOtsKey = Object.keys(out.document.layers).find((k) => k.endsWith('b0c1-naruto'));
  assert(narutoOtsKey, 'Naruto layer should exist in OTS cut');
  const narutoOtsLayer = out.document.layers[narutoOtsKey];
  assert((narutoOtsLayer.keys?.y?.length ?? 0) >= 6, 'talk-excited should generate lively vertical speech keys');
  assert((narutoOtsLayer.keys?.rotation?.length ?? 0) >= 6, 'talk-excited should generate lively tilt keys');
  const yVals = narutoOtsLayer.keys.y.map((k) => k.value);
  assert(Math.max(...yVals) > Math.min(...yVals), 'speaking character y should bounce dynamically');

  // 2. Check OTS foreground shoulder blurred in dimLayerIds + Z > speaker Z
  const shoulderKey = Object.keys(out.document.layers).find((k) => k.endsWith('b0c1-jiraiya'));
  assert(shoulderKey, 'Jiraiya should be carried as foreground OTS shoulder');
  assert(out.document.layers[shoulderKey].base.z > narutoOtsLayer.base.z, 'OTS shoulder must render in front of speaker');
  const otsDof = out.source.effects.find((fx) => fx.kind === 'dof' && fx.dimLayerIds?.includes(shoulderKey));
  assert(otsDof, 'OTS cut must emit DofStyleOverlay blurring the foreground shoulder');

  // 3. Check Reverse solo cut omits Naruto while preserving Naruto in subsequent standard/dutch cut
  const reverseCutLayers = Object.keys(out.document.layers).filter((k) => k.includes('b0c2-'));
  assert.equal(reverseCutLayers.length, 1);
  assert(reverseCutLayers[0].endsWith('jiraiya'));

  const b2NarutoKey = Object.keys(out.document.layers).find((k) => k.includes('b1-naruto'));
  assert(b2NarutoKey, 'Returning after solo reverse cut must preserve Naruto on stage via persistStage');
  const b1NarutoKey = Object.keys(out.document.layers).find((k) => k.endsWith('b0c0-naruto'));
  const origX = valueAt(out.document.layers[b1NarutoKey], 0).x;
  const restoredX = valueAt(out.document.layers[b2NarutoKey], 180).x;
  assert(Math.abs(restoredX - origX) < 10, `expected stage X preserved (${origX} vs ${restoredX})`);

  // 4. Check Dutch angle tilt
  const b2JiraiyaKey = Object.keys(out.document.layers).find((k) => k.includes('b1-jiraiya'));
  assert.equal(out.document.layers[b2JiraiyaKey].base.rotation, -4.5);

  // 5. Check camera black-border safety bounds across every keyframe on bg parallax camera
  const bgLayer = out.document.layers[Object.keys(out.document.layers).find((k) => k.endsWith('/op-bg'))];
  validateParallax(bgLayer);
  for (const k of bgLayer.camera.keys.scale) {
    const xk = bgLayer.camera.keys.x.find((item) => item.frame === k.frame)?.value ?? 0;
    const yk = bgLayer.camera.keys.y.find((item) => item.frame === k.frame)?.value ?? 0;
    assert(Math.abs(xk) <= 960 * (k.value - 1) + 1, `X shift ${xk} exceeds crop at scale ${k.value}`);
    assert(Math.abs(yk) <= 540 * (k.value - 1) + 1, `Y shift ${yk} exceeds crop at scale ${k.value}`);
  }

  // 6. Check Multi-turn speech bubbles & variants + emotes
  const shoutPanels = out.source.panels.filter((p) => p.variant === 'shout');
  assert(shoutPanels.length >= 2, 'long shout dialogue should split into >= 2 sequential turns');
  for (let i = 0; i < shoutPanels.length; i++) {
    assert(shoutPanels[i].to > shoutPanels[i].from);
    assert(typeof shoutPanels[i].tailTipX === 'number' && typeof shoutPanels[i].tailTipY === 'number');
    assert(shoutPanels[i].left >= 60 && shoutPanels[i].left + shoutPanels[i].width <= 1860);
    if (i > 0) assert(shoutPanels[i].from >= shoutPanels[i - 1].to);
  }
  const thoughtPanel = out.source.panels.find((p) => p.variant === 'thought');
  assert(thoughtPanel, 'thought variant bubble should be emitted');

  const emotes = out.source.effects.filter((fx) => fx.kind === 'emote');
  assert.equal(emotes.length, 2);
  assert.deepEqual(emotes.map((e) => e.preset).sort(), ['anger', 'shock']);
});

test('prop enter: drop-in animates from above screen to target Y, and speech bubbles never overlap other actors', async () => {
  const bgRel = `library-assets/${h('b')}.png`;
  const charRel = `library-assets/${h('c')}.png`;
  const plan = {
    version: 1,
    id: 'drop-and-bubbles',
    title: 'Sky Drop & Unambiguous Bubbles',
    location: { asset: 'Suối nước nóng' },
    persistStage: true,
    cast: {
      jiraiya: { asset: 'Jiraiya', name: 'Jiraiya', color: '#0f766e' },
      naruto: { asset: 'Naruto', faceStyle: 'detailed', name: 'Naruto', color: '#ea580c' },
    },
    beats: [
      {
        id: 'b1',
        quote: '"Thầy định chặn con thật sao?!"',
        frames: 72,
        shot: 'close',
        speaker: 'naruto',
        speech: { who: 'naruto', variant: 'shout', fromQuote: true },
        actors: [
          { who: 'jiraiya', pose: '站立', at: 'left' },
          { who: 'naruto', pose: '举起拳头', face: '大喊', at: 'right' },
        ],
      },
      {
        id: 'b2',
        quote: 'Cóc khổng lồ rơi từ trên trời xuống nóc nhà.',
        frames: 72,
        shot: 'wide',
        props: [
          { id: 'sky_toad', prop: 'Cửu Vĩ', at: 1300, y: 540, height: 460, enter: 'drop-in' },
          { id: 'land_toad', prop: 'Cửu Vĩ', at: 1240, y: 950, height: 740, enter: 'drop-in' },
        ],
        actors: [
          { who: 'jiraiya', pose: '抱头', at: 460 },
        ],
      },
      {
        id: 'b3',
        quote: '"Ngươi làm cái gì thế hả Jiraiya?"',
        frames: 60,
        shot: 'wide',
        leaveProps: ['sky_toad'],
        speech: { prop: 'land_toad', title: 'Gamabunta', color: '#991b1b', fromQuote: true },
        actors: [
          { who: 'jiraiya', pose: '抱头', at: 460 },
        ],
      },
    ],
  };

  const out = await buildScene(plan, {
    catalog,
    prepareSelections: makePrepare(bgRel, charRel),
  });
  validateDocument(out.document, out.source.duration);

  // Close-up right speaker bubble inherits cast.name & cast.color, clears left actor (x=560) and keeps tail outside speaker face
  const b1Panel = out.source.panels.find((p) => p.id.includes('-b1-'));
  assert(b1Panel);
  assert.equal(b1Panel.title, 'Naruto');
  assert.equal(b1Panel.speakerColor, '#ea580c');
  assert(b1Panel.left >= 560 + 115, `expected Naruto bubble left (${b1Panel.left}) to clear Jiraiya x=560`);
  assert(b1Panel.tailTipX <= 1360 - 120, `expected close-up tailTipX (${b1Panel.tailTipX}) to stop outside speaker face`);

  // Center-right large prop speaker clears left actor (x=460) and keeps tail above prop headTopY (210)
  const b3Panel = out.source.panels.find((p) => p.id.includes('-b3-'));
  assert(b3Panel);
  assert.equal(b3Panel.title, 'Gamabunta');
  assert.equal(b3Panel.speakerColor, '#991b1b');
  assert(b3Panel.left >= 460 + 115, `expected Gamabunta bubble left (${b3Panel.left}) to clear Jiraiya x=460`);
  assert(b3Panel.tailTipY <= 210 - 18, `expected Gamabunta tailTipY (${b3Panel.tailTipY}) to stop above headTopY=210`);

  // Sky drop & land drop Y keyframes start off-screen above and converge onto layer.base.y
  const skyLayer = out.document.layers['drop-and-bubbles/shot-72/op-b1-prop0'];
  const landLayer = out.document.layers['drop-and-bubbles/shot-72/op-b1-prop1'];
  const skyBaseY = skyLayer.base?.y ?? 0;
  const landBaseY = landLayer.base?.y ?? 0;
  assert(skyLayer.keys.y[0].value <= skyBaseY - 600, `sky drop must start off-screen top, got ${skyLayer.keys.y[0].value} vs base ${skyBaseY}`);
  assert(landLayer.keys.y[0].value <= landBaseY - 700, `land drop must start off-screen top, got ${landLayer.keys.y[0].value} vs base ${landBaseY}`);
  const midLand = valueAt(landLayer, 92);
  assert(Math.abs(midLand.y - landBaseY) <= 2, `land drop should settle on base.y=${landBaseY}, got ${midLand.y}`);
});

test('extractQuotedDialogueSegments, splitSubtitleSegments & fromQuote separate dialogue bubbles/subtitles from narration', async () => {
  const mixedQuote = 'Tâm trạng của Naruto, Cửu Vĩ hiểu rõ nhất: "Lão gia ta đây đứng trên đỉnh cao, ngươi xứng sao?" Cửu Vĩ gầm lên rồi quay mặt đi.';
  const qSegs = extractQuotedDialogueSegments(mixedQuote);
  assert.equal(qSegs.length, 1);
  assert.equal(qSegs[0].quoted, true);
  assert.equal(qSegs[0].text, 'Lão gia ta đây đứng trên đỉnh cao, ngươi xứng sao?');
  assert(qSegs[0].startRatio > 0.25 && qSegs[0].endRatio < 0.85, `expected middle span, got ${JSON.stringify(qSegs[0])}`);

  // Multiple quotes inside one beat must preserve strictly increasing spans
  const twoQuotes = '"Câu thứ nhất!" Sau đó dẫn truyện xen giữa. "Câu thứ nhất!"';
  const twoSegs = extractQuotedDialogueSegments(twoQuotes);
  assert.equal(twoSegs.length, 2);
  assert(twoSegs[1].startRatio > twoSegs[0].endRatio);

  // Fallback for quote without quotation marks
  const plainSegs = extractQuotedDialogueSegments('Không có ngoặc kép ở đây.');
  assert.equal(plainSegs.length, 1);
  assert.equal(plainSegs[0].quoted, false);

  // splitSubtitleSegments never mixes dialogue and narration in the same subtitle line
  const subSegs = splitSubtitleSegments(mixedQuote, 68);
  assert(subSegs.length >= 3);
  assert.equal(subSegs[0].kind, 'narration');
  assert(!subSegs[0].text.includes('"'));
  const diagChunks = subSegs.filter((s) => s.kind === 'dialogue');
  assert(diagChunks.length >= 1);
  for (const dc of diagChunks) {
    assert(dc.text.startsWith('"') && dc.text.endsWith('"'));
    assert(!dc.text.includes('Cửu Vĩ hiểu rõ nhất'));
    assert(!dc.text.includes('quay mặt đi'));
  }
  assert.equal(subSegs.at(-1).kind, 'narration');

  // End-to-end buildScene with mixed narration + quoted dialogue:
  // speech bubble must ONLY show the quoted dialogue during the middle span, NOT narration!
  const bgRel = `library-assets/${h('b')}.png`;
  const charRel = `library-assets/${h('c')}.png`;
  const plan = {
    version: 1,
    id: 'dialogue-vs-narration',
    title: 'Dialogue vs Narration',
    location: { asset: 'Suối nước nóng' },
    persistStage: true,
    cast: {
      naruto: { asset: 'Naruto', faceStyle: 'detailed', name: 'Naruto', color: '#ea580c' },
    },
    beats: [
      {
        id: 'b1',
        quote: '"Ngươi nỡ lòng nào sao?" Naruto đi thẳng tới trước bộ móng vuốt sắc lẹm và kề cổ sát vào mũi nhọn lạnh lẽo.',
        frames: 180,
        shot: 'wide',
        speaker: 'naruto',
        speech: { who: 'naruto', fromQuote: true, maxChars: 56 },
        actors: [{ who: 'naruto', pose: '站立', face: '严肃', at: 'right', look: 'left' }],
      },
    ],
  };

  const out = await buildScene(plan, {
    catalog,
    prepareSelections: makePrepare(bgRel, charRel),
  });
  const spPanels = out.source.panels.filter((p) => p.style === 'speech');
  assert.equal(spPanels.length, 1);
  assert.equal(spPanels[0].text, 'Ngươi nỡ lòng nào sao?');
  assert.equal(spPanels[0].from, 0);
  assert(spPanels[0].to < 80, `expected bubble to disappear before narration finishes (got to=${spPanels[0].to})`);
  assert.equal(out.source.subtitleCues[0].speakerName, 'Naruto');
  assert.equal(out.source.subtitleCues[0].speakerColor, '#ea580c');
});

test('actor.silhouette compiles to a crimson/black silhouette effect and rejects invalid silhouette values', async () => {
  const bgRel = `library-assets/${h('b')}.png`;
  const charRel = `library-assets/${h('c')}.png`;
  const plan = {
    version: 1,
    id: 'silhouette-test',
    title: 'Silhouette Test',
    location: { asset: 'Suối nước nóng' },
    cast: {
      naruto: { asset: 'Naruto', faceStyle: 'detailed' },
    },
    beats: [
      {
        id: 'b1',
        quote: 'Danh sách đen.',
        frames: 90,
        shot: 'wide',
        actors: [{ who: 'naruto', pose: '站立', face: '严肃', at: 'center', silhouette: 'crimson' }],
      },
    ],
  };

  const out = await buildScene(plan, {
    catalog,
    prepareSelections: makePrepare(bgRel, charRel),
  });
  const silFx = out.source.effects.find((fx) => fx.kind === 'silhouette');
  assert(silFx, 'expected a silhouette effect to be emitted');
  assert.equal(silFx.style, 'crimson');
  assert.equal(silFx.layerId, 'silhouette-test/shot-0/op-b0-naruto');

  await assert.rejects(
    () =>
      buildScene(
        {
          ...plan,
          beats: [{ ...plan.beats[0], actors: [{ who: 'naruto', pose: '站立', face: '严肃', silhouette: 'invalid' }] }],
        },
        { catalog, prepareSelections: makePrepare(bgRel, charRel) },
      ),
    /silhouette/i,
  );
});

test('prop.motion throw-right with bounce and prop.trail compiles parabolic arc, bounce settle, sharp z-order and rejects invalid values', async () => {
  const bgRel = `library-assets/${h('b')}.png`;
  const charRel = `library-assets/${h('c')}.png`;
  const plan = {
    version: 1,
    id: 'prop-throw-test',
    title: 'Prop Throw Test',
    location: { asset: 'Suối nước nóng' },
    cast: {
      naruto: { asset: 'Naruto', faceStyle: 'detailed' },
      jiraiya: { asset: 'Jiraiya' },
    },
    beats: [
      {
        id: 'b1',
        quote: 'Chiếc mặt nạ bị ném thẳng về phía cậu.',
        frames: 80,
        shot: 'wide',
        focus: 'naruto',
        props: [
          {
            id: 'mask',
            prop: 'Cửu Vĩ',
            at: 570,
            y: 745,
            height: 195,
            z: 132,
            trail: { color: 'white', copies: 3, step: 1 },
            motion: {
              type: 'throw-right',
              at: 3,
              frames: 16,
              toX: 1410,
              toY: 725,
              arcHeight: 115,
              spin: 380,
              bounce: true,
              groundY: 965,
              bounceX: -220,
            },
          },
        ],
        actors: [
          { who: 'jiraiya', pose: '站立', at: 420, look: 'right' },
          { who: 'naruto', pose: '站立', face: '严肃', at: 1480, look: 'left' },
        ],
      },
    ],
  };

  const out = await buildScene(plan, {
    catalog,
    prepareSelections: makePrepare(bgRel, charRel),
  });
  const propLayerId = 'prop-throw-test/shot-0/op-b0-prop0';
  const propLayer = out.document.layers[propLayerId];
  assert(propLayer, 'expected compiled prop layer');
  assert.equal(propLayer.base.z, 132);

  const dofFx = out.source.effects.find((fx) => fx.kind === 'dof');
  assert(!dofFx || !(dofFx.dimLayerIds ?? []).includes(propLayerId), 'animated thrown prop must stay sharp, not dimmed');

  const trailFx = out.source.effects.find((fx) => fx.kind === 'trail' && fx.layerId === propLayerId);
  assert(trailFx, 'expected trail effect for thrown prop');
  assert.equal(trailFx.color, 'white');
  assert.equal(trailFx.copies, 3);
  assert.equal(trailFx.step, 1);

  assert.equal(valueAt(propLayer, 0).opacity, 0);
  assert.equal(valueAt(propLayer, 3).opacity, 1);

  const bx = propLayer.base.x ?? 0;
  const by = propLayer.base.y ?? 0;
  const mid = valueAt(propLayer, 11);
  const dxMidExpected = bx + (1410 - 570) * 0.5;
  const lineYMid = by + (725 - 745) * 0.5;
  assert(Math.abs(mid.x - dxMidExpected) <= 3, `mid x mismatch: ${mid.x} vs ${dxMidExpected}`);
  assert(mid.y < lineYMid - 95, `expected mid-flight arc peak well above straight line: ${mid.y} vs ${lineYMid}`);
  assert(mid.rotation > 120, `expected mid-flight spin rotation, got ${mid.rotation}`);

  const impact = valueAt(propLayer, 19);
  assert.equal(Math.round(impact.x), Math.round(bx + (1410 - 570)));
  assert.equal(Math.round(impact.y), Math.round(by + (725 - 745)));

  const settled = valueAt(propLayer, 50);
  assert.equal(Math.round(settled.y), Math.round(by + (965 - 745)));
  assert.equal(Math.round(settled.x), Math.round(bx + (1410 - 570 - 220)));

  await assert.rejects(
    () =>
      buildScene(
        {
          ...plan,
          beats: [{ ...plan.beats[0], props: [{ prop: 'Cửu Vĩ', motion: 'teleport' }] }],
        },
        { catalog, prepareSelections: makePrepare(bgRel, charRel) },
      ),
    /prop\.motion/i,
  );
  await assert.rejects(
    () =>
      buildScene(
        {
          ...plan,
          beats: [{ ...plan.beats[0], props: [{ prop: 'Cửu Vĩ', trail: 'neon' }] }],
        },
        { catalog, prepareSelections: makePrepare(bgRel, charRel) },
      ),
    /prop\.trail/i,
  );
});

test('actor.rotate tilts layers and rejects out-of-range angles', async () => {
  const bgRel = `library-assets/${h('b')}.png`;
  const charRel = `library-assets/${h('c')}.png`;
  const plan = {
    version: 1,
    id: 'actor-rotate-test',
    title: 'Actor Rotate Test',
    location: { asset: 'Suối nước nóng' },
    cast: {
      naruto: { asset: 'Naruto', faceStyle: 'detailed' },
      jiraiya: { asset: 'Jiraiya' },
    },
    beats: [
      {
        id: 'b1',
        quote: 'Hai thầy trò tựa lưng vào nhau.',
        frames: 60,
        shot: 'wide',
        actors: [
          { who: 'naruto', pose: '站立', face: '严肃', at: 700, look: 'left', rotate: 7 },
          { who: 'jiraiya', pose: '站立', at: 1030, look: 'right', rotate: -5 },
        ],
      },
    ],
  };

  const out = await buildScene(plan, {
    catalog,
    prepareSelections: makePrepare(bgRel, charRel),
  });
  assert.equal(out.document.layers['actor-rotate-test/shot-0/op-b0-naruto'].base.rotation, 7);
  assert.equal(out.document.layers['actor-rotate-test/shot-0/op-b0-jiraiya'].base.rotation, -5);

  await assert.rejects(
    () =>
      buildScene(
        {
          ...plan,
          beats: [{ ...plan.beats[0], actors: [{ who: 'naruto', pose: '站立', face: '严肃', rotate: 90 }] }],
        },
        { catalog, prepareSelections: makePrepare(bgRel, charRel) },
      ),
    /actor\.rotate/i,
  );
});

test('flashback and flashback-cold mood presets validate, compile, and reject invalid presets', async () => {
  const bgRel = `library-assets/${h('b')}.png`;
  const charRel = `library-assets/${h('c')}.png`;
  const plan = {
    version: 1,
    id: 'flashback-mood-test',
    title: 'Flashback Mood Test',
    location: { asset: 'Suối nước nóng' },
    cast: {
      naruto: { asset: 'Naruto', faceStyle: 'detailed' },
      jiraiya: { asset: 'Jiraiya' },
    },
    beats: [
      {
        id: 'b1',
        quote: 'Ký ức ấm áp bên thầy.',
        frames: 60,
        shot: 'wide',
        mood: 'flashback',
        actors: [{ who: 'jiraiya', pose: '站立', at: 'left' }],
      },
      {
        id: 'b2',
        quote: 'Ký ức lạnh lẽo bị bài xích.',
        frames: 60,
        shot: 'wide',
        mood: { type: 'flashback-cold', opacity: 0.92 },
        actors: [{ who: 'naruto', pose: '站立', face: '严肃', at: 'right' }],
      },
    ],
  };

  const out = await buildScene(plan, {
    catalog,
    prepareSelections: makePrepare(bgRel, charRel),
  });
  const warmMood = out.source.effects.find((fx) => fx.kind === 'mood' && fx.preset === 'flashback');
  const coldMood = out.source.effects.find((fx) => fx.kind === 'mood' && fx.preset === 'flashback-cold');
  assert(warmMood, 'flashback mood should compile to effects');
  assert.equal(warmMood.z, 8200);
  assert(coldMood, 'flashback-cold mood should compile to effects');
  assert.equal(coldMood.z, 8200);
  assert.equal(coldMood.opacity, 0.92);

  await assert.rejects(
    () =>
      buildScene(
        {
          ...plan,
          beats: [{ ...plan.beats[0], mood: 'sepia-unknown' }],
        },
        { catalog, prepareSelections: makePrepare(bgRel, charRel) },
      ),
    /mood/i,
  );
});
