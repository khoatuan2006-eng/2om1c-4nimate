// On-Demand PSD Archive Index + Thumbnail Preview + Lazy Extract.
// Indexes local PSD archives into a tiny rebuildable SQLite FTS5 database without unpacking
// anything until a specific PSD is requested.
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {existsSync,mkdirSync,readdirSync,readFileSync,statSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fold} from './asset-index.mjs';

const execFileAsync=promisify(execFile);

let localArchiveDir='';
try{({defaultLocalArchiveDir:localArchiveDir}=await import('./psd-archive.local.mjs'));}catch{}

export const defaultArchiveRoot=()=>resolve(process.env.PSD_ARCHIVE_DIR??(localArchiveDir||resolve(import.meta.dirname,'data/psd-archive')));
export const defaultArchiveDbPath=()=>resolve(process.env.PSD_ARCHIVE_DB??resolve(process.env.EDITOR_DATA_DIR??resolve(import.meta.dirname,'data'),'psd-archive.sqlite'));
export const defaultThumbDir=()=>resolve(process.env.EDITOR_DATA_DIR??resolve(import.meta.dirname,'data'),'psd-thumbs');
export const defaultImportsRoot=()=>resolve(process.env.EDITOR_IMPORTS_DIR??resolve(import.meta.dirname,'../preproduction/nhat-thanh/resource-library/imports'));
const EXTRACT_SCRIPT=resolve(import.meta.dirname,'scripts/extract-one-psd.py');

// Lightweight domain bilingual dictionary so Vietnamese/English searches hit Chinese PSD filenames immediately.
const KEYWORD_MAP=[
  [/海盗|海贼|船长|路飞|索隆|山治|香克斯|白胡子|巴基|鹰眼|克洛克|海军/,'hải tặc hải quân pirate marine one piece'],
  [/剑|刀|斩|劈|斧|枪|炮|弓|盾|武器/,'kiếm đao chém súng pháo vũ khí sword blade slash gun cannon weapon'],
  [/特效|烟雾|火焰|雷电|闪电|爆炸|冲击|气场|血|光效|斩击/,'hiệu ứng khói lửa sét nổ aura máu chém fx effect smoke fire lightning explosion blood slash'],
  [/表情|豆豆眼|瞳孔|眼睛/,'biểu cảm khuôn mặt mắt face expression eyes'],
  [/房间|卧室|街道|城镇|港口|码头|甲板|船|森林|山|天空|大厅|教室|办公室|医院|酒店|酒馆|背景|场景/,'bối cảnh nền phòng phố cảng tàu rừng núi trời quán rượu background room street port ship'],
  [/书|卷轴|箱|桌|椅|床|车|手机|电脑|钱|宝箱|酒瓶|灯|门|窗/,'đạo cụ sách cuộn giấy thùng bàn ghế xe tiền rương chai đèn prop book scroll box table car'],
  [/龙|虎|狼|狗|猫|鸟|蛇|蛙|兽|怪|尾|妖|魔/,'quái thú rồng hổ sói chó mèo thú monster dragon beast animal'],
  [/男|女|老|孩|学生|医生|警察|保镖|上班族|路人|修仙|皇帝|将军|士兵|忍者|鸣人|佐助/,'nhân vật người nam nữ lão trẻ học sinh lính ninja character person'],
];

export function cleanPsdName(filename){
  return filename.replace(/\.psd$/i,'').replace(/_\d{10,}$/,'').trim();
}

export function guessPsdType(cleanName){
  if(/特效|烟雾|火焰|雷电|闪电|爆炸|冲击|斩击|劈山|光效|血溅/.test(cleanName))return 'effects';
  if(/背景|场景|房间|卧室|街道|城镇|港口|码头|甲板|大厅|教室|办公室|医院|酒馆|森林|海岸|夜景|室内|室外/.test(cleanName))return 'backgrounds';
  if(/车|书|卷轴|箱|桌|椅|床|手机|电脑|武器|剑|刀|枪|炮|盾|酒瓶|尺|笔|具|灯|门|窗|宝|鞋|甲|裤|幡|面具|钟|锁/.test(cleanName))return 'props';
  return 'characters';
}

function buildSearchBody(cleanName,relPath,guessedType){
  const extras=[];
  for(const [re,tags] of KEYWORD_MAP){if(re.test(cleanName))extras.push(tags);}
  const raw=[cleanName,relPath.replace(/[\\/._-]+/g,' '),guessedType,...extras].join(' ');
  return `${raw} ${fold(raw)}`;
}

export class PsdArchiveIndex{
  constructor(dbPath=defaultArchiveDbPath(),{rootDir=defaultArchiveRoot()}={}){
    this.dbPath=dbPath;
    this.rootDir=rootDir;
    if(dbPath!==':memory:')mkdirSync(dirname(dbPath),{recursive:true});
    this.db=new DatabaseSync(dbPath);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS psd_files(
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rel_path TEXT NOT NULL UNIQUE,
        full_path TEXT NOT NULL,
        folder TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        mtime_ms INTEGER NOT NULL,
        guessed_type TEXT NOT NULL,
        extracted_asset_id TEXT
      );
      CREATE INDEX IF NOT EXISTS psd_files_type ON psd_files(guessed_type);
      CREATE VIRTUAL TABLE IF NOT EXISTS psd_search USING fts5(id UNINDEXED, body, tokenize='unicode61 remove_diacritics 2');
      CREATE TABLE IF NOT EXISTS archive_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  }
  close(){this.db.close();}

  count(){return this.db.prepare('SELECT COUNT(*) AS n FROM psd_files').get().n;}

  /** Recursively scan rootDir for *.psd files and refresh the FTS5 index. */
  scan(rootDir=this.rootDir){
    if(!existsSync(rootDir))return {scanned:0,rootDir,exists:false};
    const found=[];
    const walk=dir=>{
      let entries;
      try{entries=readdirSync(dir,{withFileTypes:true});}catch{return;}
      for(const e of entries){
        const full=join(dir,e.name);
        if(e.isDirectory())walk(full);
        else if(e.isFile()&&/\.psd$/i.test(e.name)){
          let st;try{st=statSync(full);}catch{continue;}
          const rel=relative(rootDir,full).replace(/\\/g,'/');
          const id='psd_'+createHash('sha256').update(rel.toLowerCase()).digest('hex').slice(0,20);
          const name=cleanPsdName(e.name);
          const folder=rel.includes('/')?rel.split('/')[0]:'';
          const guessedType=guessPsdType(name);
          found.push({id,name,rel,full,folder,size:st.size,mtime:Math.round(st.mtimeMs),guessedType});
        }
      }
    };
    const t0=Date.now();
    walk(rootDir);

    const existingExtracted=new Map(
      this.db.prepare('SELECT id, extracted_asset_id FROM psd_files WHERE extracted_asset_id IS NOT NULL').all()
        .map(r=>[r.id,r.extracted_asset_id])
    );

    const insertFile=this.db.prepare('INSERT INTO psd_files(id,name,rel_path,full_path,folder,size_bytes,mtime_ms,guessed_type,extracted_asset_id) VALUES(?,?,?,?,?,?,?,?,?)');
    const insertFts=this.db.prepare('INSERT INTO psd_search(id,body) VALUES(?,?)');

    this.db.exec('BEGIN IMMEDIATE');
    try{
      this.db.exec('DELETE FROM psd_search; DELETE FROM psd_files;');
      for(const f of found){
        insertFile.run(f.id,f.name,f.rel,f.full,f.folder,f.size,f.mtime,f.guessedType,existingExtracted.get(f.id)??null);
        insertFts.run(f.id,buildSearchBody(f.name,f.rel,f.guessedType));
      }
      this.db.prepare('INSERT OR REPLACE INTO archive_meta(key,value) VALUES(?,?)').run('last_scan',JSON.stringify({at:new Date().toISOString(),rootDir,count:found.length,elapsedMs:Date.now()-t0}));
      this.db.exec('COMMIT');
    }catch(e){try{this.db.exec('ROLLBACK');}catch{}throw e;}
    return {scanned:found.length,rootDir,exists:true,elapsedMs:Date.now()-t0};
  }

  ensureScanned(){
    if(this.count()===0&&existsSync(this.rootDir))return this.scan(this.rootDir);
    return null;
  }

  get(id){
    return this.db.prepare('SELECT * FROM psd_files WHERE id=?').get(id)??null;
  }

  markExtracted(id,assetId){
    this.db.prepare('UPDATE psd_files SET extracted_asset_id=? WHERE id=?').run(assetId,id);
  }

  search(query,{type,limit=20,offset=0}={}){
    this.ensureScanned();
    const q=String(query??'').trim();
    const params=[];
    const typeFilter=type?' AND f.guessed_type=?':'';
    if(!q){
      const total=this.db.prepare(`SELECT COUNT(*) AS n FROM psd_files f WHERE 1=1${typeFilter}`).get(...(type?[type]:[])).n;
      const rows=this.db.prepare(`SELECT f.* FROM psd_files f WHERE 1=1${typeFilter} ORDER BY f.name LIMIT ? OFFSET ?`).all(...(type?[type]:[]),limit,offset);
      return {total,items:rows.map(formatRow),nextOffset:offset+limit<total?offset+limit:null};
    }
    const tokens=fold(q).split(/\s+/).filter(Boolean).map(t=>`"${t.replace(/"/g,'')}"*`);
    const matchExpr=tokens.join(' AND ');
    const baseWhere=`psd_search MATCH ?${typeFilter}`;
    if(type)params.push(matchExpr,type); else params.push(matchExpr);

    const total=this.db.prepare(`SELECT COUNT(*) AS n FROM psd_search s JOIN psd_files f ON f.id=s.id WHERE ${baseWhere}`).get(...params).n;
    const rows=this.db.prepare(`SELECT f.*, bm25(psd_search) AS rank FROM psd_search s JOIN psd_files f ON f.id=s.id WHERE ${baseWhere} ORDER BY rank, f.name LIMIT ? OFFSET ?`).all(...params,limit,offset);
    return {total,items:rows.map(formatRow),nextOffset:offset+limit<total?offset+limit:null};
  }
}

function formatRow(r){
  return {
    id:r.id,
    name:r.name,
    relPath:r.rel_path,
    folder:r.folder,
    sizeMB:Math.round((r.size_bytes/1048576)*10)/10,
    guessedType:r.guessed_type,
    extractedCatalogId:r.extracted_asset_id?'import/'+r.extracted_asset_id:null,
  };
}

let singleton=null;
export function getPsdArchive(){
  if(!singleton)singleton=new PsdArchiveIndex();
  return singleton;
}

/** Generate (or reuse cached) 640px PNG thumbnail from a PSD's embedded composite image. */
export async function getPsdThumbnail(id,{archive=getPsdArchive(),thumbDir=defaultThumbDir(),python='python'}={}){
  archive.ensureScanned();
  const row=archive.get(id);
  if(!row)throw Object.assign(Error('Không tìm thấy PSD trong kho: '+id),{status:404});
  if(!existsSync(row.full_path))throw Object.assign(Error('File PSD không tồn tại trên đĩa: '+row.rel_path),{status:404});
  mkdirSync(thumbDir,{recursive:true});
  const thumbPath=resolve(thumbDir,`${row.id}-${row.mtime_ms}.png`);
  if(!existsSync(thumbPath)){
    await execFileAsync(python,[EXTRACT_SCRIPT,'--thumb',row.full_path,'--out',thumbPath,'--max-size','640'],{windowsHide:true,timeout:60000});
  }
  return {bytes:readFileSync(thumbPath),row,thumbPath};
}

/** Lazily extract a single PSD into Studio's imports/ catalog so scene-plan and Studio UI can use it immediately. */
export async function extractPsdAsset(id,{type,label,archive=getPsdArchive(),importsRoot=defaultImportsRoot(),python='python',onExtracted}={}){
  archive.ensureScanned();
  const row=archive.get(id);
  if(!row)throw Object.assign(Error('Không tìm thấy PSD trong kho: '+id),{status:404});
  if(!existsSync(row.full_path))throw Object.assign(Error('File PSD không tồn tại trên đĩa: '+row.rel_path),{status:404});
  const targetType=type??row.guessed_type;
  const targetLabel=(label??row.name).trim()||row.name;
  const assetId=row.id;
  const {stdout}=await execFileAsync(python,[
    EXTRACT_SCRIPT,'--extract',row.full_path,'--out-root',importsRoot,'--id',assetId,'--type',targetType,'--label',targetLabel,
  ],{windowsHide:true,timeout:180000,maxBuffer:10*1024*1024});
  const parsed=JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
  archive.markExtracted(row.id,assetId);
  if(onExtracted)onExtracted();
  return parsed;
}
