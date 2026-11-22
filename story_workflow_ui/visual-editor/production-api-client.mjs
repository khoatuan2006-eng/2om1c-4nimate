import {requireStudioProtocol} from './studio-protocol.mjs';
import {productionFingerprint} from './production-workflow.mjs';

// Reports use the saved-state server gate, never local checksum-only approval.
export async function productionApi(baseUrl='http://127.0.0.1:3022',{fetchImpl=fetch,sessionCookie=process.env.STUDIO_SESSION_COOKIE}={}){
 const base=new URL(baseUrl);
 if(base.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(base.hostname)||base.pathname!=='/'||base.search||base.hash||base.username||base.password)throw Error('Studio must be a loopback origin');
 await requireStudioProtocol(base.origin,{fetchImpl,sessionCookie});
 return async(path,input)=>{
  const response=await fetchImpl(base.origin+path,{method:input===undefined?'GET':'PUT',redirect:'error',headers:{Origin:base.origin,...(sessionCookie?{Cookie:sessionCookie}:{}),...(input===undefined?{}:{'Content-Type':'application/json'})},...(input===undefined?{}:{body:JSON.stringify(input)}),signal:AbortSignal.timeout(20000)});
  const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error??('Studio HTTP '+response.status)),{status:response.status,code:value.code});return value;
 };
}
export async function readProductionSnapshot(api,projectId){
 const id=encodeURIComponent(projectId),project=await api('/api/projects/'+id),gate=await api('/api/production-workflows/'+id);
 if(project.id!==projectId||gate.projectId!==projectId||gate.projectRevision!==project.revision||gate.fingerprint!==productionFingerprint(project)||typeof gate.canExpand!=='boolean'||!Array.isArray(gate.errors)||!Array.isArray(gate.chains))throw Object.assign(Error('Project changed or server gate does not match the saved snapshot; read again before acting'),{status:409});
 return {project,gate};
}
