import {catalog,prepareCatalogImage} from './library-server.mjs';
/** Resolve ids through the existing catalog/prepare endpoint, not arbitrary client file paths. */
export async function prepareCatalogSelections(inputs,{catalogReader=catalog,prepare=prepareCatalogImage}={}){
 if(!inputs||typeof inputs!=='object'||Array.isArray(inputs)||Object.keys(inputs).length>50)throw Error('Bộ chọn tài nguyên không hợp lệ');
 const current=Object.keys(inputs).length?await catalogReader():[],result={};
 for(const [key,request] of Object.entries(inputs)){if(!/^[a-zA-Z0-9_-]{1,100}$/.test(key)||['__proto__','constructor','prototype'].includes(key)||!request)throw Error('Mã tài nguyên không hợp lệ');
  const owner=current.find(a=>a.id===request.catalogId);if(!owner||!['characters','props','backgrounds','effects'].includes(owner.type))throw Error('Không tìm thấy bộ tài nguyên: '+request.catalogId);
  const ids=request.itemIds;if(!Array.isArray(ids)||!ids.length||ids.length>20||new Set(ids).size!==ids.length)throw Error('Chọn1–20hình riêng biệt trong cùng bộ');
  if(owner.type==='characters'&&ids.length>2)throw Error('Chỉ chọn một pose và tối đa một face');
  const items=ids.map(id=>{const item=Object.values(owner.groups).flat().find(i=>i.id===id);if(!item)throw Error('Ảnh không thuộc bộ '+owner.name);return item;});
  if(owner.type==='characters'&&(!owner.groups.poses?.some(i=>i.id===ids[0])||ids.slice(1).some(id=>!owner.groups.faces?.some(i=>i.id===id))))throw Error('Nhân vật cần pose đầu tiên, sau đó chỉ face của cùng bộ');
  const boxes=items.map(i=>i.bbox),left=Math.min(...boxes.map(b=>b[0])),top=Math.min(...boxes.map(b=>b[1])),width=Math.max(...boxes.map(b=>b[2]))-left,height=Math.max(...boxes.map(b=>b[3]))-top;
  if(!(width>0&&height>0))throw Error('Bounding box không hợp lệ');
  const parts=[];for(const item of items){let src;if(prepare){({src}=await prepare(item.id));}else{
    // Library catalog registers ids internally; use its normal prepare route on the running local runtime via caller adapter.
    throw Error('Catalog prepare adapter is required');
   }if(!/^library-assets\/[a-f0-9]{64}\.png$/.test(src))throw Error('Ảnh chuẩn bị sai định dạng');
   const full=item.width===owner.canvas[0]&&item.height===owner.canvas[1];parts.push({src,left:(full?0:item.bbox[0])-left,top:(full?0:item.bbox[1])-top,width:item.width,height:item.height});}
  result[key]={name:owner.name+' · '+items.map(i=>i.name).join(' + '),type:owner.type,width,height,parts};
 }return result;
}
