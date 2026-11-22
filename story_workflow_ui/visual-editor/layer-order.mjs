// Reserved bands apply within the authored containing stacking context.
export function layerRole(tag,style={}){
 if(tag==='IMG'&&style.objectFit==='cover'&&style.width===1920&&style.height===1080)return 'background';
 if(tag==='DIV'&&style.bottom===58&&style.textAlign==='center'&&style.fontWeight===700)return 'subtitle';
 return 'object';
}
export function effectiveZ(role,layer={},frameValue=0,authoredZ=0){
 if(role!=='object'&&!layer.zOrderUnlocked)return role==='background'?0:10000;
 if(layer.base?.z!==undefined||layer.keys?.z?.length)return role==='object'?Math.max(1,Math.min(9999,frameValue)):frameValue;
 return authoredZ;
}
