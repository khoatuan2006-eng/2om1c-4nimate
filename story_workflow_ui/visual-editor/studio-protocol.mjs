// Capabilities of the installed backend, not caller-supplied workflow approval.
export const studioAgentProtocol=Object.freeze({name:'doyin-studio-production',version:1});
export async function requireStudioProtocol(baseUrl,{sessionCookie,fetchImpl=fetch}={}){
 const response=await fetchImpl(new URL('/api/health',baseUrl),{redirect:'error',signal:AbortSignal.timeout(5000),headers:sessionCookie?{Cookie:sessionCookie}:{}});
 if(!response.ok)throw Error('Studio health/authentication unavailable: HTTP '+response.status);
 const health=await response.json();
 if(health.status!=='ready'||health.runtime!=='standalone'||health.agentProtocol?.name!==studioAgentProtocol.name||health.agentProtocol?.version!==studioAgentProtocol.version||!/^([a-f0-9]{64})$/.test(health.identity??'')||!/^([a-f0-9]{64})$/.test(health.version??''))throw Error('Studio agent protocol unavailable or incompatible. Save work and restart the existing Studio with the current launch-editor; do not create another renderer or database.');
 return health;
}
