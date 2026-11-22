import {browserCache,browserSessionCache} from './browser-cache.mjs';
import {sceneDraftStore} from './create-scene-drafts.mjs';
import {requestSceneResource} from './create-scene-api.mjs';
import {CreateRequestScope,applySceneRequest} from './create-request-scope.mjs';
import {assertAudioDraft} from './audio-draft.mjs';
import React,{useEffect,useRef,useState} from 'react';
import './create-scene.css';
import {useModal} from './useModal';

const images=(asset:any)=>{const seen=new Set();return (Object.values(asset.groups).flat() as any[]).filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true;});};
const fresh=()=>({id:crypto.randomUUID(),title:'',text:'',voiceId:'',backgroundId:'',step:0});
const restore=(projectId:string)=>sceneDraftStore.read(projectId,fresh);
const api=(path:string,body?:any)=>requestSceneResource('/api/created-scenes'+path,body);

export function CreateSceneDialog({open,onClose,onCreated,projectId,scenes=[],currentSceneId}:any){
  const [draft,setDraft]=useState<any>(()=>restore(projectId)),[voices,setVoices]=useState<any[]>([]),[job,setJob]=useState<any>(null),[error,setError]=useState(''),[pending,setPending]=useState(false),[creating,setCreating]=useState(false),[catalog,setCatalog]=useState<any[]>([]),[query,setQuery]=useState(''),[loading,setLoading]=useState(false),[pollReload,setPollReload]=useState(0),[jobMissing,setJobMissing]=useState(false),[jobConflict,setJobConflict]=useState(false),[loadReload,setLoadReload]=useState(0),[resourceError,setResourceError]=useState(''),[savedDrafts,setSavedDrafts]=useState<any[]|null>(null);
  
  const [createMode,setCreateMode]=useState<'continue'|'new'>('continue');
  const [prevSceneId,setPrevSceneId]=useState<string>('');

  const dialog=useModal(open);
  const requestScope=useRef(new CreateRequestScope());requestScope.current.selectDraft(projectId,draft);
  useEffect(()=>{requestScope.current.selectDraft(projectId,draft);return()=>requestScope.current.invalidate();},[]);
  const patch=(v:any)=>setDraft((d:any)=>({...d,...v}));
  useEffect(()=>{sceneDraftStore.write(projectId,draft);},[draft]);

  useEffect(()=>{
    if(open){
      const sceneList = scenes || [];
      const candidate = currentSceneId && sceneList.some((s:any)=>s.id===currentSceneId)
        ? currentSceneId
        : (sceneList.length>0 ? sceneList[sceneList.length-1]?.id : '');
      setPrevSceneId(candidate||'');
      if(!candidate)setCreateMode('new');
    }
  },[open,currentSceneId,scenes]);

  const targetPrevScene = (scenes||[]).find((s:any)=>s.id===prevSceneId) || ((scenes||[]).length>0 ? (scenes||[])[(scenes||[]).length-1] : null);

  useEffect(()=>{if(!open)return;let live=true;
    setResourceError('');api('/voices').then(d=>{if(!live)return;if(!Array.isArray(d.voices)||!d.voices.length||d.voices.some((v:any)=>typeof v.id!=='string')||typeof d.defaultVoiceId!=='string')throw Error('Danh sách giọng đọc chưa hợp lệ. Hãy tải lại giọng và nền.');setVoices(d.voices);setDraft((v:any)=>({...v,voiceId:v.voiceId||d.defaultVoiceId}));}).catch(e=>{if(live)setResourceError(e.message)});
    setLoading(true);requestSceneResource('/api/library/catalog').then(d=>{if(live){if(!Array.isArray(d))throw Error('Kho nền chưa hợp lệ. Hãy tải lại giọng và nền.');setCatalog(d.filter((a:any)=>a.type==='backgrounds'));}}).catch(e=>{if(live)setResourceError(e.message)}).finally(()=>{if(live)setLoading(false)});
    return()=>{live=false;};
  },[open,loadReload]);

  useEffect(()=>{if(!draft.started||pending)return;let live=true,timer:any;
    const poll=async()=>{await applySceneRequest(requestScope.current,()=>api('/audio?id='+draft.id),{
      onValue:(d:any)=>{if(!live)return;assertAudioDraft(d,draft,projectId);setJob(d);setJobConflict(false);setJobMissing(false);setError('');if(['queued','running','cancelling'].includes(d.status))timer=setTimeout(poll,1500);},
      onError:(e:any)=>{if(!live)return;setJobMissing(e.status===404);setJobConflict(e.status===409);if(e.status===409||e.code==='INVALID_AUDIO_JOB')setJob(null);setError(e.status===404?'Không tìm thấy audio của bản nháp trên máy chủ. Kiểm tra lại hoặc gửi lại cùng bản nháp.':e.message);if(![404,409].includes(e.status))timer=setTimeout(poll,5000);}
    });};
    poll();return()=>{live=false;clearTimeout(timer);};
  },[draft.id,draft.text,draft.voiceId,draft.started,projectId,pending,pollReload]);

  const start=async()=>{if(pending)return;const submitted={...draft,started:true,step:1};setPending(true);setError('');setJobMissing(false);setDraft(submitted);sceneDraftStore.write(projectId,submitted);
    await applySceneRequest(requestScope.current,()=>api('/audio',{id:submitted.id,projectId,text:submitted.text,voiceId:submitted.voiceId}),{
      onValue:(d:any)=>{assertAudioDraft(d,submitted,projectId);setJob(d);},
      onError:(e:any)=>{setError(e.message);if(e.status>=400&&e.status<500&&e.status!==409)patch({started:false,step:0});},
      onSettled:()=>setPending(false)
    });
  };
  const cancel=async()=>{if(pending)return;setPending(true);await applySceneRequest(requestScope.current,()=>api('/audio/cancel',{id:draft.id,projectId}),{onValue:(d:any)=>setJob(assertAudioDraft(d,draft,projectId)),onError:(e:any)=>setError(e.message),onSettled:()=>setPending(false)});};
  const resetAudio=()=>{setJob(null);setJobConflict(false);setJobMissing(false);setError('');patch({id:crypto.randomUUID(),started:false,step:0});};

  const create=async()=>{if(creating)return;setCreating(true);setError('');
    const payload:any={id:draft.id,projectId,title:draft.title,backgroundId:draft.backgroundId};
    if(createMode==='continue'&&(prevSceneId||targetPrevScene?.id)){
      payload.continueFromSceneId=prevSceneId||targetPrevScene?.id;
    }
    await applySceneRequest(requestScope.current,()=>api('',payload),{
      onValue:async(source:any,current:any)=>{if(source?.id!=='NEW-'+draft.id||source.kind!=='created'||!Number.isSafeInteger(source.duration)||source.duration<1)throw Error('Chưa nhận được đúng đoạn vừa tạo. Nội dung được giữ; kiểm tra lại trước khi mở.');await onCreated(source);if(!current())return;setCreating(false);setDraft(fresh());setJob(null);onClose();},
      onError:(e:any)=>setError(e.message),onSettled:()=>setCreating(false)
    });
  };

  const busy=pending||['queued','running','cancelling'].includes(job?.status),complete=job?.status==='complete',lines=draft.text.split(/\r?\n/).filter((s:string)=>s.trim()),valid=!!draft.title.trim()&&draft.title.trim().length<=100&&lines.length>0&&lines.length<=100&&lines.every((s:string)=>s.length<=2000)&&!!draft.voiceId;
  const choices=catalog.flatMap(a=>images(a).map((item:any,index:number)=>({...item,owner:a.name,collection:a.collection,primary:index===0})));
  const selected=choices.find(c=>c.id===draft.backgroundId),filtered=catalog.filter(a=>a.name.toLowerCase().includes(query.toLowerCase()));
  const canCreate = complete && !creating && !!draft.title.trim() && (createMode==='continue' || !!selected);

  if(!open)return null;
  return <div className="create-overlay" onKeyDown={e=>{
    e.stopPropagation();if(e.key==='Escape'&&!creating)onClose();
  }}><div className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title" ref={dialog}>
    <div className="create-heading"><div><small>THÊM NỘI DUNG</small><h2 id="create-title">Tạo đoạn mới</h2></div><button className="create-close" aria-label="Đóng tạo đoạn" disabled={creating} onClick={onClose}>✕</button></div>
    <div className="create-steps">{['Thoại','Giọng đọc','Nền'].map((name,index)=><button key={name} className={draft.step===index?'current':draft.step>index?'done':''} disabled={creating||index>0&&!draft.started||index===2&&!complete} onClick={()=>patch({step:index})}><b>{index+1}</b>{name}</button>)}</div>
    <div className="create-content">
      {draft.step===0&&<>
        <button className="create-text-button" onClick={()=>setSavedDrafts(sceneDraftStore.list(projectId))}>Nháp tạo đoạn đã giữ</button>
        {savedDrafts&&<div className="create-audio-list">{!savedDrafts.length&&<p>Chưa có nháp tạo đoạn được giữ.</p>}{savedDrafts.map((entry:any,i:number)=><div key={entry.key}><div><strong>{entry.draft.title||'Đoạn chưa đặt tên'}</strong><p>{entry.draft.text.slice(0,120)}</p><small>{entry.draft.started?'Đã gửi audio · tiếp tục cùng công việc':'Chưa tạo audio'} · {entry.updatedAt}</small></div><button disabled={busy||creating} onClick={()=>{try{const next=sceneDraftStore.adopt(projectId,draft,entry);setJob(null);setError('');setJobMissing(false);setJobConflict(false);setDraft(next);setSavedDrafts(null);}catch(e:any){setError(e.message);}}} aria-label={'Mở nháp tạo đoạn '+(i+1)}>Mở nháp</button></div>)}</div>}

        {scenes && scenes.length > 0 && (
          <div className="create-mode-switch">
            <button
              type="button"
              className={`create-mode-card ${createMode === 'continue' ? 'selected' : ''}`}
              onClick={() => setCreateMode('continue')}
            >
              <div className="create-mode-icon">🔗</div>
              <div>
                <strong>Nối tiếp cảnh trước</strong>
                <small>Kế thừa bối cảnh &amp; vị trí nhân vật khung hình cuối</small>
              </div>
            </button>
            <button
              type="button"
              className={`create-mode-card ${createMode === 'new' ? 'selected' : ''}`}
              onClick={() => setCreateMode('new')}
            >
              <div className="create-mode-icon">✨</div>
              <div>
                <strong>Cảnh mới độc lập</strong>
                <small>Bối cảnh hoàn toàn mới từ kho ảnh</small>
              </div>
            </button>
          </div>
        )}
        {createMode === 'continue' && scenes && scenes.length > 0 && (
          <div className="create-mode-target">
            <label>Nối tiếp sau cảnh:</label>
            <select
              value={prevSceneId}
              onChange={(e) => setPrevSceneId(e.target.value)}
              disabled={creating}
            >
              {scenes.map((s: any, idx: number) => (
                <option key={s.id} value={s.id}>
                  {idx + 1}. {s.title || s.id} ({s.duration ? (s.duration / 30).toFixed(1) + 's' : 'đoạn'})
                </option>
              ))}
            </select>
          </div>
        )}

        <h3>Cốt truyện của đoạn</h3><p>Nhập thoại có sẵn, mỗi dòng là một phụ đề. Thời lượng sẽ lấy từ giọng đọc.</p>
        <label>Tên đoạn<input aria-label="Tên đoạn mới" maxLength={100} placeholder="Ví dụ: Canis trèo tường đuổi theo" value={draft.title} onChange={e=>patch({title:e.target.value})}/></label>
        <label>Sub / lời thoại<textarea aria-label="Sub đoạn mới" disabled={draft.started||pending} rows={5} placeholder={'Nhập dòng thoại thứ nhất…\nNhập dòng thoại tiếp theo…'} value={draft.text} onChange={e=>patch({text:e.target.value})}/></label>
        <div className="create-field-meta"><span>{lines.length} dòng</span><span>Mỗi đoạn là một timeline liên tục</span></div>
        <label>Giọng đọc<select aria-label="Giọng đọc đoạn mới" disabled={draft.started||pending} value={draft.voiceId} onChange={e=>patch({voiceId:e.target.value})}>{!voices.length&&<option value="">Đang tải giọng…</option>}{voices.map(v=><option key={v.id} value={v.id}>{v.label||v.name}</option>)}</select></label>
        {draft.started&&<button className="create-text-button" disabled={busy} onClick={resetAudio}>Thay thoại / giọng và tạo audio mới</button>}
      </>}
      {draft.step===1&&<>
        <h3>{complete?'Giọng đọc đã sẵn sàng':'Tạo giọng đọc'}</h3>
        <p>Audio và phụ đề xác định độ dài đoạn. Bạn dựng hình ảnh trên thời lượng này.</p>
        <div className="create-audio-status" role="status"><strong>{complete?`${(job.duration/30).toFixed(2)} giây · ${job.cues.length} dòng`:job?.status==='cancelling'?'Đang dừng sau dòng hiện tại…':busy?`Đang tạo dòng ${job?.current||1} / ${lines.length}`:'Chưa tạo xong audio'}</strong><progress max={lines.length||1} value={job?.cues.length||0}/><span>{busy?'Bạn có thể đóng cửa sổ này; audio tiếp tục được tạo. Bản nháp được giữ lại.':complete?'Đã đo thời lượng thực tế. Nghe thử trước khi chọn nền.':'Những dòng đã tạo được giữ lại khi tiếp tục.'}</span></div>
        {['failed','interrupted','cancelled'].includes(job?.status)&&<div className="create-error" role="alert"><strong>Chưa tạo được giọng đọc</strong><p>{job.retryable===false?'Chưa xác nhận được kết quả của dòng đang xử lý. Kiểm tra audio trước khi thử lại; yêu cầu gửi lại có thể tạo thêm audio.':'Dịch vụ giọng đọc chưa hoàn tất. Những dòng đã tạo vẫn được giữ lại.'}</p><details><summary>Chi tiết lỗi</summary><p>{job.error?.slice(0,600)}</p></details><button disabled={pending} onClick={start}>Tiếp tục tạo audio</button></div>}
        {busy&&!pending&&job?.status!=='cancelling'&&<button onClick={cancel}>Dừng tạo audio</button>}
        <div className="create-audio-list">{job?.cues.map((c:any,i:number)=><div key={c.cueId}><span>{i+1}</span><div><p>{c.text}</p><audio controls preload="none" src={c.publicPath} aria-label={'Nghe dòng '+(i+1)}/></div><small>{c.durationSec.toFixed(2)}s</small></div>)}</div>
      </>}
      {draft.step===2&&<>
        <h3>Chọn nền cho đoạn</h3>
        {!job&&draft.started&&<p role="status">Đang đọc lại audio. Nền đã chọn được giữ; chỉ thêm đoạn sau khi xác nhận thời lượng.</p>}
        {createMode==='continue'&&targetPrevScene?(
          <div className="create-inherit-banner">
            <div>
              <span>🔗 <strong>Nối tiếp cảnh: {targetPrevScene.title || targetPrevScene.id}</strong></span>
              <p>
                {selected
                  ? `Đã chọn nền mới: "${selected.name}". Vị trí nhân vật/đạo cụ từ khung hình cuối cảnh trước vẫn được giữ nguyên để diễn xuất liền mạch.`
                  : `Tự động kế thừa bối cảnh "${targetPrevScene.backgroundName || 'cảnh trước'}". Bạn có thể bấm "Nối tiếp cảnh & mở editor" ngay, hoặc chọn nền mới dưới đây nếu nhân vật vừa đổi địa điểm.`}
              </p>
            </div>
          </div>
        ):(
          <p>Nền phủ toàn bộ đoạn; bạn có thể bố trí thêm nhân vật và đạo cụ trong editor.</p>
        )}
        <input aria-label="Tìm nền cho đoạn" disabled={creating} placeholder="Tìm trong kho nền đã extract…" value={query} onChange={e=>setQuery(e.target.value)}/>
        {selected&&<div className="create-selected-bg"><img src={selected.url} alt=""/><div><strong>{selected.owner}</strong><small>{selected.name}</small><span>{complete?'Đã chọn · '+(job.duration/30).toFixed(2)+' giây':'Đã chọn · chờ xác nhận thời lượng audio'}</span></div></div>}
        {loading?<p role="status">Đang mở kho nền…</p>:<div className="create-bg-grid">{filtered.map(a=>{const items=images(a),image=items.find(i=>i.id===draft.backgroundId)||items[0];return image&&<div className={'create-bg-card '+(items.some(i=>i.id===draft.backgroundId)?'selected':'')} key={a.id}><button disabled={creating} aria-label={'Chọn nền '+a.name} onClick={()=>patch({backgroundId:image.id})}><img src={image.url} alt="" loading="lazy"/><strong>{a.name}</strong></button>{items.length>1&&<select disabled={creating} aria-label={'Ảnh nền '+a.name} value={image.id} onChange={e=>patch({backgroundId:e.target.value})}>{items.map((item:any)=><option key={item.id} value={item.id}>{item.name||'Ảnh nền'}</option>)}</select>}</div>;})}</div>}
        {!loading&&!filtered.length&&<p>Không có nền phù hợp. Thử từ khóa khác.</p>}
      </>}
      {resourceError&&<div className="create-error" role="alert"><p>{resourceError}</p><button disabled={pending||creating} onClick={()=>setLoadReload(n=>n+1)}>Tải lại giọng và nền</button></div>}
      {error&&<div className="create-error" role="alert"><p>{error.slice(0,600)}</p>{draft.started&&<button disabled={pending||creating} onClick={()=>setPollReload(n=>n+1)}>Kiểm tra lại audio</button>}{jobMissing&&<button disabled={pending||creating} onClick={start}>Gửi lại bản nháp này</button>}{jobConflict&&<button disabled={pending||creating} onClick={resetAudio}>Giữ nội dung · tạo bản nháp mới</button>}</div>}
    </div>
    <div className="create-footer">
      <span>{creating?'Đang lưu và mở đoạn…':(browserCache.warning||browserSessionCache.warning)?'Trình duyệt chưa giữ được nháp tạo đoạn. Giữ cửa sổ này mở và kiểm tra bộ nhớ trình duyệt trước khi đổi nháp.':'Bản nháp riêng cho cửa sổ này'}</span>
      <div>
        {draft.step>0&&<button disabled={creating} onClick={()=>patch({step:draft.step-1})}>Quay lại</button>}
        {draft.step===0?<button className="primary" disabled={!valid||pending||creating} onClick={()=>draft.started?patch({step:1}):start()}>{pending?'Đang bắt đầu…':draft.started?'Xem audio':'Tạo giọng đọc'}</button>:draft.step===1?<button className="primary" disabled={!complete||creating} onClick={()=>patch({step:2})}>Chọn nền →</button>:<button className="primary" disabled={!canCreate} onClick={create}>{creating?'Đang mở…':createMode==='continue'?(selected?'Nối tiếp với nền mới & mở editor':'Nối tiếp cảnh & mở editor'):'Thêm đoạn & mở editor'}</button>}
      </div>
    </div>
  </div></div>;
}
