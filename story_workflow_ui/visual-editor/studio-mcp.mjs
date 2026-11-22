import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireStudioProtocol } from './studio-protocol.mjs';

const id = z.string().regex(/^[a-zA-Z0-9-]+$/).max(150), revision = z.number().int().nonnegative();
const object = z.record(z.string(), z.unknown());
export const WORKING_LAYER_V2_TOOLS = Object.freeze([
    'studio_state',
    'studio_catalog_search',
    'studio_asset_sheet',
    'psd_archive_search',
    'psd_archive_thumb',
    'psd_archive_extract',
    'scene_plan_preview',
    'scene_plan_apply',
    'studio_scene_read',
    'studio_preview_capture',
    'studio_capture_image',
    'studio_export_request',
]);
export function createStudioMcp({ baseUrl = 'http://127.0.0.1:3022', projectId, sessionCookie, fetchImpl = fetch, mode = 'full' } = {}) {
    const base = new URL(baseUrl);
    if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw Error('Studio MCP requires a loopback HTTP origin');
    projectId = id.parse(projectId); const projectPath = '/api/projects/' + projectId, workflowPath = '/api/episode-workflows/' + projectId;
    const onlyV2 = mode === 'v2';
    const allow = name => !onlyV2 || WORKING_LAYER_V2_TOOLS.includes(name);
    const server = new McpServer({ name: 'doyin-studio', version: '2.0.0' }, { instructions: 'Operate only on the bound Studio project. Prefer the Working Layer v2 pipeline: studio_state -> studio_catalog_search/studio_asset_sheet -> scene_plan_preview (Tier-1 fast layout check, NOT for review) -> scene_plan_apply (auto-tts/draft + Detach Guard) -> studio_preview_capture/studio_capture_image (Tier-2 Remotion verification). Never write SQLite directly or overwrite detached/locked scenes.' });
    const api = async (path, body, method = body ? 'POST' : 'GET') => {
        const response = await fetchImpl(base.origin + path, { method, redirect: 'error', signal: AbortSignal.timeout(60000), headers: { Origin: base.origin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(sessionCookie ? { Cookie: sessionCookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        const data = await response.json(); if (!response.ok) throw Object.assign(Error(data.error ?? 'Studio request failed'), { httpStatus: response.status, code: data.code }); return data;
    };
    const tool = (name, description, inputSchema, run, readOnlyHint = false) => {
        if (!allow(name)) return;
        server.registerTool(name, { description, inputSchema, annotations: { readOnlyHint, openWorldHint: false } }, async args => {
            try { await requireStudioProtocol(base.origin, { sessionCookie, fetchImpl }); const value = await run(args); const data = { value }; return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }; }
            catch (error) { const data = { error: error.message, httpStatus: error.httpStatus, code: error.code, note: 'No automatic retry. For a timed-out mutation, read saved state/receipt before sending another request.' }; return { isError: true, content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }; }
        });
    };
    const rawTool = (name, config, handler) => { if (!allow(name)) return; server.registerTool(name, config, handler); };
    tool('studio_state', 'Read compact authoritative revisions, scene/task IDs, planState (plan-managed/detached), locks and production gate. Use studio_scene_read for source/document. No checkpoint fallback.', {}, async () => {
        const project = await api(projectPath), production = await api('/api/production-workflows/' + projectId), episode = await api(workflowPath);
        return { project: { id: project.id, name: project.name, revision: project.revision, sceneOrder: project.sceneOrder, lockedPrefix: project.lockedPrefix, scenes: project.scenes.map(scene => ({ id: scene.id, title: scene.title, duration: scene.duration, documentRevision: scene.document.revision, planState: scene.planState?.status ?? null, taskIds: (scene.scriptPlan?.tasks ?? []).map(task => task.id), chainIds: Object.keys(scene.document.storyChains?.chains ?? {}) })) }, production, episode: { revision: episode.workflow.revision, rowIds: episode.workflow.rows.map(row => row.id), reviewedRowIds: Object.keys(episode.reviews ?? {}) }, nextAction: !project.scenes.length ? (onlyV2 ? 'apply-first-scene-plan-or-build-episode-draft' : 'import-first-scene-or-build-episode-draft') : production.canExpand ? 'request-transition-or-select-scene' : 'read-scene-and-resolve-production-errors' };
    }, true);
    rawTool('scene_plan_preview', { description: 'Compile a declarative scene-plan JSON and render Tier-1 Fast Layout Check PNGs via sharp (~1-2s) WITHOUT writing to SQLite. Use to inspect staging, facing/flip, ground contact and FX warnings before applying. Tier-1 images are NOT valid for review or approval.', inputSchema: { plan: object, frames: z.array(z.number().int().nonnegative()).max(6).optional(), stage: object.optional() }, annotations: { readOnlyHint: true, openWorldHint: false } }, async ({ plan, frames, stage }) => {
        try {
            await requireStudioProtocol(base.origin, { sessionCookie, fetchImpl });
            const result = await api('/api/scene-plans/preview', { plan, ...(frames ? { frames } : {}), ...(stage ? { stage } : {}) });
            const { frames: rendered, ...meta } = result;
            return { content: [...(rendered ?? []).map(f => ({ type: 'image', mimeType: 'image/png', data: f.pngBase64 })), { type: 'text', text: JSON.stringify(meta) }] };
        } catch (error) { return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: error.message, httpStatus: error.httpStatus, code: error.code }) }] }; }
    });
    tool('scene_plan_apply', 'Resolve timing (auto-tts or draft), compile a declarative scene-plan JSON, prepare catalog media and upsert into Studio SQLite with revision check and Detach Guard (rejects 409 SCENE_DETACHED if manually edited in UI unless forceResync:true).', { revision, documentRevision: revision.optional(), plan: object, stage: object.optional(), forceResync: z.boolean().optional() }, args => api('/api/scene-plans/apply', { projectId, ...args }));
    tool('psd_archive_search', 'Search all 7,697+ raw local PSD files in the user PSD archive (Vietnamese, English or Chinese) without unpacking them. Inspect candidates with psd_archive_thumb before extracting.', { query: z.string().max(300), type: z.enum(['characters', 'backgrounds', 'props', 'effects']).optional(), offset: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(50).default(20) }, ({ query, type, offset, limit }) => api('/api/psd-archive/search?q=' + encodeURIComponent(query) + (type ? '&type=' + type : '') + '&limit=' + limit + '&offset=' + offset), true);
    rawTool('psd_archive_thumb', { description: 'View a 640px PNG composite preview of a raw PSD from the archive before extracting it, so you never cast the wrong character or asset.', inputSchema: { id: z.string().regex(/^psd_[a-f0-9]{20}$/) }, annotations: { readOnlyHint: true, openWorldHint: false } }, async ({ id: psdId }) => {
        try {
            await requireStudioProtocol(base.origin, { sessionCookie, fetchImpl });
            const response = await fetchImpl(base.origin + '/api/psd-archive/thumb?id=' + psdId, { redirect: 'error', signal: AbortSignal.timeout(60000), headers: sessionCookie ? { Cookie: sessionCookie } : {} });
            if (!response.ok) throw Error((await response.json().catch(() => ({}))).error ?? 'PSD thumb HTTP ' + response.status);
            const bytes = Buffer.from(await response.arrayBuffer());
            return { content: [{ type: 'image', mimeType: 'image/png', data: bytes.toString('base64') }] };
        } catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
    });
    tool('psd_archive_extract', 'Lazily extract one chosen raw PSD from the archive into Studio imports/ catalog so it becomes immediately usable in scene-plan and Studio 3022.', { id: z.string().regex(/^psd_[a-f0-9]{20}$/), type: z.enum(['characters', 'backgrounds', 'props', 'effects']).optional(), label: z.string().max(120).optional() }, args => api('/api/psd-archive/extract', args));
    tool('studio_scene_read', 'Read one saved scene and its document revision from the bound project.', { sceneId: id }, async ({ sceneId }) => { const p = await api(projectPath), scene = p.scenes.find(s => s.id === sceneId); if (!scene) throw Error('Scene is not in the bound project'); return { projectId, projectRevision: p.revision, scene }; }, true);
    tool('studio_operations', 'List the existing authoring operations and their contracts.', {}, () => api('/api/authoring/operations'), true);
    tool('studio_catalog_search', 'Search poses/faces/backgrounds by meaning in Vietnamese (with or without diacritics), English or Chinese, e.g. "nghe điện thoại", "bo chay", "passerby sitting". Each hit gives id (catalog asset for studio_asset_details/studio_asset_sheet) and imageId (the matching pose/face/prop image for studio_asset_image/studio_asset_prepare); view before selecting. Falls back to name/tag matching when the asset index is not built.', { query: z.string().max(300), type: z.enum(['characters', 'props', 'backgrounds', 'effects']).optional(), offset: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(50).default(20) }, async ({ query, type, offset, limit }) => {
        if (query.trim()) { try { const hit = await api('/api/library/search?q=' + encodeURIComponent(query) + (type ? '&type=' + type : '') + '&limit=' + limit + '&offset=' + offset); return { source: 'asset-index', total: hit.total, items: hit.items.map(({ id, assetId, ...item }) => ({ id: assetId, imageId: id, ...item })), nextOffset: offset + limit < hit.total ? offset + limit : null }; } catch (error) { if (error.code !== 'INDEX_MISSING') throw error; } }
        const catalog = await api('/api/library/catalog'), needle = query.toLocaleLowerCase(); const found = catalog.filter(a => [a.name, ...(a.tags ?? [])].join(' ').toLocaleLowerCase().includes(needle));
        return { total: found.length, items: found.slice(offset, offset + limit).map(a => ({ id: a.id, name: a.name, type: a.type, collection: a.collection, review: a.review, limitations: a.limitations, groups: Object.fromEntries(Object.entries(a.groups ?? {}).map(([k, v]) => [k, v.length])) })), nextOffset: offset + limit < found.length ? offset + limit : null };
    }, true);
    tool('studio_asset_details', 'Read catalog pose/face IDs, provenance and limits for one existing asset.', { catalogId: z.string().max(250) }, async ({ catalogId }) => { const a = (await api('/api/library/catalog')).find(a => a.id === catalogId); if (!a) throw Error('Catalog asset not found'); return a; }, true);
    tool('studio_asset_prepare', 'Prepare an existing catalog image through Studio hash validation.', { imageId: z.string().regex(/^[a-f0-9]{64}$/) }, ({ imageId }) => api('/api/library/prepare?id=' + imageId, {}));
    tool('studio_supplement_register', 'Register an uploaded PNG as a candidate in the existing supplemental catalog. Record reuse-search evidence, purpose, known tool/prompt and limits. Provenance paths must be upload:<sha256> with matching attachment bytes; server file paths are forbidden.', { record: object, pngBase64: z.string().max(12 * 1024 * 1024), attachments: z.array(z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), base64: z.string().max(700000) })).max(16).default([]) }, args => api('/api/supplements/' + projectId, args));
    rawTool('studio_asset_image', { description: 'View an existing catalog PNG to assess pose/face suitability; image pixels do not certify scene execution.', inputSchema: { imageId: z.string().regex(/^[a-f0-9]{64}$/) }, annotations: { readOnlyHint: true, openWorldHint: false } }, async ({ imageId }) => {
        try {
            await requireStudioProtocol(base.origin, { sessionCookie, fetchImpl });
            const response = await fetchImpl(base.origin + '/api/library/image?id=' + imageId, { redirect: 'error', signal: AbortSignal.timeout(60000), headers: sessionCookie ? { Cookie: sessionCookie } : {} });
            if (!response.ok) throw Error('Catalog image HTTP ' + response.status);
            if (!response.headers.get('content-type')?.startsWith('image/png') || Number(response.headers.get('content-length')) > 10 * 1024 * 1024) throw Error('Unsupported or oversized catalog image');
            const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length > 10 * 1024 * 1024 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('Invalid catalog PNG');
            return { content: [{ type: 'image', mimeType: 'image/png', data: bytes.toString('base64') }] };
        } catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
    });
    rawTool('studio_asset_sheet', { description: 'View one catalog asset group as a numbered contact sheet (up to 36 thumbnails) to choose a pose, face, prop or layer by eye in one call. Get catalogId and group names from studio_catalog_search/studio_asset_details. Characters have two face styles (B=bean-eye 表情豆豆眼, D=detailed 表情): choose one style per character and keep it for the whole episode (style filter available; cell numbers stay global and match studio_character_preview). frameSet base-28/extended-52 says which pose set the character has. The text part maps each cell number to its image id and original (often Chinese) name; prepare the chosen id with studio_asset_prepare. Thumbnails are trimmed and scaled, so check final size/fit in a scene capture.', inputSchema: { catalogId: z.string().max(250), kind: z.enum(['poses', 'faces', 'props', 'layers']).optional(), style: z.enum(['bean', 'detailed', 'generic']).optional(), offset: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(36).default(30) }, annotations: { readOnlyHint: true, openWorldHint: false } }, async ({ catalogId, kind, style, offset, limit }) => {
        try {
            await requireStudioProtocol(base.origin, { sessionCookie, fetchImpl });
            const query = new URLSearchParams({ asset: catalogId, offset: String(offset), limit: String(limit), ...(kind ? { kind } : {}), ...(style ? { style } : {}) });
            const response = await fetchImpl(base.origin + '/api/library/sheet?' + query, { redirect: 'error', signal: AbortSignal.timeout(60000), headers: sessionCookie ? { Cookie: sessionCookie } : {} });
            if (!response.ok) throw Error((await response.json().catch(() => ({}))).error ?? 'Sheet HTTP ' + response.status);
            const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length > 10 * 1024 * 1024 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('Invalid sheet PNG');
            const meta = JSON.parse(decodeURIComponent(response.headers.get('x-sheet-cells') ?? '%7B%7D'));
            const next = offset + limit < meta.total ? offset + limit : null;
            return { content: [{ type: 'image', mimeType: 'image/png', data: bytes.toString('base64') }, { type: 'text', text: JSON.stringify({ ...meta, nextOffset: next }) }] };
        } catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
    });
    rawTool('studio_character_preview', { description: 'Preview a character pose with faces layered on it exactly as Studio composes them (faces sit at their PSD positions over the faceless pose). Pass pose/face cell numbers from studio_asset_sheet (1-based within that group) or image ids. Up to 36 pose×face combinations, e.g. poses:[19], faces:[4,12,25] to compare expressions on one pose. Text part maps each cell to poseId/faceId for studio_asset_prepare or catalog selections. Checks fit of head/face only; scene scale, flip and contact still need a scene capture.', inputSchema: { catalogId: z.string().max(250), poses: z.array(z.union([z.number().int().positive(), z.string().max(64)])).min(1).max(36), faces: z.array(z.union([z.number().int().positive(), z.string().max(64)])).max(36).default([]) }, annotations: { readOnlyHint: true, openWorldHint: false } }, async ({ catalogId, poses, faces }) => {
        try {
            await requireStudioProtocol(base.origin, { sessionCookie, fetchImpl });
            const query = new URLSearchParams({ asset: catalogId, poses: poses.join(','), faces: faces.join(',') });
            const response = await fetchImpl(base.origin + '/api/library/combo?' + query, { redirect: 'error', signal: AbortSignal.timeout(60000), headers: sessionCookie ? { Cookie: sessionCookie } : {} });
            if (!response.ok) throw Error((await response.json().catch(() => ({}))).error ?? 'Combo HTTP ' + response.status);
            const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length > 10 * 1024 * 1024 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('Invalid preview PNG');
            return { content: [{ type: 'image', mimeType: 'image/png', data: bytes.toString('base64') }, { type: 'text', text: decodeURIComponent(response.headers.get('x-sheet-cells') ?? '%7B%7D') }] };
        } catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
    });
    tool('studio_plan_import', 'Compile/import a source-backed plan through the existing API. Requires current project revision; backend gates expansion.', { revision, plan: object }, args => api('/api/script-plans/import', { projectId, ...args }));
    tool('studio_author_batch', 'Apply versioned existing authoring operations. Stable batch ID supports retry receipts; dry-run defaults to true.', { sceneId: id, batchId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), revision, assets: object.default({}), commands: z.array(object).min(1).max(200), dryRun: z.boolean().default(true) }, ({ sceneId, batchId, ...args }) => api('/api/authoring/projects/' + projectId + '/scenes/' + sceneId + '/batch', { id: batchId, ...args }));
    tool('studio_document_save', 'Save a draft document/review through versioned edits API. Does not itself approve production. Preserve existing unrelated fields.', { sceneId: id, document: object }, ({ sceneId, document }) => api('/api/edits?project=' + projectId + '&scene=' + sceneId, document, 'PUT'));
    tool('studio_episode_read', 'Read the existing episode builder draft and saved reviews.', {}, () => api(workflowPath), true);
    tool('studio_episode_save', 'Save a versioned episode draft through the existing builder API.', { workflow: object }, ({ workflow }) => api(workflowPath, workflow, 'PUT'));
    tool('studio_episode_build', 'Build one saved episode row using existing catalog, media and composition. Backend enforces expansion.', { rowId: z.string().uuid(), revision, projectRevision: revision }, ({ rowId, ...args }) => api(workflowPath + '/rows/' + rowId + '/build', args));
    tool('studio_transition', 'Request expand or complete. Backend independently checks current coverage, evidence and saved inputs. This grants no native render authorization.', { revision, action: z.enum(['expand', 'complete']) }, args => api('/api/production-workflows/' + projectId, args));
    tool('studio_preview_capture', 'Capture 1–6 frames from the saved scene through the existing ProjectComposition. Server issues capture IDs. Does not watch playback or approve semantics.', { sceneId: id, documentRevision: revision, frames: z.array(z.number().int().nonnegative()).min(1).max(6) }, args => api('/api/preview-evidence/' + projectId, args));
    rawTool('studio_capture_image', { description: 'View a server-issued capture of this bound project. Backend rejects changed bytes, stale scene/media/code and foreign project captures. Describe visible defects by task/timecode after inspecting it.', inputSchema: { captureId: z.string().uuid() }, annotations: { readOnlyHint: true, openWorldHint: false } }, async ({ captureId }) => {
        try {
            await requireStudioProtocol(base.origin, { sessionCookie, fetchImpl });
            const response = await fetchImpl(base.origin + '/api/preview-evidence/' + projectId + '/' + captureId, { redirect: 'error', signal: AbortSignal.timeout(60000), headers: sessionCookie ? { Cookie: sessionCookie } : {} });
            if (!response.ok) throw Error((await response.json()).error ?? 'Capture unavailable');
            if (!response.headers.get('content-type')?.startsWith('image/png') || Number(response.headers.get('content-length')) > 10 * 1024 * 1024) throw Error('Unsupported or oversized capture');
            const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length > 10 * 1024 * 1024 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('Invalid capture PNG');
            return { content: [{ type: 'image', mimeType: 'image/png', data: bytes.toString('base64') }] };
        } catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
    });
    tool('studio_playback_records', 'Read server records of player-reported frame ranges. Add playbackId to review ranges. These records do not prove reviewer comprehension.', {}, () => api('/api/preview-playback/' + projectId), true);
    tool('studio_preview_play', 'Request 2–300 frames of saved-scene playback in the existing Studio UI. Open the bound project first; Studio waits for a clean idle editor. No browser/engine access. Result is queued, never reviewed or approved.', { sceneId: id, documentRevision: revision, from: z.number().int().nonnegative(), to: z.number().int().positive() }, args => api('/api/preview-playback/' + projectId + '/requests', args));
    tool('studio_preview_status', 'Read one bounded playback request. played-unreviewed means server playback range only; inspect current capture images and state actual viewing/hearing limits. This tool cannot claim, fabricate telemetry or approve a scene.', { requestId: z.string().uuid() }, ({ requestId }) => api('/api/preview-playback/' + projectId + '/requests/' + requestId), true);
    tool('studio_export_jobs', 'Read export jobs for the bound project.', {}, () => api('/api/exports?project=' + projectId), true);
    tool('studio_export_request', 'Submit/replay a stable export request. A new job requires current production review AND separate trusted-host owner authorization for this exact request ID and scale. This tool cannot grant that authorization.', { requestId: z.string().uuid(), scale: z.union([z.literal(1), z.literal(.5)]) }, args => api('/api/exports', { projectId, ...args }));
    tool('studio_preview_location', 'Get the existing Studio URL and saved revision to inspect. This tool does not watch playback or issue evidence.', {}, async () => ({ url: base.origin, projectId, projectRevision: (await api(projectPath)).revision, action: 'Open this project in Studio, play the relevant ranges and record actual observations; opening the page is not review.' }), true);
    return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { const server = createStudioMcp({ baseUrl: process.env.STUDIO_URL, projectId: process.env.STUDIO_PROJECT_ID, sessionCookie: process.env.STUDIO_SESSION_COOKIE, mode: process.env.STUDIO_MCP_MODE ?? 'full' }); await server.connect(new StdioServerTransport()); }
    catch (error) { console.error('Studio MCP: ' + error.message); process.exitCode = 1; }
}
