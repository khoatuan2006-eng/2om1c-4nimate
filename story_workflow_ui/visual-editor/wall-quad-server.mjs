import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsonResponse } from './http-policy.mjs';
import { applyWallHudToScene } from './apply-wall-hud-to-s05.mjs';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const CONFIG_PATH = resolve(__dirname, 'wall_quad_config.json');
const HTML_PATH = resolve(__dirname, 'wall-aligner.html');

export function wallQuadPlugin() {
  return {
    name: 'wall-quad-api',
    configureServer({ middlewares }) {
      middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];

        // Serve interactive HTML tool
        if (pathname === '/wall-aligner' || pathname === '/wall-aligner.html') {
          try {
            const html = await readFile(HTML_PATH, 'utf8');
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Length': Buffer.byteLength(html)
            });
            res.end(html);
            return;
          } catch (e) {
            return jsonResponse(res, 500, { error: 'Không đọc được file giao diện: ' + e.message });
          }
        }

        if (pathname !== '/api/wall-quad') return next();

        if (req.method === 'GET') {
          try {
            const raw = await readFile(CONFIG_PATH, 'utf8');
            return jsonResponse(res, 200, JSON.parse(raw));
          } catch (e) {
            return jsonResponse(res, 500, { error: e.message });
          }
        }

        if (req.method === 'POST') {
          try {
            let raw = '';
            for await (const chunk of req) {
              raw += chunk;
              if (raw.length > 1e6) throw Error('Dữ liệu quá lớn');
            }
            const data = JSON.parse(raw);
            await writeFile(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
            const result = await applyWallHudToScene(data);
            return jsonResponse(res, 200, { ok: true, result });
          } catch (e) {
            console.error('Error applying wall quad:', e);
            return jsonResponse(res, 400, { error: e.message });
          }
        }

        return jsonResponse(res, 405, { error: 'Method not allowed' });
      });
    }
  };
}