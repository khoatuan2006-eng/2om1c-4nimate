/**
 * @param {string} path
 * @param {any} [body]
 * @param {typeof fetch} [fetcher]
 * @param {{headers?:Record<string,string>,timeoutMs?:number}} [options]
 */
export async function requestSceneResource(path,body=undefined,fetcher=fetch,options={}){
 const timeoutMs=options?.timeoutMs??15000;
 let response;
 try{response=await fetcher(path,{...(body?{method:'POST',headers:{'Content-Type':'application/json',...(options?.headers??{})},body:JSON.stringify(body)}:{cache:'no-store'}),signal:AbortSignal.timeout(timeoutMs)});}
 catch(error){
  if(['TypeError','TimeoutError','AbortError'].includes(error.name))throw Object.assign(Error(body?'Chưa nhận được xác nhận từ máy chủ. Nội dung được giữ; kiểm tra lại công việc trước khi gửi tiếp.':'Chưa kết nối được máy chủ. Nội dung được giữ; kiểm tra kết nối rồi thử lại.'),{code:'CONNECTION_UNCONFIRMED',cause:error});
  throw error;
 }
 let data;
 try{data=await response.json();}catch{throw Object.assign(Error('Phản hồi máy chủ chưa hợp lệ. Nội dung được giữ; kiểm tra lại rồi thử tiếp.'),{status:response.status,code:'INVALID_RESPONSE'});}
 if(!response.ok)throw Object.assign(Error(typeof data?.error==='string'?data.error:'Máy chủ chưa xử lý được yêu cầu. Nội dung được giữ; hãy thử lại.'),{status:response.status,...(typeof data?.code==='string'?{code:data.code}:{})});
 if(!data||typeof data!=='object')throw Object.assign(Error('Phản hồi máy chủ chưa hợp lệ. Nội dung được giữ.'),{code:'INVALID_RESPONSE'});
 return data;
}
