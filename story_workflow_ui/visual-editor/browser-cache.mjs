// Browser drafts are a convenience. A disabled/quota-limited cache must never
// turn a successful server save into a failed save or prevent opening a project.
export function createBrowserCache(getStorage){
 let warning='';const listeners=new Set();
 const fail=()=>{const message='Trình duyệt không lưu được nháp. Hãy lưu chỉnh sửa vào dự án trước khi đóng.';if(warning!==message){warning=message;for(const listener of listeners)listener(warning);}};
 return {
  getItem(key){try{return getStorage().getItem(key);}catch{fail();return null;}},
  setItem(key,value){try{getStorage().setItem(key,value);return true;}catch{fail();return false;}},
  removeItem(key){try{getStorage().removeItem(key);return true;}catch{fail();return false;}},
  keys(prefix=''){try{const storage=getStorage(),keys=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(typeof key==='string'&&key.startsWith(prefix))keys.push(key);}return keys;}catch{fail();return [];}},
  subscribe(listener){listeners.add(listener);listener(warning);return ()=>{listeners.delete(listener);};},
  get warning(){return warning;},
 };
}
export const browserCache=createBrowserCache(()=>window.localStorage);
export const browserSessionCache=createBrowserCache(()=>window.sessionStorage);
