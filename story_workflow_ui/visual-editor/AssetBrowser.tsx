import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AssetDiscovery} from './AssetDiscovery';
import {AssetPreview} from './AssetPreview';
import {PsdArchiveBrowser} from './PsdArchiveBrowser';
import {filterLibrary, libraryPage, libraryText} from './library-browser.mjs';
import {gridTarget} from './grid-navigation.mjs';

const typeLabels: Record<string,string> = {characters:'Nhân vật',props:'Đạo cụ',backgrounds:'Nền',effects:'Hiệu ứng',project:'Ảnh đã dựng'};
const neutralFace = (asset:any) => asset.groups.faces?.find((f:any)=>/无表情|正常|neutral/i.test(f.name)) ?? asset.groups.faces?.[0];
export function AssetLibrary({onAdd,context,proMode=false}:any) {
 const [assets,setAssets]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [mode,setMode]=useState('local'),[collection,setCollection]=useState('all'),[type,setType]=useState('characters');
 const [query,setQuery]=useState(''),[id,setId]=useState(''),[detail,setDetail]=useState(false),[expanded,setExpanded]=useState(false);
 const [pose,setPose]=useState(''),[face,setFace]=useState('__default__'),[variantTab,setVariantTab]=useState('pose'),[variantQuery,setVariantQuery]=useState('');
 const [page,setPage]=useState(0),[variantPage,setVariantPage]=useState(0),[adding,setAdding]=useState(false),[asBackground,setAsBackground]=useState(false);
 const [job,setJob]=useState<any>(null),[ghost,setGhost]=useState<any>(null);
 const panel=useRef<HTMLDivElement>(null),heading=useRef<HTMLButtonElement>(null),catalogButtons=useRef(new Map<string,HTMLButtonElement>()),variantButtons=useRef(new Map<number,HTMLButtonElement>());
 const [focusIndex,setFocusIndex]=useState(0);
 const mounted=useRef(true),requestGeneration=useRef(0),addingRef=useRef(false);
 useEffect(()=>()=>{mounted.current=false;requestGeneration.current++;},[]);
 useEffect(()=>{if(!proMode&&!job&&(mode==='discover'||mode==='queue'))setMode('local');},[proMode,job,mode]);
 const refresh=async()=>{const generation=++requestGeneration.current;try{const r=await fetch('/api/library/catalog');if(!r.ok)throw Error('Không mở được kho tài nguyên');const data=await r.json();if(mounted.current&&generation===requestGeneration.current){setAssets(data);setError('');}return data;}catch(e){if(mounted.current)setError((e as Error).message);return [];}finally{if(mounted.current)setLoading(false);}};
 useEffect(()=>{refresh();},[]);
 const list=filterLibrary(assets,{type,collection,query});
 // Keep the selected identity independent of filters and pagination.
 const asset=assets.find(a=>a.id===id);
 const items=asset?.groups[asset.type==='characters'?'poses':['props','effects'].includes(asset.type)?'props':'layers']??[];
 const selected=items.find((i:any)=>i.id===pose)??items[0];
 const selectedFace=face==='__default__'?(asset&&neutralFace(asset)):asset?.groups.faces?.find((f:any)=>f.id===face);
 const choose=(item:any)=>({name:asset.name+' · '+item.name,type:asset.type==='project'?(asBackground?'backgrounds':'props'):asset.type==='effects'?'props':asset.type,canvas:asset.canvas,items:[item,...(asset.type==='characters'&&selectedFace?[selectedFace]:[])]});
 const catalog=libraryPage(list,page,12);
 const variants=libraryPage((variantTab==='face'?(asset?.groups.faces??[]):items).filter((i:any)=>libraryText(i.name).includes(libraryText(variantQuery))),variantPage,12);
 useEffect(()=>{setPage(0);},[query,collection,type]);
 useEffect(()=>{setVariantPage(0);setFocusIndex(0);},[variantQuery,variantTab,id]);
 useEffect(()=>{setFocusIndex(0);},[variantPage]);
 useLayoutEffect(()=>{if(mode!=='local')return;if(detail)heading.current?.focus();else catalogButtons.current.get(id)?.focus();},[detail,id,mode]);
 useEffect(()=>{if(!expanded)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setExpanded(false);}};panel.current?.addEventListener('keydown',onKey);return()=>panel.current?.removeEventListener('keydown',onKey);},[expanded]);
 const open=(a:any)=>{setId(a.id);setDetail(true);setPose('');setFace('__default__');setVariantTab('pose');setVariantQuery('');setVariantPage(0);setAsBackground(false);};
 const switchCollection=(next:string)=>{setMode('local');setCollection(next);setType(next==='prepared'?'project':type==='project'?'characters':type);setQuery('');};
 const openCandidate=async(target:string)=>{const data=await refresh();if(!mounted.current)return;const found=data.find((a:any)=>a.id===target);if(!found){setError('Chưa tải được bộ vừa extract. Thử mở lại kho.');return;}setMode('local');setCollection(found.collection??'shared');setType(found.type);setQuery('');open(found);};
 const add=async(selection:any,point?:any)=>{if(addingRef.current)return;addingRef.current=true;setAdding(true);setError('');try{await onAdd(selection,point);}catch(e){if(mounted.current)setError((e as Error).message);}finally{addingRef.current=false;if(mounted.current)setAdding(false);}};
 const quickAdd=async(target:string)=>{const data=await refresh();if(!mounted.current)return;const a=data.find((a:any)=>a.id===target);if(!a)return;const item=a.groups.poses?.[0]??a.groups.props?.[0]??a.groups.layers?.[0];const f=neutralFace(a);if(item)await add({name:a.name+' · '+item.name,type:['effects','project'].includes(a.type)?'props':a.type,canvas:a.canvas,items:[item,...(a.type==='characters'&&f?[f]:[])]});};
 const navigate=(event:React.KeyboardEvent<HTMLButtonElement>,index:number)=>{if(event.altKey||event.ctrlKey||event.metaKey)return;const container=event.currentTarget.closest('.browser-variant-grid');const columns=container?getComputedStyle(container).gridTemplateColumns.trim().split(/\s+/).length:1;const target=gridTarget(event.key,index,variants.items.length,columns);if(target===null)return;event.preventDefault();event.stopPropagation();variantButtons.current.get(target)?.focus();};
 const drag=(e:React.PointerEvent<HTMLButtonElement>,item:any)=>{if(adding||variantTab==='face'||e.button!==0)return;const selection=choose(item);const start={x:e.clientX,y:e.clientY},node=e.currentTarget;node.setPointerCapture(e.pointerId);setPose(item.id);const move=(ev:PointerEvent)=>{if(Math.hypot(ev.clientX-start.x,ev.clientY-start.y)>8)setGhost({url:item.url,x:ev.clientX,y:ev.clientY});};const cleanup=()=>{setGhost(null);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',cleanup);};const end=(ev:PointerEvent)=>{if(Math.hypot(ev.clientX-start.x,ev.clientY-start.y)>8)add(selection,{clientX:ev.clientX,clientY:ev.clientY});cleanup();};node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',cleanup);};
 const renderCatalog=()=> <section className="browser-catalog" aria-label="Danh sách bộ tài nguyên">
  <div className="browser-catalog-title"><strong>{typeLabels[type]}</strong><small>{list.length} bộ</small></div>
  <label className="browser-search"><span>Tìm tài nguyên</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tên nhân vật, bối cảnh, đạo cụ…"/></label>
  <div className="browser-filter-row"><label>Nguồn<select value={collection} onChange={e=>switchCollection(e.target.value)}><option value="all">Tất cả đã trích</option><option value="imports">Mới extract (Custom / PSD)</option><option value="shared">Kho chung</option><option value="supplemental">Tài nguyên bổ sung</option><option value="film">EP01 · Nhật Thành</option><option value="prepared">Ảnh dựng EP01</option></select></label></div>
  <nav className="browser-types" aria-label="Loại tài nguyên">{Object.entries(typeLabels).filter(([value])=>collection==='prepared'?value==='project':value!=='project').map(([value,label])=><button key={value} aria-pressed={type===value} onClick={()=>setType(value)}>{label}</button>)}</nav>
  <div className="browser-character-grid">{catalog.items.map((a:any)=>{const image=a.groups.poses?.[0]??a.groups.props?.[0]??a.groups.layers?.[0];return <button className="browser-character" key={a.id} ref={b=>{if(b)catalogButtons.current.set(a.id,b);else catalogButtons.current.delete(a.id);}} aria-pressed={id===a.id&&detail} onClick={()=>open(a)}><div className="browser-character-image">{image?<img src={image.url} alt="" loading="lazy"/>:<span>Chưa có ảnh</span>}</div><strong>{a.name}</strong><small>{(a.groups.poses??a.groups.props??a.groups.layers??[]).length} {a.type==='characters'?'pose':'hình'}{a.groups.faces?.length?' · '+a.groups.faces.length+' face':''}</small></button>;})}</div>
  {loading?<p role="status">Đang mở kho…</p>:!list.length?<div className="browser-empty"><p>Chưa có tài nguyên phù hợp.</p><button onClick={()=>{setQuery('');switchCollection('all');}}>Xem toàn bộ kho</button><button onClick={()=>setMode('archive')}>Tìm trong 7,696 PSD</button>{proMode&&<button onClick={()=>setMode('discover')}>Tìm PSD online</button>}</div>:null}
  <Pager data={catalog} onChange={setPage} label="bộ"/>
 </section>;
 const renderDetail=()=> asset&&detail?<section className="browser-detail" aria-label="Chọn hình trong bộ">
  <div className="browser-detail-heading"><button ref={heading} aria-label="Quay lại danh sách tài nguyên" onClick={()=>setDetail(false)}>←</button><div><strong>{asset.name}</strong><small>{items.length} {asset.type==='characters'?'pose':'hình'}{asset.groups.faces?.length?' · '+asset.groups.faces.length+' face':''}</small></div><button className="browser-detail-expand" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Thu gọn':'Mở rộng'}</button></div>
  {asset.collection==='supplemental'&&<div role="note" style={{padding:12}}><strong>{asset.review?.status==='candidate'?'Chưa duyệt · dùng thử':'Đã có kiểm tra · xem giới hạn'}</strong><p>{asset.capabilities?.join('; ')}</p><p>Giới hạn: {asset.limitations?.join('; ')}</p><p>Nguồn: {asset.provenance?.kind} · {asset.provenance?.tool??'không xác định'}</p>{asset.provenance?.integrityIssues?.map((v:string)=><p key={v}>{v}</p>)}</div>}<div className="browser-detail-body">
  <div className="browser-preview-pane" aria-label="Xem trước toàn bộ nhân vật">
  {selected&&<div className="browser-composite"><AssetPreview selection={choose(selected)} label={asset.name+' · '+selected.name+(selectedFace?' · '+selectedFace.name:'')}/></div>}
  <div className="browser-preview-caption"><strong>{selected?.name??'Chưa chọn hình'}</strong><span>{selectedFace?.name??(asset.type==='characters'?'Chỉ tư thế':'Sẵn sàng')}</span></div>
  </div>
  <div className="browser-choice-pane">
  {asset.type==='characters'&&<details className="browser-face-options"><summary>Tùy chọn biểu cảm</summary><label className="browser-face-mode">Biểu cảm<select aria-label="Face nhân vật" value={face} onChange={e=>setFace(e.target.value)}><option value="__default__">Mặc định</option><option value="">Chỉ tư thế</option>{(asset.groups.faces??[]).map((f:any,i:number)=><option key={f.id+i} value={f.id}>{f.name}</option>)}</select></label></details>}
  {asset.type==='project'&&<label className="prepared-background"><input type="checkbox" checked={asBackground} onChange={e=>setAsBackground(e.target.checked)}/>Dùng làm nền shot</label>}
  <nav className="browser-variant-tabs" aria-label="Loại hình trong bộ"><button aria-pressed={variantTab==='pose'} onClick={()=>{setVariantTab('pose');setVariantQuery('');}}>{asset.type==='characters'?'Pose':'Hình ảnh'} · {items.length}</button>{asset.type==='characters'&&<button aria-pressed={variantTab==='face'} onClick={()=>{setVariantTab('face');setVariantQuery('');}}>Face · {asset.groups.faces?.length??0}</button>}</nav>
  <label className="browser-search"><span>{variantTab==='face'?'Tìm biểu cảm':'Tìm tư thế / hình'}</span><input value={variantQuery} onChange={e=>setVariantQuery(e.target.value)} placeholder={variantTab==='face'?'Tên face…':'Tên pose…'}/></label>
  <p className="image-keyboard-hint" id="library-image-keys">Mũi tên để duyệt · Enter chọn · Tab đến nút thêm</p>
  <div className="browser-variant-scroll" key={id+':'+variantTab+':'+variants.page+':'+variantQuery}>
  <div className="browser-variant-grid" role="group" aria-label={variantTab==='face'?'Chọn biểu cảm bằng ảnh':'Chọn tư thế bằng ảnh'} aria-describedby="library-image-keys">{variants.items.map((item:any,i:number)=><button className="pose-select" key={item.id+i} ref={b=>{if(b)variantButtons.current.set(i,b);else variantButtons.current.delete(i);}} tabIndex={i===Math.min(focusIndex,variants.items.length-1)?0:-1} onFocus={()=>setFocusIndex(i)} onKeyDown={e=>navigate(e,i)} onPointerDown={e=>drag(e,item)} aria-label={(variantTab==='face'?'Chọn biểu cảm ':'Chọn tư thế ')+item.name} aria-pressed={variantTab==='face'?selectedFace?.id===item.id:selected?.id===item.id} onClick={()=>variantTab==='face'?setFace(item.id):setPose(item.id)}>{variantTab==='face'?<img src={item.url} alt="" loading="lazy"/>:<AssetPreview selection={choose(item)} label={item.name}/>}<span>{item.name}</span></button>)}</div>
  {!variants.total&&<p className="browser-empty">Chưa có hình phù hợp với từ khóa.</p>}
  </div>
  <Pager data={variants} onChange={setVariantPage} label={variantTab==='face'?'biểu cảm':'tư thế'}/>
  </div>
  </div>
  <footer className="picker-footer"><div><strong>{selected?.name??'Chưa chọn hình'}</strong><small>{selectedFace?.name??(asset.type==='characters'?'Chỉ tư thế':'Sẵn sàng')} · từ frame {context?.frame??0}</small></div><button className="primary-action" disabled={!selected||adding} onClick={()=>selected&&add(choose(selected))}>{adding?'Đang thêm…':'＋ Thêm vào cảnh'}</button></footer>
  <details className="browser-origin"><summary>Nguồn và thông tin bộ</summary><p>{asset.name}</p><small>Mã bộ: {asset.id} · {asset.collection??'shared'}</small></details>
 </section>:<div className="browser-detail-placeholder"><strong>Chọn một bộ tài nguyên</strong><p>Pose và face sẽ hiện tại đây để bạn xem trước và thêm vào scene.</p></div>;
 return <div ref={panel} className={'asset-library professional-picker resource-browser mode-'+mode+(expanded?' browser-expanded':'')+(detail?' has-detail':'')}>
  <header className="picker-heading"><h3>Kho tài nguyên</h3><span>{context?.sceneLabel??context?.scene} · frame {context?.frame??0}</span><button className="browser-expand" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Thu gọn':'Mở rộng'}</button></header>
  <nav className="library-tabs" aria-label="Chế độ kho">
   <button aria-pressed={mode==='local'} onClick={()=>setMode('local')}>Đã trích</button>
   <button aria-pressed={mode==='archive'} onClick={()=>setMode('archive')}>Kho 7,696 PSD</button>
   {(proMode||mode==='discover')&&<button aria-pressed={mode==='discover'} onClick={()=>setMode('discover')}>Tìm PSD online</button>}
   {(proMode||!!job||mode==='queue')&&<button aria-pressed={mode==='queue'} onClick={()=>setMode('queue')}>Hàng đợi{job?' · 1':''}</button>}
  </nav>
  <div className="browser-local" hidden={mode!=='local'}>{(expanded||!detail)&&renderCatalog()}{(expanded||detail)&&renderDetail()}</div>
  <div className="browser-archive" hidden={mode!=='archive'}><PsdArchiveBrowser active={mode==='archive'} onOpenExtracted={openCandidate} onQuickAdd={quickAdd} adding={adding}/></div>
  {(proMode||!!job||mode==='discover'||mode==='queue')&&<div className="browser-discovery" hidden={mode!=='discover'&&mode!=='queue'}><AssetDiscovery onChoose={openCandidate} onQuickAdd={quickAdd} adding={adding} context={context} onJobChange={setJob} queueOnly={mode==='queue'}/></div>}
  {error&&<p role="alert" className="discovery-status">{error}</p>}
  {ghost&&<img className="asset-ghost" src={ghost.url} style={{left:ghost.x,top:ghost.y}} alt="Đang kéo tài nguyên"/>}
 </div>;
}
function Pager({data,onChange,label}:any){return <nav className="browser-pagination" aria-label={'Phân trang '+label}><small>{data.total} {label}</small><button aria-label={'Trang '+label+' trước'} disabled={data.page===0} onClick={()=>onChange(data.page-1)}>←</button><span>{data.page+1} / {data.count}</span><button aria-label={'Trang '+label+' sau'} disabled={data.page>=data.count-1} onClick={()=>onChange(data.page+1)}>→</button></nav>;}
