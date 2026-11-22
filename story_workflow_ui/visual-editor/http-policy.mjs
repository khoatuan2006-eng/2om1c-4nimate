export function isLocalHost(req){
 const port=req.socket?.localPort;
 return Number.isInteger(port)&&['127.0.0.1','localhost','[::1]'].some(host=>req.headers.host===`${host}:${port}`);
}
export function isLocalWrite(req){
 return isLocalHost(req)&&['127.0.0.1','localhost','[::1]'].some(host=>req.headers.origin===`http://${host}:${req.socket.localPort}`);
}
export function jsonResponse(res,status,value){
 if(res.writableEnded||res.destroyed)return;
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
 res.end(JSON.stringify(value));
}
