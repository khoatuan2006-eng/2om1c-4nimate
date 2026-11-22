import { randomUUID, createHash } from "node:crypto";
import { readFile, mkdir, writeFile, rename, stat } from "node:fs/promises";
import { resolve,relative,isAbsolute } from "node:path";
import { getEffectiveApiKey } from "../backend/services/gemini.service.mjs";
import { searchWithAgent } from "./agent-search.mjs";
const importsRoot = resolve(process.env.EDITOR_IMPORTS_DIR??resolve(import.meta.dirname,"../preproduction/nhat-thanh/resource-library/imports"));
let providerPromise;
async function loadDiscoveryProvider() {
  if (!providerPromise) {
    providerPromise = import("./discovery-provider.local.mjs").catch(() => null);
  }
  return providerPromise;
}
const candidates = new Map(),
  jobs = new Map();
const importedCache=new Map();
export function invalidateImportedCatalog(){importedCache.clear();}
const within=(root,file)=>{const rel=relative(root,file);return rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel);};
export async function importedCatalog(register){
 let entries=[];try{entries=JSON.parse(await readFile(resolve(importsRoot,'editor-index.json'),'utf8'));}catch{}
 const result=[],active=new Set();
 for(const entry of entries){try{
  const base=resolve(importsRoot,entry.relativePath);if(!within(importsRoot,base))continue;active.add(base);
  const file=resolve(base,'asset.manifest.json'),info=await stat(file),signature=String(info.mtimeMs)+':'+info.size;
  let cached=importedCache.get(base);
  if(!cached||cached.signature!==signature){
   const pending=(async()=>{
    const d=JSON.parse(await readFile(file,'utf8')),groups={},files=[];
    for(const kind of ['poses','faces','props','layers']){groups[kind]=[];
     for(const item of d.capabilities[kind]??[]){const path=resolve(importsRoot,item.relativePath||item.path);if(!within(base,path))continue;
      const bytes=await readFile(path);if(bytes.length<24||bytes.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error('Invalid catalog PNG');
      const id=createHash('sha256').update(bytes).digest('hex');files.push([id,path]);groups[kind].push({...item,sourceLayerId:item.sourceLayerId??item.id,id,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bbox:item.bbox??[0,0,bytes.readUInt32BE(16),bytes.readUInt32BE(20)],url:'/api/library/image?id='+id});
     }
    }
    return {asset:{id:'import/'+d.assetId,name:d.displayName,type:entry.type,collection:'imports',source:d.source.path,canvas:[0,0],groups},files};
   })();cached={signature,pending};importedCache.set(base,cached);
  }
  let value;try{value=await cached.pending;}catch(e){importedCache.delete(base);throw e;}
  for(const [id,path] of value.files)register(id,path);result.push({...value.asset,type:entry.type});
 }catch{}}
 for(const key of importedCache.keys())if(!active.has(key))importedCache.delete(key);
 return result;
}
let importQueue = Promise.resolve();
export async function discoveryRequest(req, url, send, current, readLocal) {
  if (url.pathname === "/discovery/status") {
    send(200, { geminiConfigured: Boolean(getEffectiveApiKey()) });
    return true;
  }
  if (url.pathname === "/discovery/search" && req.method === "POST") {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 4096) {
        send(413, { error: "Mô tả quá dài" });
        return true;
      }
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString()),
      query = String(body.query ?? "")
        .trim()
        .slice(0, 500),
      type = ["characters", "props", "backgrounds"].includes(body.type)
        ? body.type
        : "characters";
    if (!query) {
      send(400, { error: "Nhập mô tả tài nguyên cần tìm" });
      return true;
    }
    const role = {
      characters: "character",
      props: "prop",
      backgrounds: "background",
    }[type];
    let agent;
    if (body.ai) {
      try {
        agent = await searchWithAgent({
          query,
          type,
          context: body.context,
          current,
          readLocal,
        });
      } catch {
        agent = {
          warning:
            "AI chưa xử lý được yêu cầu; đang tìm trực tiếp, chưa có điểm Vision.",
        };
      }
    }
    const provider = await loadDiscoveryProvider();
    const translation = agent?.terms
      ? { searchTerms: agent.terms }
      : { searchTerms: [query] };
    const found = agent?.candidates
      ? { candidates: agent.candidates, errors: [] }
      : provider?.fetchExternalCandidates
        ? await provider.fetchExternalCandidates(translation.searchTerms, role, {
            pageSize: 24,
          })
        : { candidates: [], errors: [] };
    const items = found.candidates.map((c) => {
      const token = randomUUID();
      if (candidates.size > 500)
        candidates.delete(candidates.keys().next().value);
      candidates.set(token, { ...c, type });
      const ready = current.find(
        (a) =>
          a.source &&
          c.localPsd &&
          resolve(a.source).toLowerCase() ===
            resolve(c.localPsd).toLowerCase() &&
          a.type === type,
      );
      return {
        token,
        name: c.name,
        image: c.picUrl,
        readyId: c.readyId ?? ready?.id,
        audit: c.visualAudit ?? null,
        source: c.source === "local-rag" ? "Kho local" : (provider?.externalLabel ?? "Nguồn ngoài"),
        sourceUrl: provider?.externalPortalUrl ?? null,
        canExtract: !!c.localPsd,
      };
    });
    send(200, {
      items,
      terms: translation.searchTerms,
      warning:
        agent?.warning ??
        (!provider && !items.length
          ? "Chưa cài đặt nguồn tìm kiếm mở rộng cục bộ."
          : found.errors.length
            ? "Nguồn tìm kiếm có lỗi kết nối; thử lại nếu thiếu kết quả."
            : null),
      plan: agent?.plan ?? null,
      trace: agent?.trace ?? [],
      context: agent?.context ?? null,
      referenceCount: agent?.referenceCount ?? 0,
      lowMatch: agent?.lowMatch ?? false,
    });
    return true;
  }
  if (url.pathname === "/discovery/import" && req.method === "POST") {
    const c = candidates.get(url.searchParams.get("token"));
    if (!c?.localPsd) {
      send(404, {
        error: "Chưa có PSD nguồn trên máy. Mở trang nguồn để bổ sung PSD.",
      });
      return true;
    }
    const provider = await loadDiscoveryProvider();
    if (!provider?.processLocalPsd) {
      send(501, { error: "Chưa cài bộ tách PSD cục bộ." });
      return true;
    }
    const existing = [...jobs.values()].find(
      (j) => j.source === c.localPsd && j.status === "extracting",
    );
    if (existing) {
      send(202, { id: existing.id });
      return true;
    }
    const id = randomUUID(),
      job = { id, source: c.localPsd, status: "extracting" };
    jobs.set(id, job);
    importQueue = importQueue
      .catch(() => {})
      .then(async () => {
        try {
          const result = await provider.processLocalPsd({
            sourcePath: c.localPsd,
            assetType: c.requestedRole,
            displayName: c.name,
            libraryRoot: importsRoot,
            stagingRoot: resolve(importsRoot, ".staging"),
            sourceMetadata: {
              externalProvider: provider.externalProviderName ?? "local",
              remoteMaterialId: c.remoteId,
            },
          });
          await mkdir(importsRoot, { recursive: true });
          let index = [];
          try {
            index = JSON.parse(
              await readFile(resolve(importsRoot, "editor-index.json"), "utf8"),
            );
          } catch {}
          index = index.filter((e) => e.assetId !== result.assetId);
          index.push({
            assetId: result.assetId,
            relativePath: result.relativePath,
            type: c.type,
          });
          await writeFile(
            resolve(importsRoot, "editor-index.json.tmp"),
            JSON.stringify(index, null, 2),
          );
          await rename(
            resolve(importsRoot, "editor-index.json.tmp"),
            resolve(importsRoot, "editor-index.json"),
          );
          Object.assign(job, {
            status: "ready",
            assetId: "import/" + result.assetId,
          });
        } catch (e) {
          Object.assign(job, {
            status: "failed",
            error: String(e.message).replace(/AIza[\w-]+/g, "[key]"),
          });
        }
      });
    send(202, { id });
    return true;
  }
  if (url.pathname === "/discovery/job") {
    const j = jobs.get(url.searchParams.get("id"));
    send(
      j ? 200 : 404,
      j
        ? { id: j.id, status: j.status, assetId: j.assetId, error: j.error }
        : { error: "Không tìm thấy tác vụ" },
    );
    return true;
  }
  return false;
}
