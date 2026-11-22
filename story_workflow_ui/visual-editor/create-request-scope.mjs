import {EditSession} from './edit-session.mjs';
export class CreateRequestScope extends EditSession{
 selectDraft(project,draft){this.select(JSON.stringify([project,draft.id,draft.text,draft.voiceId]));}
 invalidate(){this.select(null);}
}
export async function applySceneRequest(scope,request,{onValue,onError,onSettled}={}){
 const current=scope.capture();let ok=false,error;
 try{const value=await request();if(current()){await onValue?.(value,current);ok=true;}}
 catch(failure){error=failure;if(current())await onError?.(failure);}
 finally{if(current())onSettled?.();}
 return {ok,current:current(),...(error?{error}:{})};
}
