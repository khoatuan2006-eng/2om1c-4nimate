import {AssetIndex,defaultIndexPath} from './asset-index.mjs';
import {buildSheet,composeParts,pickFromGroup,SHEET_LIMIT} from './asset-sheet.mjs';
import {supplementalCatalog} from './supplemental-catalog.mjs';
import {getPsdArchive,getPsdThumbnail,extractPsdAsset} from './psd-archive.mjs';
import {isLocalWrite} from './http-policy.mjs';
import { readdir, readFile, stat } from "node:fs/promises";
import {prepareLibraryImage,readLibraryImage} from './prepared-media.mjs';
import { resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import {mediaRoot} from "./project-store.mjs";
import { discoveryRequest, importedCatalog,invalidateImportedCatalog } from "./discovery-server.mjs";
const root = resolve(process.env.EDITOR_LIBRARY_DIR??resolve(import.meta.dirname, "../../asset_browser/library")),
  publicRoot = mediaRoot;
const filmRoot = resolve(process.env.EDITOR_FILM_LIBRARY_DIR??resolve(import.meta.dirname,"../preproduction/nhat-thanh/resource-library/rebuild-20261009"));
const inside=(root,path)=>{const rel=relative(root,path);return rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel);};
async function entries(path,options){try{return await readdir(path,options);}catch(error){if(error.code==='ENOENT')return [];throw error;}}
const files = new Map();
// Face-style / frame-set labels per source PSD (see scripts/build-catalog-annotations.py).
let annotations = {}, annotationStamp = "";
async function loadAnnotations() {
  try {
    const file = resolve(import.meta.dirname, "catalog-annotations.json"), st = await stat(file);
    if (String(st.mtimeMs) !== annotationStamp) { annotations = JSON.parse(await readFile(file, "utf8")); annotationStamp = String(st.mtimeMs); }
  } catch { /* labels are optional */ }
  return annotations;
}
/** Idempotent: adds frameSet/faceStyles to a character asset and `style` to each face from its PSD group. */
export function annotateAsset(asset, table) {
  if (asset.type !== "characters" || !asset.source) return asset;
  const note = table[String(asset.source).split(/[\\/]/).pop()];
  if (!note) return asset;
  asset.frameSet = note.frameSet;
  asset.faceStyles = note.faceGroups.map(({ index, name, style, count }) => ({ index, name, style, count }));
  const style = new Map(note.faceGroups.map((g) => [g.index, g.style]));
  for (const face of asset.groups?.faces ?? []) {
    const group = Number(String(face.sourceLayerId ?? "").split("/")[0]);
    if (style.has(group)) face.style = style.get(group);
  }
  return asset;
}
let cached,
  filmCache = [],
  filmStamp = "";
async function filmCatalog() {
  try {
    const st = await stat(resolve(filmRoot, "progress.json"));
    if (String(st.mtimeMs) === filmStamp) return filmCache;
    const progress = JSON.parse(
      await readFile(resolve(filmRoot, "progress.json"), "utf8"),
    );
    const result = [];
    for (const entry of progress.sources) {
      if (!entry.directory) continue;
      const d = JSON.parse(
          await readFile(
            resolve(filmRoot, entry.directory, "asset.manifest.json"),
            "utf8",
          ),
        ),
        groups = {};
      for (const kind of entry.type === "characters"
        ? ["poses", "faces"]
        : entry.type === "props" || entry.type === "effects"
          ? ["props"]
          : ["layers"]) {
        groups[kind] = [];
        for (const item of d.capabilities[kind] ?? []) {
          const path = resolve(filmRoot, item.relativePath);
          if (!inside(filmRoot,path)) continue;
          const id = item.sha256;
          files.set(id, path);
          groups[kind].push({
            ...item,
            id,
            sourceLayerId: item.id,
            url: "/api/library/image?id=" + id,
          });
        }
      }
      result.push({
        id: "film/" + entry.id,
        name: entry.label,
        type: entry.type,
        collection: "film",
        canvas: d.canvas,
        groups,
        status: entry.status,
        source: d.source.path,
      });
    }
    filmCache = result;
    filmStamp = String(st.mtimeMs);
    return result;
  } catch {
    return filmCache;
  }
}
export async function catalog() {
  const imported = [...await importedCatalog((id, path) => files.set(id, path)),...await supplementalCatalog(publicRoot,(id,path)=>files.set(id,path))];
  const table = await loadAnnotations();
  if (cached) return [...(await filmCatalog()), ...imported, ...cached].map((a) => annotateAsset(a, table));
  const assets = [];
  for (const type of ["characters", "props", "backgrounds"])
    for (const dir of await entries(resolve(root, type), {
      withFileTypes: true,
    })) {
      if (!dir.isDirectory()) continue;
      try {
        const base = resolve(root, type, dir.name),
          d = JSON.parse(
            await readFile(resolve(base, "asset.manifest.json"), "utf8"),
          );
        const raw = JSON.parse(
          await readFile(resolve(base, "manifest.json"), "utf8"),
        );
        const groups = {};
        for (const kind of type === "characters"
          ? ["poses", "faces"]
          : type === "props"
            ? ["props"]
            : ["layers"]) {
          groups[kind] = [];
          for (const item of d.capabilities?.[kind] ?? []) {
            if (
              type === "props" &&
              /背景|background/i.test(item.sourceLayerName ?? item.name)
            )
              continue;
            const path = resolve(
              root,
              item.relativePath ?? relative(root, item.path),
            );
            if (!inside(root,path)) continue;
            const bytes = await readFile(path);
            if (bytes.toString("hex", 0, 8) !== "89504e470d0a1a0a") continue;
            const key = createHash("sha256").update(bytes).digest("hex");
            files.set(key, path);
            const bbox = item.bbox ??
              d.capabilities.layers?.find((l) => l.id === item.sourceLayerId)
                ?.bbox ?? [
                0,
                0,
                bytes.readUInt32BE(16),
                bytes.readUInt32BE(20),
              ];
            groups[kind].push({
              id: key,
              sourceLayerId: item.sourceLayerId ?? item.id,
              name: item.name,
              bbox,
              width: bytes.readUInt32BE(16),
              height: bytes.readUInt32BE(20),
              url: "/api/library/image?id=" + key,
            });
          }
        }
        if (Object.values(groups).some((a) => a.length))
          assets.push({
            id: type + "/" + dir.name,
            name: d.displayName ?? dir.name,
            type,
            collection: "shared",
            source: d.source?.path ?? raw.source,
            canvas: raw.canvas ?? [1920, 1080],
            groups,
          });
      } catch {}
    }
  const items = [];
  for (const name of await entries(resolve(publicRoot, "images"))) {
    if (!name.toLowerCase().endsWith(".png")) continue;
    try {
      const path = resolve(publicRoot, "images", name),
        bytes = await readFile(path);
      if (bytes.toString("hex", 0, 8) !== "89504e470d0a1a0a") continue;
      const id = createHash("sha256").update(bytes).digest("hex"),
        width = bytes.readUInt32BE(16),
        height = bytes.readUInt32BE(20);
      files.set(id, path);
      items.push({
        id,
        name: name.replace(/\.png$/i, ""),
        bbox: [0, 0, width, height],
        width,
        height,
        url: "/api/library/image?id=" + id,
      });
    } catch {}
  }
  assets.unshift({
    id: "project/nhat-thanh-EP01",
    name: "Ảnh ghép EP01 · bản dựng",
    collection: "prepared",
    type: "project",
    canvas: [0, 0],
    groups: { layers: items },
  });
  cached = assets;
  return [...(await filmCatalog()), ...imported, ...assets].map((a) => annotateAsset(a, table));
}
/** Absolute file behind a catalog image id (valid after catalog() has run); used by offline tools. */
export function catalogFilePath(id){return files.get(id);}
export async function prepareCatalogImage(id){if(!files.has(id))await catalog();if(!files.has(id))throw Error('Ảnh không thuộc kho');return prepareLibraryImage(files.get(id),id,publicRoot);}
export async function prepareSceneBackground(id) {
  const current = await catalog();
  const owner = current.find(a => a.type === 'backgrounds' && Object.values(a.groups).some(items => items.some(item => item.id === id)));
  if (!owner || !files.has(id)) throw Error('Chọn một ảnh nền trong kho tài nguyên.');
  const item = Object.values(owner.groups).flat().find(item => item.id === id);
  let src;try{({src}=await prepareLibraryImage(files.get(id),id,publicRoot));}catch(error){if(error.code==='ASSET_CHANGED'){cached=null;filmStamp='';invalidateImportedCatalog();}throw error;}
  return {name:owner.name,src,width:item.width,height:item.height};
}
export function libraryPlugin() {
  return {
    name: "extracted-library",
    configureServer(server) {
      server.middlewares.use("/api/library", async (req, res) => {
        const send = (code, obj) => {
          res.writeHead(code, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          res.end(JSON.stringify(obj));
        };
        try {
          const url = new URL(req.url, "http://localhost");
          if (url.pathname.startsWith("/psd-archive/")) {
            if (req.method === "GET" && url.pathname === "/psd-archive/search") {
              const q = url.searchParams.get("q") ?? "";
              const type = url.searchParams.get("type") || undefined;
              const limit = Math.min(48, Math.max(1, Number(url.searchParams.get("limit")) || 24));
              const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
              const archive = getPsdArchive();
              archive.ensureScanned();
              const resData = archive.search(q, { type, limit, offset });
              return send(200, {
                ...resData,
                archiveTotal: archive.count(),
                items: resData.items.map((it) => ({
                  ...it,
                  thumbUrl: "/api/library/psd-archive/thumb?id=" + encodeURIComponent(it.id),
                })),
              });
            }
            if (req.method === "GET" && url.pathname === "/psd-archive/thumb") {
              const id = url.searchParams.get("id");
              if (!id) return send(400, { error: "Thiếu id PSD" });
              const { bytes } = await getPsdThumbnail(id);
              res.writeHead(200, {
                "Content-Type": "image/png",
                "Cache-Control": "public,max-age=86400",
                "Content-Length": bytes.length,
              });
              return res.end(bytes);
            }
            if (req.method === "POST" && url.pathname === "/psd-archive/extract") {
              if (!isLocalWrite(req)) return send(403, { error: "Origin không hợp lệ" });
              let raw = "";
              for await (const chunk of req) {
                raw += chunk;
                if (raw.length > 65536) return send(413, { error: "Payload quá lớn" });
              }
              let body = {};
              try {
                body = JSON.parse(raw || "{}");
              } catch {
                return send(400, { error: "JSON không hợp lệ" });
              }
              const { id, type, label } = body;
              if (typeof id !== "string" || !id.trim()) return send(400, { error: "Thiếu id PSD" });
              const result = await extractPsdAsset(id.trim(), {
                type: type || undefined,
                label: label || undefined,
                onExtracted: () => invalidateImportedCatalog(),
              });
              return send(200, { ok: true, id: id.trim(), catalogId: "import/" + id.trim(), result });
            }
            return send(404, { error: "Không tìm thấy endpoint kho PSD" });
          }

          const current = await catalog();
          if (
            req.method === "POST" &&
            !isLocalWrite(req)
          )
            return send(403, { error: "Origin không hợp lệ" });
          if (
            await discoveryRequest(req, url, send, current, (id) => {
              if (!files.has(id)) throw Error("Ảnh không thuộc kho");
              return readLibraryImage(files.get(id),id);
            })
          )
            return;
          if (req.method === "GET" && url.pathname === "/sheet") {
            // Numbered grid of one asset's poses/faces/props/layers. Cell numbers map to image ids in X-Sheet-Cells.
            const asset = current.find((a) => a.id === url.searchParams.get("asset"));
            if (!asset) return send(404, { error: "Catalog asset not found" });
            const kind = url.searchParams.get("kind") || Object.keys(asset.groups ?? {})[0], list = asset.groups?.[kind];
            if (!Array.isArray(list)) return send(400, { error: "Unknown group. Available: " + Object.keys(asset.groups ?? {}).join(", ") });
            // Numbers stay 1-based positions in the whole group so they match /combo even when a style filter is on.
            const style = url.searchParams.get("style");
            const numbered = list.map((item, i) => ({ item, n: i + 1 })).filter(({ item }) => !style || item.style === style);
            const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0), limit = Math.min(SHEET_LIMIT, Math.max(1, Number(url.searchParams.get("limit")) || 30));
            const page = numbered.slice(offset, offset + limit);
            if (!page.length) return send(400, { error: "Nothing at offset " + offset + (style ? " for style " + style : "") + " (" + numbered.length + " items)" });
            const mark = { bean: "B", detailed: "D" };
            const cells = await Promise.all(page.map(async ({ item, n }) => ({ n, id: item.id, name: item.name, style: item.style ?? null, tag: kind === "faces" ? mark[item.style] : undefined, bytes: await readLibraryImage(files.get(item.id), item.id) })));
            const png = await buildSheet(cells);
            res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store", "Content-Length": png.length,
              "X-Sheet-Cells": encodeURIComponent(JSON.stringify({ asset: asset.id, kind, total: numbered.length, groupSize: list.length, style: style || null, faceStyles: asset.faceStyles ?? null, frameSet: asset.frameSet ?? null, cells: cells.map(({ n, id, name, style }) => ({ n, id, name, ...(style ? { style } : {}) })) })) });
            return res.end(png);
          }
          if (req.method === "GET" && url.pathname === "/combo") {
            // Preview pose × face combinations as they will be layered (faces sit on top of the pose at PSD positions).
            const asset = current.find((a) => a.id === url.searchParams.get("asset"));
            if (!asset || asset.type !== "characters") return send(404, { error: "Character asset not found" });
            const list = (name) => (url.searchParams.get(name) ?? "").split(",").map((v) => v.trim()).filter(Boolean);
            let poses, faces;
            try {
              poses = pickFromGroup(asset.groups?.poses ?? [], list("poses"), "Pose");
              const faceRefs = list("faces");
              faces = faceRefs.length ? pickFromGroup(asset.groups?.faces ?? [], faceRefs, "Face") : [null];
            } catch (error) { return send(400, { error: error.message }); }
            if (!poses.length) return send(400, { error: "Give at least one pose (cell number or id)" });
            if (poses.length * faces.length > SHEET_LIMIT) return send(400, { error: "At most " + SHEET_LIMIT + " pose×face combinations" });
            const load = async (item) => ({ ...item, bytes: await readLibraryImage(files.get(item.id), item.id) });
            const loadedPoses = await Promise.all(poses.map(load)), loadedFaces = await Promise.all(faces.map((f) => (f ? load(f) : null)));
            const cells = [];
            for (const pose of loadedPoses) for (const face of loadedFaces) cells.push({ n: cells.length + 1, name: pose.name + (face ? "+" + face.name : ""), poseId: pose.id, faceId: face?.id ?? null, faceStyle: face?.style ?? null, tag: face ? { bean: "B", detailed: "D" }[face.style] : undefined,
              bytes: await composeParts(face ? [pose, face] : [pose], asset.canvas ?? [0, 0]) });
            const png = await buildSheet(cells, { columns: Math.min(6, cells.length), cell: cells.length <= 4 ? 420 : 260 });
            res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store", "Content-Length": png.length,
              "X-Sheet-Cells": encodeURIComponent(JSON.stringify({ asset: asset.id, kind: "combo", total: cells.length, mixedFaceStyles: new Set(cells.map((c) => c.faceStyle).filter(Boolean)).size > 1, frameSet: asset.frameSet ?? null, cells: cells.map(({ n, name, poseId, faceId, faceStyle }) => ({ n, name, poseId, faceId, ...(faceStyle ? { faceStyle } : {}) })) })) });
            return res.end(png);
          }
          if (req.method === "GET" && url.pathname === "/search") {
            // Semantic-ish search over the derived asset index (translations, tags, descriptions).
            // Created on first use; new catalog items are added before each search so fresh uploads are findable.
            const index = new AssetIndex(defaultIndexPath());
            try {
              index.addMissing(current);
              const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20)), offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
              return send(200, index.search(url.searchParams.get("q") ?? "", { type: url.searchParams.get("type") || undefined, kind: url.searchParams.get("kind") || undefined, limit, offset }));
            } finally { index.close(); }
          }
          if (req.method === "GET" && url.pathname === "/catalog")
            return send(200, current);
          const id = url.searchParams.get("id");
          if (!files.has(id))
            return send(404, { error: "Không tìm thấy ảnh trong kho" });
          if (req.method === "GET" && url.pathname === "/image") {
            const bytes=await readLibraryImage(files.get(id),id);
            res.writeHead(200, {
              "Content-Type": "image/png",
              "Cache-Control": "public,max-age=3600",
            });
            return res.end(bytes);
          }
          if (req.method === "POST" && url.pathname === "/prepare") {
            if (
              !isLocalWrite(req)
            )
              return send(403, { error: "Origin không hợp lệ" });
            return send(200, await prepareLibraryImage(files.get(id),id,publicRoot));
          }
          send(405, { error: "Method not allowed" });
        } catch (e) {
          if(e.code==='ASSET_CHANGED'){cached=null;filmStamp='';}
          send(500, { error: e.message });
        }
      });
    },
  };
}
