import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyFramingPreset,
  detectFramingPreset,
  applyFocusToLayer,
  clearFocusAtFrame,
} from './framing-presets.mjs';
import { validateDocument, valueAt } from './model.mjs';
import { libraryPlugin } from './library-server.mjs';

function makeDoc() {
  return {
    version: 1,
    revision: 0,
    layers: {
      'S01/shot-0/bg': {
        asset: {
          name: 'Nền phố',
          type: 'backgrounds',
          from: 0,
          to: 120,
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          parts: [{ src: 'library-assets/' + 'a'.repeat(64) + '.png', left: 0, top: 0, width: 1920, height: 1080 }],
        },
        base: { z: 0 },
      },
      'S01/shot-0/hero': {
        asset: {
          name: 'Naruto · 站立',
          type: 'characters',
          from: 0,
          to: 120,
          left: 400,
          top: 260,
          width: 400,
          height: 720,
          parts: [{ src: 'library-assets/' + 'b'.repeat(64) + '.png', left: 0, top: 0, width: 400, height: 720 }],
        },
        base: { x: 0, y: 0, scale: 1, z: 120 },
      },
      'S01/shot-0/ally': {
        asset: {
          name: 'Jiraiya · 站立',
          type: 'characters',
          from: 0,
          to: 120,
          left: 900,
          top: 260,
          width: 400,
          height: 720,
          parts: [{ src: 'library-assets/' + 'c'.repeat(64) + '.png', left: 0, top: 0, width: 400, height: 720 }],
        },
        base: { x: 0, y: 0, scale: 1, z: 110 },
      },
      'S01/shot-60/late-prop': {
        asset: {
          name: 'Cuộn giấy',
          type: 'props',
          from: 60,
          to: 120,
          left: 800,
          top: 600,
          width: 200,
          height: 200,
          parts: [{ src: 'library-assets/' + 'd'.repeat(64) + '.png', left: 0, top: 0, width: 200, height: 200 }],
        },
        base: { z: 105 },
      },
    },
  };
}

test('applyFramingPreset switches cleanly between full, bust, and portrait and passes validateDocument', () => {
  const doc = makeDoc();
  assert.equal(detectFramingPreset(doc.layers['S01/shot-0/hero'], 0), 'full');

  const bustDoc = applyFramingPreset(doc, 'S01/shot-0/hero', 'bust', 0);
  assert.doesNotThrow(() => validateDocument(bustDoc, 120));
  assert.equal(detectFramingPreset(bustDoc.layers['S01/shot-0/hero'], 0), 'bust');

  const portraitDoc = applyFramingPreset(bustDoc, 'S01/shot-0/hero', 'portrait', 0);
  assert.doesNotThrow(() => validateDocument(portraitDoc, 120));
  assert.equal(detectFramingPreset(portraitDoc.layers['S01/shot-0/hero'], 0), 'portrait');

  // Verify X is preserved while scale grows for portrait
  assert.equal(valueAt(portraitDoc.layers['S01/shot-0/hero'], 0).x, 0);
  assert(portraitDoc.layers['S01/shot-0/hero'].base.scale > 1.5);

  // Keyframed character shifts relative y/scale keys cleanly without dropping keyframes
  const keyedDoc = makeDoc();
  keyedDoc.layers['S01/shot-0/hero'].keys = {
    y: [
      { frame: 0, value: 0, easing: 'linear' },
      { frame: 30, value: -20, easing: 'smooth' },
    ],
    scale: [
      { frame: 0, value: 1, easing: 'linear' },
      { frame: 30, value: 1.05, easing: 'smooth' },
    ],
  };
  const keyedPortrait = applyFramingPreset(keyedDoc, 'S01/shot-0/hero', 'portrait', 0);
  assert.doesNotThrow(() => validateDocument(keyedPortrait, 120));
  assert.equal(detectFramingPreset(keyedPortrait.layers['S01/shot-0/hero'], 0), 'portrait');
  assert.equal(keyedPortrait.layers['S01/shot-0/hero'].keys.y.length, 2);
  assert.equal(
    keyedPortrait.layers['S01/shot-0/hero'].keys.y[1].value - keyedPortrait.layers['S01/shot-0/hero'].keys.y[0].value,
    -20
  );
});

test('applyFocusToLayer dims non-focused visible actors without deleting them, leaves bg/out-of-range untouched, and clearFocusAtFrame restores sharpness', () => {
  const doc = makeDoc();
  const focused = applyFocusToLayer(doc, 'S01/shot-0/hero', 10);
  assert.doesNotThrow(() => validateDocument(focused, 120));

  assert.equal(focused.layers['S01/shot-0/hero'].dimmed, false);
  assert.equal(focused.layers['S01/shot-0/ally'].dimmed, true);
  assert(focused.layers['S01/shot-0/ally'].base.z <= 95);
  assert.equal(focused.layers['S01/shot-0/bg'].dimmed, undefined);
  assert.equal(focused.layers['S01/shot-60/late-prop'].dimmed, undefined, 'out-of-range layer at frame 10 is untouched');

  const cleared = clearFocusAtFrame(focused, 10);
  assert.doesNotThrow(() => validateDocument(cleared, 120));
  assert.equal(cleared.layers['S01/shot-0/hero'].dimmed, undefined);
  assert.equal(cleared.layers['S01/shot-0/ally'].dimmed, undefined);
  assert.equal(cleared.layers['S01/shot-0/ally'].base.z, 100);
});

test('libraryPlugin exposes /api/library/psd-archive/search and Origin-guarded extract', async () => {
  const middlewares = [];
  libraryPlugin().configureServer({
    middlewares: {
      use(prefix, fn) {
        middlewares.push({ prefix, fn });
      },
    },
  });
  const server = http.createServer((req, res) => {
    const match = middlewares.find((m) => req.url.startsWith(m.prefix));
    if (!match) {
      res.writeHead(404);
      return res.end('not found');
    }
    const origUrl = req.url;
    req.url = req.url.slice(match.prefix.length) || '/';
    match.fn(req, res, () => {
      req.url = origUrl;
      res.writeHead(404);
      res.end('next');
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const searchRes = await fetch(`http://127.0.0.1:${port}/api/library/psd-archive/search?q=%E9%B8%A3%E4%BA%BA&limit=3`);
    assert.equal(searchRes.status, 200);
    const searchData = await searchRes.json();
    assert(Array.isArray(searchData.items));
    assert(searchData.archiveTotal > 0);
    if (searchData.items.length > 0) {
      assert(searchData.items[0].thumbUrl.startsWith('/api/library/psd-archive/thumb?id='));
    }

    const badOriginRes = await fetch(`http://127.0.0.1:${port}/api/library/psd-archive/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: JSON.stringify({ id: 'psd_test' }),
    });
    assert.equal(badOriginRes.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Pro NLE Director UI shell contracts are clean and free of legacy EP01 defaults', () => {
  const dir = import.meta.dirname;
  const html = readFileSync(resolve(dir, 'index.html'), 'utf8');
  assert.match(html, /Doyin Studio/);
  assert.doesNotMatch(html, /Nhật Thành · Chỉnh video/);

  for (const file of [
    'StudioIcons.tsx',
    'ShortcutsDialog.tsx',
    'StudioHeader.tsx',
    'QuickAuthoring.tsx',
    'StudioTimeline.tsx',
    'TransportControls.tsx',
    'AssetBrowser.tsx',
    'useWorkspacePanels.tsx',
    'App.tsx',
    'studio-pro.css',
  ]) {
    assert.ok(existsSync(resolve(dir, file)), `Missing UI file: ${file}`);
  }

  const assetBrowser = readFileSync(resolve(dir, 'AssetBrowser.tsx'), 'utf8');
  assert.match(assetBrowser, /useState\('all'\)/);
  assert.match(assetBrowser, /proMode\s*=\s*false/);
  assert.match(assetBrowser, /\(proMode\|\|mode==='discover'\)/);

  const header = readFileSync(resolve(dir, 'StudioHeader.tsx'), 'utf8');
  assert.match(header, /onToggleProMode/);
  assert.match(header, /studio-overflow-menu/);

  const quick = readFileSync(resolve(dir, 'QuickAuthoring.tsx'), 'utf8');
  assert.match(quick, /proMode\s*=\s*false/);
  assert.match(quick, /scene-cues-list/);
  assert.match(quick, /framing-segmented/);

  const timeline = readFileSync(resolve(dir, 'StudioTimeline.tsx'), 'utf8');
  assert.match(timeline, /proMode\s*=\s*false/);
  assert.match(timeline, /showInlineKeyframes/);

  const app = readFileSync(resolve(dir, 'App.tsx'), 'utf8');
  assert.match(app, /import '\.\/studio-pro\.css'/);
  assert.match(app, /ShortcutsDialog/);
});
