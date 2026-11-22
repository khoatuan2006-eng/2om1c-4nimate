// Searchable asset index. A derived, rebuildable SQLite database (never the source of truth):
// the catalog stays authoritative; this file only adds descriptions/translations and FTS5 search.
// Rebuild is idempotent and preserves descriptions already written for an image hash.
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

export const INDEX_VERSION=1;
// Lives beside the editor data it describes, so isolated runtimes/tests never share an index.
export const defaultIndexPath=()=>resolve(process.env.ASSET_INDEX_PATH??resolve(process.env.EDITOR_DATA_DIR??resolve(import.meta.dirname,'data'),'asset-index.sqlite'));
const CJK=/[㐀-鿿]/;
export const hasCjk=text=>CJK.test(text??'');
const now=()=>new Date().toISOString();
const clean=text=>String(text??'').normalize('NFC').replace(/\s+/g,' ').trim();
// Search-friendly form: lowercase + strip Vietnamese diacritics so "chay" matches "chạy".
export const fold=text=>clean(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d');

export class AssetIndex{
  constructor(file=defaultIndexPath(),{readOnly=false}={}){
    if(readOnly){this.db=new DatabaseSync(file,{readOnly:true});return;}
    if(file!==':memory:')mkdirSync(dirname(file),{recursive:true});
    this.db=new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS items(
        id TEXT PRIMARY KEY,            -- sha256 of image bytes (same id as catalog/library)
        asset_id TEXT NOT NULL,         -- owning catalog asset, e.g. film/psd-123
        asset_name TEXT NOT NULL,
        asset_type TEXT NOT NULL,       -- characters | props | backgrounds | effects | project
        collection TEXT NOT NULL,       -- film | shared | imports | supplemental | prepared
        kind TEXT NOT NULL,             -- poses | faces | props | layers
        name TEXT NOT NULL,             -- original name (often Chinese)
        width INTEGER, height INTEGER,
        review_status TEXT,
        style TEXT,                     -- face style from the PSD group: bean | detailed | generic
        seen_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS items_asset ON items(asset_id);
      CREATE INDEX IF NOT EXISTS items_type ON items(asset_type,kind);
      -- One row per language/source so a better description never destroys an older one.
      CREATE TABLE IF NOT EXISTS descriptions(
        item_id TEXT NOT NULL,
        source TEXT NOT NULL,           -- 'name-translation' | 'vision:<model>' | 'manual'
        lang TEXT NOT NULL,
        text TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',-- JSON array: action/emotion/facing/props
        created_at TEXT NOT NULL,
        PRIMARY KEY(item_id,source,lang));
      CREATE INDEX IF NOT EXISTS descriptions_item ON descriptions(item_id);
      CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(item_id UNINDEXED,body,tokenize='unicode61 remove_diacritics 2');
      PRAGMA user_version=${INDEX_VERSION};`);
    // Databases created before face styles existed: add the column in place (derived data, no rebuild needed).
    if(!this.db.prepare('PRAGMA table_info(items)').all().some(c=>c.name==='style'))this.db.exec('ALTER TABLE items ADD COLUMN style TEXT');
  }
  close(){this.db.close();}
  tx(run){
    if(this.db.isTransaction){const name='sp'+(this.depth=(this.depth??0)+1);this.db.exec('SAVEPOINT '+name);
      try{const v=run();this.db.exec('RELEASE '+name);return v;}catch(e){this.db.exec('ROLLBACK TO '+name);this.db.exec('RELEASE '+name);throw e;}finally{this.depth--;}}
    this.db.exec('BEGIN IMMEDIATE');try{const v=run();this.db.exec('COMMIT');return v;}catch(e){try{this.db.exec('ROLLBACK');}catch{}throw e;}}

  /** Mirror catalog items. Items that vanished from the catalog are removed (descriptions follow). */
  sync(catalog){
    const stamp=now(),seen=new Set();let removed=0;
    const upsert=this.db.prepare(`INSERT INTO items(id,asset_id,asset_name,asset_type,collection,kind,name,width,height,review_status,style,seen_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET asset_id=excluded.asset_id,asset_name=excluded.asset_name,asset_type=excluded.asset_type,
      collection=excluded.collection,kind=excluded.kind,name=excluded.name,width=excluded.width,height=excluded.height,review_status=excluded.review_status,style=excluded.style,seen_at=excluded.seen_at`);
    this.tx(()=>{
      for(const asset of catalog)for(const [kind,list] of Object.entries(asset.groups??{}))for(const item of list){
        if(!item?.id||seen.has(item.id))continue;seen.add(item.id);
        upsert.run(item.id,asset.id,clean(asset.name),asset.type,asset.collection,kind,clean(item.name),item.width??null,item.height??null,asset.review?.status??null,item.style??null,stamp);
      }
      const gone=this.db.prepare('SELECT id FROM items WHERE seen_at<>?').all(stamp).map(r=>r.id);
      removed=gone.length;
      for(const id of gone){const rid=this.db.prepare('SELECT rowid AS r FROM items WHERE id=?').get(id)?.r;this.db.prepare('DELETE FROM descriptions WHERE item_id=?').run(id);if(rid)this.db.prepare('DELETE FROM search WHERE rowid=?').run(rid);this.db.prepare('DELETE FROM items WHERE id=?').run(id);}
      for(const row of this.db.prepare('SELECT id FROM items').all())this.reindex(row.id);
    });
    return {items:seen.size,removed};
  }
  /** Cheap incremental step for live search: index catalog items not seen yet (new uploads/extractions).
   *  Removals and renames are left to a full sync(). Returns the number added. */
  addMissing(catalog){
    const known=new Set(this.db.prepare('SELECT id FROM items').all().map(r=>r.id)),fresh=[];
    for(const asset of catalog)for(const [kind,list] of Object.entries(asset.groups??{}))for(const item of list)if(item?.id&&!known.has(item.id)){known.add(item.id);fresh.push([asset,kind,item]);}
    if(!fresh.length)return 0;
    const insert=this.db.prepare('INSERT OR IGNORE INTO items(id,asset_id,asset_name,asset_type,collection,kind,name,width,height,review_status,style,seen_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
    this.tx(()=>{for(const [asset,kind,item] of fresh){insert.run(item.id,asset.id,clean(asset.name),asset.type,asset.collection,kind,clean(item.name),item.width??null,item.height??null,asset.review?.status??null,item.style??null,now());this.reindex(item.id);}});
    return fresh.length;
  }
  /** Rebuild the FTS row for one item from its current name + every description. */
  reindex(id){
    const item=this.db.prepare('SELECT rowid AS rid,* FROM items WHERE id=?').get(id);if(!item)return;
    const desc=this.db.prepare('SELECT text,tags FROM descriptions WHERE item_id=?').all(id);
    const parts=[item.name,item.asset_name,item.asset_type,item.kind,...(item.style?['style:'+item.style,item.style]:[]),...desc.flatMap(d=>[d.text,...JSON.parse(d.tags)])];
    const body=clean(parts.join(' '))+' '+fold(parts.join(' '));
    this.db.prepare('DELETE FROM search WHERE rowid=?').run(item.rid); // rowid delete is O(log n); item_id is UNINDEXED
    this.db.prepare('INSERT INTO search(rowid,item_id,body) VALUES(?,?,?)').run(item.rid,id,body);
  }
  describe(itemId,{source,lang,text,tags=[]}){
    if(!this.db.prepare('SELECT 1 FROM items WHERE id=?').get(itemId))throw Error('Unknown item '+itemId);
    if(!source||!lang||!clean(text))throw Error('source, lang and text are required');
    this.tx(()=>{this.db.prepare(`INSERT INTO descriptions VALUES(?,?,?,?,?,?) ON CONFLICT(item_id,source,lang) DO UPDATE SET text=excluded.text,tags=excluded.tags,created_at=excluded.created_at`)
      .run(itemId,source,lang,clean(text),JSON.stringify([...new Set(tags.map(clean).filter(Boolean))]),now());this.reindex(itemId);});
  }
  /** Items still needing a description of the given source. */
  pending({source,limit=100,cjkOnly=false,type}={}){
    const rows=this.db.prepare(`SELECT i.* FROM items i WHERE NOT EXISTS(SELECT 1 FROM descriptions d WHERE d.item_id=i.id AND d.source LIKE ?) ${type?'AND i.asset_type=?':''} ORDER BY i.asset_type,i.asset_id,i.name`)
      .all(...[source.endsWith('*')?source.slice(0,-1)+'%':source,...(type?[type]:[])]);
    return (cjkOnly?rows.filter(r=>hasCjk(r.name)):rows).slice(0,limit);
  }
  stats(){
    const q=sql=>this.db.prepare(sql).all();
    return {items:q('SELECT COUNT(*) n FROM items')[0].n,
      byType:Object.fromEntries(q('SELECT asset_type t,COUNT(*) n FROM items GROUP BY asset_type').map(r=>[r.t,r.n])),
      distinctNames:q('SELECT COUNT(DISTINCT name) n FROM items')[0].n,
      described:Object.fromEntries(q('SELECT source s,COUNT(*) n FROM descriptions GROUP BY source').map(r=>[r.s,r.n])),
      cjkNames:this.db.prepare('SELECT name FROM items').all().filter(r=>hasCjk(r.name)).length};
  }
  /** Keyword search. Accepts Vietnamese with or without diacritics, Chinese, or English tags. */
  search(query,{type,kind,limit=20,offset=0}={}){
    const terms=fold(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const cjk=clean(query).match(/[㐀-鿿]+/g)??[];
    const all=[...new Set([...terms,...cjk])];if(!all.length)return {total:0,items:[]};
    const match=all.map(t=>'"'+t.replace(/"/g,'""')+'"*').join(' AND ');
    const filters=[type&&'i.asset_type=?',kind&&'i.kind=?'].filter(Boolean),args=[match,...[type,kind].filter(Boolean)];
    const where=filters.length?' AND '+filters.join(' AND '):'';
    const total=this.db.prepare(`SELECT COUNT(*) n FROM search s JOIN items i ON i.id=s.item_id WHERE search MATCH ?${where}`).get(...args).n;
    const rows=this.db.prepare(`SELECT i.*,bm25(search) AS rank FROM search s JOIN items i ON i.id=s.item_id WHERE search MATCH ?${where} ORDER BY rank LIMIT ? OFFSET ?`).all(...args,limit,offset);
    const descOf=this.db.prepare('SELECT source,lang,text,tags FROM descriptions WHERE item_id=?');
    return {total,items:rows.map(r=>({id:r.id,name:r.name,asset:r.asset_name,assetId:r.asset_id,type:r.asset_type,kind:r.kind,collection:r.collection,
      size:[r.width,r.height],...(r.style?{style:r.style}:{}),descriptions:descOf.all(r.id).map(d=>({source:d.source,lang:d.lang,text:d.text,tags:JSON.parse(d.tags)}))}))};
  }
}

/** Parse "name=Vietnamese|tag,tag" lines (# comments and blank lines ignored). */
export function parseTranslations(text){
  const map=new Map();
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();if(!line||line.startsWith('#'))continue;
    const eq=line.indexOf('=');if(eq<1)throw Error('Bad translation line: '+line);
    const [vi,tags='']=line.slice(eq+1).split('|');
    map.set(line.slice(0,eq).trim(),{vi:clean(vi),tags:tags.split(',').map(clean).filter(Boolean)});
  }
  return map;
}
const CHIBI=/\s*\(Chibi\)\s*$/i;
/** Attach vi/en descriptions derived from the item name. Unknown names are reported, never guessed. */
export function applyNameTranslations(index,translations){
  // A scoped key "<asset name>::<item name>" wins over a plain item name (placeholder names repeat across PSDs).
  const items=index.db.prepare('SELECT id,name,asset_name FROM items').all(),unknown=new Map();let applied=0;
  index.tx(()=>{
    for(const item of items){
      if(!hasCjk(item.name))continue;
      const chibi=CHIBI.test(item.name),base=item.name.replace(CHIBI,''),hit=translations.get(item.asset_name+'::'+base)??translations.get(base);
      if(!hit){unknown.set(item.name,(unknown.get(item.name)??0)+1);continue;}
      const tags=[...hit.tags,...(chibi?['chibi']:[])];
      index.describe(item.id,{source:'name-translation',lang:'vi',text:hit.vi+(chibi?' (chibi)':''),tags});applied++;
    }
  });
  return {applied,unknown:[...unknown.keys()]};
}
