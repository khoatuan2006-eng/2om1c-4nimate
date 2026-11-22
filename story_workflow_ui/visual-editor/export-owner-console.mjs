import {createInterface} from 'node:readline';
// Trusted host input only. No HTTP/MCP route exposes this capability.
export function attachExportOwnerConsole(app,{input=process.stdin,output=process.stdout,error=process.stderr}={}){
 const owner=createInterface({input});
 owner.on('line',line=>{try{
  const command=JSON.parse(line);if(command.command!=='authorize-export')throw Error('Unknown owner command');
  const grant=app.authorizeExport(command);output.write(JSON.stringify({event:'export-authorized',requestId:grant.requestId,projectId:grant.projectId,expiresAt:grant.expiresAt})+'\n');
 }catch(cause){error.write('Owner command: '+cause.message+'\n');}});
 return ()=>owner.close();
}
