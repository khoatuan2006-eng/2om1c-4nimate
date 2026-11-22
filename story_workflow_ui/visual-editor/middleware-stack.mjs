// Small Connect-compatible adapter. Route modules do not require the Vite runtime.
export function middlewareStack(onError){
 const routes=[];
 const use=(path,handle)=>{if(typeof path==='function'){handle=path;path='';}routes.push({path,handle});};
 const run=(req,res,done)=>{
  let index=0;
  const next=error=>{
   if(error)return onError(error,req,res);
   if(res.writableEnded||res.destroyed)return;
   const route=routes[index++];if(!route)return done();
   const pathname=req.url.split('?')[0];
   if(route.path&&pathname!==route.path&&!pathname.startsWith(route.path+'/'))return next();
   const original=req.url;let advanced=false;
   if(route.path)req.url=req.url.slice(route.path.length)||'/';
   if(req.url.startsWith('?'))req.url='/'+req.url;
   const resume=error=>{if(advanced)return;advanced=true;req.url=original;next(error);};
   try{Promise.resolve(route.handle(req,res,resume)).catch(resume);}catch(error){resume(error);}
  };next();
 };
 return {use,run};
}
