// Semantic catalog helpers: Vietnamese/English alias matching (reusing asset-name-translations.txt),
// pose facing metadata -> automatic flip calculation, FX scope warnings, and per-location default stages.
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fold} from './asset-index.mjs';

const DEFAULT_TRANSLATIONS_FILE=resolve(import.meta.dirname,'asset-name-translations.txt');
const DEFAULT_REGISTRY_FILE=resolve(import.meta.dirname,'semantic-registry.json');

let cachedTranslations=null;
let cachedRegistry=null;
let cachedRegistryMtime=0;

/** Parse asset-name-translations.txt into Map<originalName, {vi:string[], en:string[], folded:Set<string>}>. */
export function loadTranslations(file=DEFAULT_TRANSLATIONS_FILE){
  if(file===DEFAULT_TRANSLATIONS_FILE&&cachedTranslations)return cachedTranslations;
  const map=new Map();
  let raw='';
  try{raw=readFileSync(file,'utf8');}catch{return map;}
  for(const line of raw.split(/\r?\n/)){
    const trimmed=line.trim();
    if(!trimmed||trimmed.startsWith('#'))continue;
    const eq=trimmed.indexOf('=');
    if(eq<=0)continue;
    const key=trimmed.slice(0,eq).trim();
    const rest=trimmed.slice(eq+1);
    const [viPart='',enPart='']=rest.split('|');
    const vi=viPart.split(',').map(s=>s.trim()).filter(Boolean);
    const en=enPart.split(',').map(s=>s.trim()).filter(Boolean);
    const folded=new Set([fold(key),...vi.map(fold),...en.map(fold)].filter(Boolean));
    map.set(key,{vi,en,folded});
  }
  if(file===DEFAULT_TRANSLATIONS_FILE)cachedTranslations=map;
  return map;
}

export function loadSemanticRegistry(file=DEFAULT_REGISTRY_FILE){
  if(file===DEFAULT_REGISTRY_FILE){
    let mtime=0;
    try{mtime=statSync(file).mtimeMs;}catch{}
    if(cachedRegistry&&mtime===cachedRegistryMtime)return cachedRegistry;
    let data={version:1,poseFacing:{},fxMeta:{},locationStages:{},characterMeta:{}};
    try{data=JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch{}
    cachedRegistry=data;cachedRegistryMtime=mtime;
    return data;
  }
  let data={version:1,poseFacing:{},fxMeta:{},locationStages:{},characterMeta:{}};
  try{data=JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch{}
  return data;
}

/**
 * Match a pose/face/item reference against a catalog group list.
 * Order of precedence:
 * 1. 1-based cell number (as printed on contact sheets)
 * 2. Exact item id or exact item name
 * 3. Case/diacritic-folded exact match on item name or translation alias (Vietnamese/English)
 * 4. Unique substring match on folded translation aliases
 * Returns {item, ambiguous: item[]}. Never guesses when ambiguous.
 */
export function matchCatalogItem(list,ref,{translations=loadTranslations()}={}){
  const text=String(ref??'').trim();
  if(/^\d+$/.test(text)){
    const item=list[Number(text)-1]??null;
    return {item,ambiguous:[]};
  }
  const exact=list.find(i=>i.id===text)??list.find(i=>i.name===text);
  if(exact)return {item:exact,ambiguous:[]};

  const q=fold(text);
  if(!q)return {item:null,ambiguous:[]};

  // Exact alias match (e.g. "tức giận" / "tuc gian" / "angry" -> 生气, "chống nạnh" -> 叉腰)
  const exactAlias=list.filter(i=>{
    if(fold(i.name)===q)return true;
    const entry=translations.get(i.name);
    if(entry?.folded.has(q))return true;
    // Also check base pose name without Right/Left prefix (e.g. 右手出拳 -> 出拳)
    const stripped=i.name.replace(/^(右手|左手|双手)/,'');
    if(stripped&&stripped!==i.name&&translations.get(stripped)?.folded.has(q))return true;
    return false;
  });
  if(exactAlias.length===1)return {item:exactAlias[0],ambiguous:[]};
  if(exactAlias.length>1)return {item:null,ambiguous:exactAlias};

  // Substring alias match (only if unique)
  const partial=list.filter(i=>{
    const entry=translations.get(i.name);
    const stripped=i.name.replace(/^(右手|左手|双手)/,'');
    const strippedEntry=stripped&&stripped!==i.name?translations.get(stripped):null;
    const pool=[...(entry?.folded??[]),...(strippedEntry?.folded??[])];
    return pool.some(term=>term.includes(q));
  });
  if(partial.length===1)return {item:partial[0],ambiguous:[]};
  if(partial.length>1)return {item:null,ambiguous:partial};

  return {item:null,ambiguous:[]};
}

/** Infer default facing direction of a pose: 'left' | 'right' | 'front' | null. */
export function poseFacing(poseName,registry=loadSemanticRegistry()){
  if(!poseName)return null;
  if(registry.poseFacing?.[poseName])return registry.poseFacing[poseName];
  if(poseName.startsWith('右手'))return 'right';
  if(poseName.startsWith('左手'))return 'left';
  return null;
}

/**
 * Resolve horizontal flip for an actor.
 * - Explicit actor.flip (boolean) always wins.
 * - actor.look ('left' | 'right') or actor.faceTo (target actor alias in same beat) computes flip
 *   against poseFacing, falling back to characterMeta.defaultFacing or 'right' (3/4 PSD sprites).
 */
export function resolveActorFlip({actor,poseName,x,beatPositions,assetName,registry=loadSemanticRegistry()}){
  if(typeof actor.flip==='boolean')return actor.flip;
  let desired=actor.look??null;
  if(!desired&&actor.faceTo){
    const targetX=beatPositions.get(actor.faceTo);
    if(Number.isFinite(targetX)&&Number.isFinite(x)&&targetX!==x){
      desired=targetX<x?'left':'right';
    }
  }
  if(!desired)return false;
  const natural=poseFacing(poseName,registry);
  const charDefault=assetName?characterMetaFor(assetName,registry)?.defaultFacing:null;
  const effectiveNatural=(natural==='left'||natural==='right')?natural:(charDefault??'right');
  if(effectiveNatural==='right'&&desired==='left')return true;
  if(effectiveNatural==='left'&&desired==='right')return true;
  return false;
}

export function locationStageFor(locationName,registry=loadSemanticRegistry()){
  if(!locationName||!registry.locationStages)return undefined;
  return registry.locationStages[locationName];
}

export function characterMetaFor(assetName,registry=loadSemanticRegistry()){
  if(!assetName||!registry.characterMeta)return undefined;
  if(registry.characterMeta[assetName])return registry.characterMeta[assetName];
  const base=String(assetName).split('·')[0].trim();
  return registry.characterMeta[base];
}

export function fxMetaFor(effectName,registry=loadSemanticRegistry()){
  if(!effectName||!registry.fxMeta)return undefined;
  return registry.fxMeta[effectName];
}
