import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,readdirSync,existsSync,copyFileSync,statSync} from 'node:fs';
import {resolve,dirname,relative,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {validateDocument} from './model.mjs';
import {productionFingerprint} from './production-workflow.mjs';
import {productionInputsDigest} from './production-inputs.mjs';

export const dataRoot=process.env.EDITOR_DATA_DIR?resolve(process.env.EDITOR_DATA_DIR):resolve(import.meta.dirname,'data');
export const mediaRoot=resolve(dataRoot,'media');
export const jobsRoot=resolve(dataRoot,'jobs');
export const legacyProjectId='nhat-thanh-ep01';
export const SCHEMA_VERSION=1;
const now=()=>new Date().toISOString(),parse=JSON.parse,encode=JSON.stringify;
const fail=(message,status=400,code)=>{const e=new Error(message);e.status=status;if(code)e.code=code;throw e;};
const titleOf=value=>{const title=String(value??'').trim();if(!title||title.length>100)fail('Tên cần từ 1–100 ký tự.');return title;};

export class ProjectStore{
  constructor(filename,{productionMode=false,mediaDirectory=resolve(filename===':memory:'?dataRoot:dirname(filename),'media')}={}){
    this.productionMode=productionMode;
    this.mediaDirectory=mediaDirectory;
    if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
    this.db=new DatabaseSync(filename);
    const schema=this.db.prepare('PRAGMA user_version').get().user_version;
    if(schema>SCHEMA_VERSION){this.db.close();fail('Dữ liệu được tạo bởi phiên bản editor mới hơn. Hãy cập nhật ứng dụng trước khi mở.',409);}
    try{
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,title TEXT NOT NULL,revision INTEGER NOT NULL,scene_order TEXT NOT NULL,locked_prefix TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS scenes(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),source TEXT NOT NULL,document TEXT NOT NULL,revision INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS edit_history(scene_id TEXT NOT NULL REFERENCES scenes(id),revision INTEGER NOT NULL,document TEXT NOT NULL,saved_at TEXT NOT NULL,PRIMARY KEY(scene_id,revision));
      CREATE TABLE IF NOT EXISTS project_history(project_id TEXT NOT NULL REFERENCES projects(id),revision INTEGER NOT NULL,scene_order TEXT NOT NULL,title TEXT NOT NULL,saved_at TEXT NOT NULL,PRIMARY KEY(project_id,revision));
      PRAGMA user_version=1; COMMIT;`);
    }catch(error){this.db.close();throw error;}
  }
  transaction(run){this.db.exec('BEGIN IMMEDIATE');try{const value=run();this.db.exec('COMMIT');return value;}catch(e){try{this.db.exec('ROLLBACK');}catch(rollbackError){e.rollbackError=rollbackError;}throw e;}}
  close(){this.db.close();}
  listAssemblies(){return this.db.prepare("SELECT key,value FROM meta WHERE key LIKE 'assembly:%'").all().map(row=>{const t=parse(row.value);return {id:t.id,name:t.name,count:Object.keys(t.layers).length};});}
  getAssembly(id){const row=this.db.prepare('SELECT value FROM meta WHERE key=?').get('assembly:'+id);if(!row)fail('Không tìm thấy bộ',404);return parse(row.value);}
  saveAssembly(template){const value={...template,id:randomUUID()};this.db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('assembly:'+value.id,encode(value));return value;}
  list(){return this.db.prepare('SELECT id,title,revision,created_at,updated_at FROM projects WHERE archived=0 ORDER BY updated_at DESC').all().map(p=>({...p,sceneCount:this.db.prepare('SELECT COUNT(*) AS n FROM scenes WHERE project_id=?').get(p.id).n}));}
  get(id){
    const p=this.db.prepare('SELECT * FROM projects WHERE id=? AND archived=0').get(id);if(!p)fail('Không tìm thấy dự án.',404);
    const order=parse(p.scene_order),rows=this.db.prepare('SELECT * FROM scenes WHERE project_id=?').all(id),map=new Map(rows.map(r=>[r.id,r]));
    let from=0;
    const scenes=order.map(sceneId=>{const row=map.get(sceneId);if(!row)fail('Dự án có scene bị thiếu.',500);const source=parse(row.source),entry={...source,document:parse(row.document),from,to:from+source.duration};from=entry.to;return entry;});
    return {id:p.id,title:p.title,revision:p.revision,fps:30,width:1920,height:1080,sceneOrder:order,lockedPrefix:parse(p.locked_prefix),createdAt:p.created_at,updatedAt:p.updated_at,duration:from,scenes};
  }
  create(title,id='project-'+randomUUID()){
    title=titleOf(title);const stamp=now();this.db.prepare('INSERT INTO projects(id,title,revision,scene_order,locked_prefix,created_at,updated_at) VALUES(?,?,0,?,?,?,?)').run(id,title,'[]','[]',stamp,stamp);return this.get(id);
  }
  scene(sceneId,projectId){const r=this.db.prepare('SELECT * FROM scenes WHERE id=?').get(sceneId);if(!r||(projectId&&r.project_id!==projectId))fail('Đoạn không thuộc dự án đang mở.',404);return r;}
  /** 'draft' lets scenes be added freely (warnings only); 'production' (default) keeps the review gate. Export always needs a complete receipt. */
  mode(projectId){return this.db.prepare('SELECT value FROM meta WHERE key=?').get('project-mode:'+projectId)?.value==='draft'?'draft':'production';}
  setMode(projectId,mode){if(!['draft','production'].includes(mode))fail('Chế độ không hợp lệ');this.get(projectId);this.db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run('project-mode:'+projectId,mode);return mode;}
  requireProductionReceipt(project,action){
    if(!this.productionMode)return;
    if(action==='expand'&&!project.scenes.length)return;
    if(action==='expand'&&this.mode(project.id)==='draft')return;
    const row=this.db.prepare('SELECT value FROM meta WHERE key=?').get('production-transition:'+project.id);
    const receipt=row?parse(row.value):null;
    if(receipt?.action!==action||receipt.fingerprint!==productionFingerprint(project))fail('Production review required for current saved inputs before '+action+'.',409,'PRODUCTION_GATE_REQUIRED');
    try{if(receipt.inputsDigest!==productionInputsDigest(project,this.mediaDirectory))throw Error('stale');}catch{fail('Production media or composition changed; review again.',409,'PRODUCTION_GATE_REQUIRED');}
  }
  addScene(projectId,source,document){return this.transaction(()=>{
    const p=this.get(projectId),existing=this.db.prepare('SELECT * FROM scenes WHERE id=?').get(source.id);
    if(existing){if(existing.project_id!==projectId)fail('Đoạn đã thuộc một dự án khác.',409);return parse(existing.source);}
    this.requireProductionReceipt(p,'expand');
    if(!source.id||!Number.isSafeInteger(source.duration)||source.duration<1||source.duration>30*60*60)fail('Thời lượng đoạn không hợp lệ.');
    titleOf(source.title);const doc=validateDocument(document,source.duration);
    if(Object.keys(doc.layers).some(key=>!key.startsWith(source.id+'/shot-')))fail('Đối tượng không thuộc đoạn này.');
    this.db.prepare('INSERT INTO scenes VALUES(?,?,?,?,?)').run(source.id,projectId,encode(source),encode(doc),doc.revision);
    this.db.prepare('DELETE FROM meta WHERE key=?').run('production-transition:'+projectId);
    this.rememberProject(p);this.db.prepare('UPDATE projects SET scene_order=?,revision=revision+1,updated_at=? WHERE id=?').run(encode([...p.sceneOrder,source.id]),now(),projectId);return source;
  });}
  /** Create or re-compile a scene-plan-managed scene. Rejects overwrite if locked or detached (manual UI edit) unless forceResync is explicitly set. */
  upsertPlanScene(projectId,source,document,{revision,documentRevision,forceResync=false}={}){return this.transaction(()=>{
    const p=this.get(projectId),existing=this.db.prepare('SELECT * FROM scenes WHERE id=?').get(source.id);
    if(!source.id||!Number.isSafeInteger(source.duration)||source.duration<1||source.duration>30*60*60)fail('Thời lượng đoạn không hợp lệ.');
    titleOf(source.title);const doc=validateDocument(document,source.duration);
    if(Object.keys(doc.layers).some(key=>!key.startsWith(source.id+'/shot-')))fail('Đối tượng không thuộc đoạn này.');
    const stamped={...source,planState:{status:'plan-managed',digest:source.scenePlan?.digest??null,syncedAt:now()}};
    if(!existing){
      if(revision!==undefined&&revision!==p.revision)fail('Dự án đã thay đổi. Đọc lại revision trước khi thêm cảnh.',409,'REVISION_CONFLICT');
      this.requireProductionReceipt(p,'expand');
      this.db.prepare('INSERT INTO scenes VALUES(?,?,?,?,?)').run(source.id,projectId,encode(stamped),encode(doc),doc.revision);
      this.db.prepare('DELETE FROM meta WHERE key=?').run('production-transition:'+projectId);
      this.rememberProject(p);this.db.prepare('UPDATE projects SET scene_order=?,revision=revision+1,updated_at=? WHERE id=?').run(encode([...p.sceneOrder,source.id]),now(),projectId);
      return {created:true,scene:stamped,document:doc,projectRevision:p.revision+1};
    }
    if(existing.project_id!==projectId)fail('Đoạn đã thuộc một dự án khác.',409);
    if(p.lockedPrefix.includes(source.id))fail('Scene đã được duyệt và khóa. Không thể biên dịch đè.',409,'SCENE_LOCKED');
    const existingSource=parse(existing.source);
    if(existingSource.planState?.status==='detached'&&!forceResync){
      fail('Scene đã được chỉnh tay trên Studio (detached); compiler bị chặn ghi đè. Truyền forceResync:true nếu muốn đồng bộ lại từ plan.',409,'SCENE_DETACHED');
    }
    if(documentRevision!==undefined&&documentRevision!==existing.revision){
      fail('Scene đã thay đổi. Đọc lại documentRevision trước khi cập nhật.',409,'REVISION_CONFLICT');
    }
    this.db.prepare('INSERT OR IGNORE INTO edit_history VALUES(?,?,?,?)').run(source.id,existing.revision,existing.document,now());
    const nextDoc={...doc,revision:existing.revision+1};
    this.db.prepare('UPDATE scenes SET source=?,document=?,revision=? WHERE id=?').run(encode(stamped),encode(nextDoc),nextDoc.revision,source.id);
    this.db.prepare('UPDATE projects SET updated_at=? WHERE id=?').run(now(),projectId);
    return {created:false,scene:stamped,document:nextDoc,projectRevision:p.revision};
  });}
  rememberProject(p){this.db.prepare('INSERT OR IGNORE INTO project_history VALUES(?,?,?,?,?)').run(p.id,p.revision,encode(p.sceneOrder),p.title,now());}
  delete(id,{revision}){return this.transaction(()=>{
    // Archived projects are hidden from get(); deleting them must still be possible.
    const row=this.db.prepare('SELECT revision,locked_prefix FROM projects WHERE id=?').get(id);if(!row)fail('Không tìm thấy dự án.',404);
    const p={revision:row.revision,lockedPrefix:parse(row.locked_prefix),scenes:this.db.prepare('SELECT id FROM scenes WHERE project_id=?').all(id)};
    if(revision!==p.revision)fail('Dự án đã thay đổi. Tải lại trước khi xóa.',409,'REVISION_CONFLICT');
    if(p.lockedPrefix.length)fail('Scene đã duyệt đang được bảo vệ.',409,'PROJECT_PROTECTED');
    this.db.prepare('DELETE FROM edit_history WHERE scene_id IN (SELECT id FROM scenes WHERE project_id=?)').run(id);
    this.db.prepare('DELETE FROM scenes WHERE project_id=?').run(id);
    this.db.prepare('DELETE FROM project_history WHERE project_id=?').run(id);
    this.db.prepare('DELETE FROM projects WHERE id=?').run(id);
    this.db.prepare("DELETE FROM meta WHERE key IN (?,?,?) OR key LIKE ?").run('episode-workflow:'+id,'project-mode:'+id,'production-transition:'+id,'episode-review:'+id+':%');
    return {id,deleted:true,sceneCount:p.scenes.length};
  });}
  removeScene(projectId,sceneId,{revision,documentRevision},onRemoved=()=>{}){return this.transaction(()=>{
    const p=this.get(projectId),row=this.scene(sceneId,projectId);
    if(p.revision!==revision||row.revision!==documentRevision)fail('Cảnh đã thay đổi. Tải lại trước khi làm lại.',409,'REVISION_CONFLICT');
    if(p.lockedPrefix.includes(sceneId))fail('Cảnh đã duyệt đang được bảo vệ.',409,'SCENE_LOCKED');
    const archive={source:parse(row.source),document:parse(row.document),history:this.db.prepare('SELECT * FROM edit_history WHERE scene_id=?').all(sceneId)};
    this.db.prepare('INSERT INTO meta VALUES(?,?)').run('removed-scene:'+randomUUID(),encode({...archive,projectId,removedAt:now()}));
    this.db.prepare('DELETE FROM edit_history WHERE scene_id=?').run(sceneId);
    this.db.prepare('DELETE FROM scenes WHERE id=?').run(sceneId);
    this.rememberProject(p);this.db.prepare('UPDATE projects SET scene_order=?,revision=revision+1,updated_at=? WHERE id=?').run(encode(p.sceneOrder.filter(id=>id!==sceneId)),now(),projectId);
    onRemoved();return this.get(projectId);
  });}
  update(id,{revision,title,sceneOrder}){return this.transaction(()=>{
    const p=this.get(id);if(revision!==p.revision)fail('Dự án đã thay đổi ở cửa sổ khác. Tải lại trước khi sắp xếp.',409,'REVISION_CONFLICT');
    const order=sceneOrder??p.sceneOrder;
    if(!Array.isArray(order)||order.length!==p.sceneOrder.length||new Set(order).size!==order.length||order.some(s=>!p.sceneOrder.includes(s)))fail('Thứ tự phải chứa đúng các scene trong dự án.');
    if(p.lockedPrefix.some((id,i)=>order[i]!==id))fail('Các scene đã duyệt ở đầu phim đang được bảo vệ.');
    this.rememberProject(p);this.db.prepare('UPDATE projects SET title=?,scene_order=?,revision=revision+1,updated_at=? WHERE id=?').run(title===undefined?p.title:titleOf(title),encode(order),now(),id);return this.get(id);
  });}
  getEdits(sceneId,projectId){return parse(this.scene(sceneId,projectId).document);}
  saveEdits(sceneId,input,projectId){return this.transaction(()=>{
    const row=this.scene(sceneId,projectId),p=this.get(row.project_id),source=parse(row.source),doc=validateDocument(input,source.duration);
    if(p.lockedPrefix.includes(sceneId))fail('Scene đã được duyệt và khóa. Bản gốc được bảo vệ; chỉnh sửa chưa lưu được giữ trong nháp.',409,'SCENE_LOCKED');
    if(doc.revision!==row.revision)fail('File đã thay đổi ở cửa sổ khác. Mở lại scene để tải bản mới.',409,'REVISION_CONFLICT');
    if(Object.keys(doc.layers).some(key=>!key.startsWith(sceneId+'/shot-')))fail('Layer không thuộc scene đang chỉnh.');
    this.db.prepare('INSERT OR IGNORE INTO edit_history VALUES(?,?,?,?)').run(sceneId,row.revision,row.document,now());
    const next={...doc,revision:row.revision+1};
    const nextSource=source.planState?.status==='plan-managed'?{...source,planState:{...source.planState,status:'detached',detachedAt:now()}}:source;
    this.db.prepare('UPDATE scenes SET source=?,document=?,revision=? WHERE id=?').run(encode(nextSource),encode(next),next.revision,sceneId);
    this.db.prepare('UPDATE projects SET updated_at=? WHERE id=?').run(now(),row.project_id);return next;
  });}
  history(sceneId,projectId){this.scene(sceneId,projectId);return this.db.prepare('SELECT revision,saved_at FROM edit_history WHERE scene_id=? ORDER BY revision DESC LIMIT 50').all(sceneId);}
  restore(sceneId,{revision,restoreRevision},projectId){const previous=this.db.prepare('SELECT document FROM edit_history WHERE scene_id=? AND revision=?').get(sceneId,restoreRevision);if(!previous)fail('Không tìm thấy phiên bản cần khôi phục.',404);return this.saveEdits(sceneId,{...parse(previous.document),revision},projectId);}
}

const json=file=>parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function copyVerifiedTree(from,to,records){
  if(!existsSync(from))return;mkdirSync(to,{recursive:true});
  for(const entry of readdirSync(from,{withFileTypes:true})){const src=join(from,entry.name),dest=join(to,entry.name);if(entry.isSymbolicLink())fail('Không chuyển tài nguyên qua symbolic link.');if(entry.isDirectory())copyVerifiedTree(src,dest,records);else{const bytes=readFileSync(src),sha256=hash(bytes);if(!existsSync(dest))copyFileSync(src,dest);if(hash(readFileSync(dest))!==sha256)fail('Bản sao tài nguyên khác nguồn: '+src);records.push({source:src,destination:dest,sha256,bytes:bytes.length});}}
}
const ranges=(points,duration)=>{const list=[0,...points,duration].filter((n,i,a)=>a.indexOf(n)===i).sort((a,b)=>a-b);return list.slice(0,-1).map((from,i)=>({from,to:list[i+1]}));};
export function migrateLegacy(store,{editorRoot=import.meta.dirname,targetRoot=dataRoot}={}){
  if(store.db.prepare("SELECT value FROM meta WHERE key='legacy-migration-v1'").get())return;
  const ep=resolve(editorRoot,'../preproduction/nhat-thanh/EP01'),backup=resolve(targetRoot,'backups','legacy-v1'),records=[];
  mkdirSync(backup,{recursive:true});
  const savedPath=resolve(editorRoot,'saved-edits.json'),saved=json(savedPath),episode=json(resolve(ep,'episode.json'));
  for(const file of [savedPath,resolve(ep,'episode.json')]){const dest=resolve(backup,file===savedPath?'saved-edits.json':'episode.json');if(!existsSync(dest))copyFileSync(file,dest);if(hash(readFileSync(file))!==hash(readFileSync(dest)))fail('Bản sao lưu đã khác nguồn; dừng chuyển đổi.');}
  copyVerifiedTree(resolve(editorRoot,'created-scenes'),resolve(backup,'created-scenes'),records);
  copyVerifiedTree(resolve(ep,'S01/public'),resolve(targetRoot,'media'),records);
  mkdirSync(resolve(targetRoot,'jobs'),{recursive:true});
  for(const name of readdirSync(resolve(editorRoot,'created-scenes')).filter(n=>n.endsWith('.audio.json')))copyFileSync(resolve(editorRoot,'created-scenes',name),resolve(targetRoot,'jobs',name));
  const s01=json(resolve(ep,'S01/scene-data.json')),s03=json(resolve(ep,'S03/edit-v4.json')),s05=json(resolve(ep,'S05/scene-data.json')),s06=json(resolve(ep,'S06/scene-data.json'));
  const meta={S01:{duration:1506,shots:s01.shots},S02:{duration:1732,shots:ranges([328,688,1000,1324],1732)},S03:{duration:s03.total,shots:ranges(Object.values(s03.cuts),s03.total)},S04:{duration:1197,shots:ranges([90,158,238,312,374,450,555,604,685,779,839,935,1022,1108],1197)},S05:{duration:1516,shots:s05.shots},S06:{duration:1396,shots:s06.beats.map(b=>({...b,label:b.view}))}};
  const additions=readdirSync(resolve(editorRoot,'created-scenes')).filter(n=>n.endsWith('.scene.json')).map(n=>{const source=json(resolve(editorRoot,'created-scenes',n));return {source,doc:json(resolve(editorRoot,'created-scenes',n.replace('.scene.json','.edits.json')))};});
  const locked=[];for(const s of episode.scenes??[]){if(s.status!=='approved-by-user')break;if(meta[s.id])locked.push(s.id);}
  writeFileSync(resolve(backup,'migration-evidence.json'),encode({at:now(),episodeRevision:episode.revision,project:legacyProjectId,sceneCount:6+additions.length,lockedPrefix:locked,files:records},null,2));
  store.transaction(()=>{
    store.create('Nhật Thành · EP01',legacyProjectId);
    const order=[];
    for(const [id,m] of Object.entries(meta)){const source={id,title:id,kind:'authored',compositionKey:id,...m};const doc=validateDocument(saved[id],m.duration);store.db.prepare('INSERT INTO scenes VALUES(?,?,?,?,?)').run(id,legacyProjectId,encode(source),encode(doc),doc.revision);order.push(id);}
    for(const {source,doc} of additions){validateDocument(doc,source.duration);store.db.prepare('INSERT INTO scenes VALUES(?,?,?,?,?)').run(source.id,legacyProjectId,encode({...source,kind:'created'}),encode(doc),doc.revision);order.push(source.id);}
    store.db.prepare('UPDATE projects SET scene_order=?,locked_prefix=? WHERE id=?').run(encode(order),encode(locked),legacyProjectId);
    store.db.prepare('INSERT INTO meta VALUES(?,?)').run('legacy-migration-v1',encode({at:now(),episodeRevision:episode.revision,backup}));
  });
}
let singleton;
export function getProjectStore(){if(!singleton){const candidate=new ProjectStore(resolve(dataRoot,'projects.sqlite'),{productionMode:true});try{if(process.env.EDITOR_SKIP_LEGACY_MIGRATION!=='1')migrateLegacy(candidate);singleton=candidate;}catch(error){candidate.close();throw error;}}return singleton;}
