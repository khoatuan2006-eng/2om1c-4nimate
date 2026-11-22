import {validateDocument} from './model.mjs';
export function resolveDraft(server,raw,duration,scene,readOnly=false){
  if(!raw)return {status:'none',document:server,draft:null};
  try{
    const draft=validateDocument(JSON.parse(raw),duration);
    if(Object.keys(draft.layers).some(id=>!id.startsWith(scene+'/shot-')))throw Error('Foreign scene draft');
    if(JSON.stringify(draft.layers)===JSON.stringify(server.layers))return {status:'none',document:server,draft:null};
    if(readOnly)return {status:'locked',document:server,draft};
    return draft.revision===server.revision?{status:'restored',document:draft,draft}:{status:'conflict',document:server,draft};
  }catch{return {status:'invalid',document:server,draft:null};}
}
export function readResume(raw){try{const state=JSON.parse(raw||'{}');return {scene:typeof state.scene==='string'?state.scene:'',frame:Number.isSafeInteger(state.frame)&&state.frame>=0?state.frame:0};}catch{return {scene:'',frame:0};}}
