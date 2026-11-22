import {captureLayout,pasteLayout} from './assembly-clipboard.mjs';
import {SocketEditor} from './SocketEditor';
import {ParallaxPanel} from './ParallaxPanel';
import {AssemblyLibraryPanel} from './AssemblyLibraryPanel';
import {AssemblyPanel} from './AssemblyPanel';
import {layoutLocked,duplicateAssembly,deleteAssembly,attachLayer,detachLayer,subtree} from './scene-graph.mjs';
import {splitLayerAtFrame} from './assembly-timing.mjs';
import {useWorkspacePanels} from './useWorkspacePanels';
import {useSelection} from './useSelection';
import {useDragDrop} from './useDragDrop';
import {useTimeline} from './useTimeline';
import {useTransport,TransportContext} from './useTransport';
import {TransportControls} from './TransportControls';
import './error-boundary.css';
import {ErrorBoundary,ErrorNotice} from './ErrorBoundary';
import {QuickAuthoring} from './QuickAuthoring';
import {replaceStoryboardAsset} from './storyboard-model.mjs';
import {Storyboard} from './Storyboard';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {usePreviewPlayback} from './usePreviewPlayback';
import {usePreviewControl} from './usePreviewControl';
import {createRoot} from 'react-dom/client';
import {Player} from '@remotion/player';
import {Composition,FilmComposition,installCompositionProject} from './ProjectComposition';
import {EditHistory} from './EditHistory';
import {applyFramingPreset,detectFramingPreset,applyFocusToLayer,clearFocusAtFrame} from './framing-presets.mjs';
import {ExportDialog} from './ExportDialog';
import {BackupDialog} from './BackupDialog';
import {ProjectsDialog,SceneList,FilmTimeline,projectApi} from './ProjectPanels';
import {EditDocument} from './Editable';
import {sceneMeta} from './scenes';
import {valueAt,setValue,trackFields,trackKeys,editTrackKey} from './model.mjs';
import {effectiveZ} from './layer-order.mjs';
import {AssetLibrary} from './AssetLibrary';
import {CreateSceneDialog} from './CreateSceneDialog';
import {createdScenes} from './CreatedScene';
import {StoryCue} from './StoryCuesStrip';
import {StudioHeader} from './StudioHeader';
import {EpisodeBuilder} from './EpisodeBuilder';
import {StudioTimeline} from './StudioTimeline';
import {ShortcutsDialog} from './ShortcutsDialog';
import {
  IconChevronLeft,
  IconClapper,
  IconFolder,
  IconGrid,
  IconImage,
  IconLayers,
  IconLock,
  IconMessage,
  IconSearch,
  IconSparkles,
  IconUnlock,
  IconUser,
} from './StudioIcons';
import './style.css';
import './project-workspace.css';
import './accessibility.css';
import './asset-browser.css';
import './studio-density.css';
import './studio-pro.css';
import {resolveDraft,readResume} from './draft-model.mjs';
import {EditSession,saveEdits,restoreEdits,loadLatestEdits,prepareConflictResolution,saveFailureMessage,isSceneLockedError,isRevisionConflict} from './edit-session.mjs';
import {browserCache,browserSessionCache} from './browser-cache.mjs';
import {draftStore} from './draft-store.mjs';
import {DraftRecoveryDialog} from './DraftRecoveryDialog';

sceneMeta.EMPTY={duration:1,shots:[{from:0,to:1,label:'Đoạn mới'}]};
const empty=():EditDocument=>({version:1,revision:0,layers:{}});
const copy=(v:any)=>structuredClone(v);

type LayerFilter = 'all' | 'characters' | 'backgrounds' | 'other';

function App(){
 const [builderOpen,setBuilderOpen]=useState(false);
 const builderFilmPlay=useRef(false);
 const {
  libraryOpen,setLibraryOpen,
  zoomShot,setZoomShot,
  storyboardOpen,setStoryboardOpen,
  createOpen,setCreateOpen,
  draftsOpen,setDraftsOpen,
  panel,setPanel,
  projectsOpen,setProjectsOpen,
  exportOpen,setExportOpen,
  backupOpen,setBackupOpen,
  sidebar,setSidebar,
  timelineMode,setTimelineMode,
  proMode,setProMode,
  showDialogueOverlay,setShowDialogueOverlay,
  showSafeArea,setShowSafeArea,
  shortcutsOpen,setShortcutsOpen,
  playbackRate,cyclePlaybackRate,
 }=useWorkspacePanels();
 const [playerAttempt,setPlayerAttempt]=useState(0),[previewMediaError,setPreviewMediaError]=useState(false);
 const retryPreview=()=>{setPreviewMediaError(false);setPlayerAttempt(n=>n+1);};
 const [layoutClipboard,setLayoutClipboard]=useState<any>(null);
 const addedFocus=useRef<string|null>(null);
 const [scene,setScene]=useState('S06'),[doc,setDoc]=useState<EditDocument>(empty),[ready,setReady]=useState(false),[auto,setAuto]=useState(false),[status,setStatus]=useState('Đang mở…'),[saving,setSaving]=useState(false),[revision,setRevision]=useState(0),[filter,setFilter]=useState(''),[layerTypeFilter,setLayerTypeFilter]=useState<LayerFilter>('all'),[refresh,setRefresh]=useState(0),[chosenKey,setChosenKey]=useState<{field:string;frame:number}|null>(null);
 const stage=useRef<HTMLDivElement>(null),inspectorRef=useRef<HTMLElement>(null),docRef=useRef(doc),savedRef=useRef(''),savedDocumentRef=useRef(''),history=useRef<EditDocument[]>([]),future=useRef<EditDocument[]>([]),gesture=useRef<any>(null),inputStart=useRef<EditDocument|null>(null);
 const {selected,setSelected,registry,register,unregister,visible,layers,bounds}=useSelection(stage);
 const [adding,setAdding]=useState(false);
 const [replacementTarget,setReplacementTarget]=useState<any>(null);
 const storyboardTarget=useRef<any>(null);
 useEffect(()=>{if(selected&&inspectorRef.current)inspectorRef.current.scrollTop=0;},[selected]);

 const [autoPasteNext,setAutoPasteNext]=useState(false);
 const [projectId,setProjectId]=useState(()=>browserCache.getItem('editor-project')||'nhat-thanh-ep01'),[project,setProject]=useState<any>(null),[projectBusy,setProjectBusy]=useState(false),[saveError,setSaveError]=useState(''),[conflictDraft,setConflictDraft]=useState<any>(null);
 const savingRef=useRef(false),resumeFrame=useRef(0),revisionRef=useRef(revision);revisionRef.current=revision;
 const session=useRef(new EditSession());session.current.select(projectId+':'+scene);
 const [saveBlocked,setSaveBlocked]=useState(false);
 const sceneReadOnly=saveBlocked||!!project?.lockedPrefix?.includes(scene);
 const [conflictNeeded,setConflictNeeded]=useState(false),[conflictServer,setConflictServer]=useState<EditDocument|null>(null);
 const [storageWarning,setStorageWarning]=useState('');
 useEffect(()=>{const notify=()=>setStorageWarning(browserCache.warning||browserSessionCache.warning);const local=browserCache.subscribe(notify),sessionNotice=browserSessionCache.subscribe(notify);return()=>{local();sessionNotice();};},[]);
 const draftKey=projectId+':'+scene;
 const [projectLoading,setProjectLoading]=useState(true),[projectError,setProjectError]=useState(''),[projectReload,setProjectReload]=useState(0);

 const totalFrames=timelineMode==='film'?(project?.duration||1):sceneMeta[scene].duration;
 const transport=useTransport({ready,totalFrames,scope:scene+timelineMode+playerAttempt,onSeek:()=>setChosenKey(null)});
 const {player,frame,setFrame,playing,setPlaying,seek}=transport;

 // Direct Destination Motion Mode state
 const [motionTargeting,setMotionTargeting]=useState(false);
 const [motionDuration,setMotionDuration]=useState(1.0);
 const motionOrigin=useRef<{x:number;y:number;frame:number}|null>(null);

 // Active Dialogue/Cue state
 const [activeCueId,setActiveCueId]=useState<string|null>(null);

 useEffect(()=>{const target=storyboardTarget.current;if(!ready||!target||target.scene!==scene)return;storyboardTarget.current=null;player.current?.seekTo(target.frame);setLibraryOpen(target.library);setReplacementTarget(target.layerId?{scene:target.scene,id:target.layerId}:null);setSidebar('objects');},[ready,scene,projectId]);
 useEffect(()=>{setReplacementTarget(null);},[scene,projectId,timelineMode]);
 useEffect(()=>{if(!libraryOpen)setReplacementTarget(null);},[libraryOpen]);
 useEffect(()=>setPreviewMediaError(false),[scene,timelineMode]);
 const installProject=(data:any)=>{installCompositionProject(data);setProject(data);};
 useEffect(()=>{let live=true;setReady(false);setProject(null);setProjectLoading(true);setProjectError('');setTimelineMode('scene');projectApi('/'+projectId).then(data=>{if(!live)return;installProject(data);browserCache.setItem('editor-project',projectId);const state=readResume(browserCache.getItem('editor-resume:'+projectId));setScene(data.sceneOrder.includes(state.scene)?state.scene:data.sceneOrder.at(-1)||'EMPTY');}).catch(e=>{if(live){setProjectError(e.status===404?'Dự án trước đó không còn sẵn sàng. Bạn có thể mở hoặc tạo dự án khác.':'Chưa kết nối được dự án. Kiểm tra editor đang chạy rồi thử lại.');setStatus('Chưa mở được dự án');}}).finally(()=>{if(live)setProjectLoading(false);});return()=>{live=false};},[projectId,projectReload]);
 const [locked,setLocked]=useState<Set<string>>(new Set());
 docRef.current=doc;
 const filmInputProps=useMemo(()=>({project}),[project]);
 const sceneInputProps=useMemo(()=>({scene,document:doc,register,unregister}),[scene,doc,register,unregister]);
 const commit=(next:EditDocument,before=docRef.current)=>{if(sceneReadOnly||session.current.busy||JSON.stringify(next)===JSON.stringify(before))return;history.current.push(copy(before));if(history.current.length>100)history.current.shift();future.current=[];setDoc(next);setRefresh(n=>n+1);};
 const dirty=ready&&JSON.stringify(doc.layers)!==savedRef.current;
 const savedDocumentMatches=JSON.stringify(doc)===JSON.stringify(project?.scenes.find((s:any)=>s.id===scene)?.document);
 const previewControl=usePreviewControl({projectId,player,sceneId:scene,documentRevision:revision,mode:timelineMode,savedDocumentMatches,canPreview:ready&&!dirty&&JSON.stringify(doc)===savedDocumentRef.current&&!saving&&!projectBusy&&!conflictDraft&&!previewMediaError&&!builderOpen&&!projectsOpen&&!exportOpen&&!backupOpen&&!createOpen&&!storyboardOpen&&!shortcutsOpen,selectScene:(id:string)=>{setTimelineMode('scene');setScene(id);},reload:()=>setProjectReload(n=>n+1),canInteract:()=>!gesture.current&&!inputStart.current&&!session.current.busy&&!savingRef.current,onError:setStatus});
 usePreviewPlayback({player,enabled:ready&&!dirty&&timelineMode==='scene'&&savedDocumentMatches,projectId,sceneId:scene,documentRevision:revision,scope:scene+timelineMode+playerAttempt,onError:setStatus,...previewControl});
 useEffect(()=>{let live=true;setReady(false);setStatus('Đang mở…');registry.current.clear();history.current=[];future.current=[];setSelected('');setChosenKey(null);setLocked(new Set());setFrame(0);setPlaying(false);
  setSaveBlocked(false);setSaveError('');setConflictDraft(null);setConflictNeeded(false);setConflictServer(null);setMotionTargeting(false);motionOrigin.current=null;setActiveCueId(null);if(!project||project.id!==projectId)return()=>{live=false};if(scene==='EMPTY'){setStatus('Dự án mới · thêm đoạn để bắt đầu');return()=>{live=false};}
  loadLatestEdits({session:session.current,projectId,scene,duration:sceneMeta[scene].duration}).then(({document:d,current})=>{if(live&&current){savedRef.current=JSON.stringify(d.layers);savedDocumentRef.current=JSON.stringify(d);const result=resolveDraft(d,draftStore.read(projectId,scene),sceneMeta[scene].duration,scene,!!project.lockedPrefix?.includes(scene));const restored=result.status==='restored';setConflictDraft(result.draft&&result.status==='conflict'?result.draft:null);setDoc(result.document);setRevision(d.revision);const state=readResume(browserCache.getItem('editor-resume:'+projectId));resumeFrame.current=state.scene===scene?Math.max(0,Math.min(sceneMeta[scene].duration-1,state.frame||0)):0;setReady(true);setStatus(project.lockedPrefix?.includes(scene)?'Scene đã duyệt · chỉ xem'+(result.draft?' · nháp được giữ riêng':''):restored?'Đã khôi phục chỉnh sửa chưa lưu':`Đã mở ${createdScenes[scene]?.title??scene} · bản ${d.revision}`);if(result.status==='conflict'){setSaveError('Có nháp từ phiên bản cũ. Chọn bản cần giữ; cả hai bản được bảo toàn trước khi thay thế.');setConflictNeeded(true);setConflictServer(d);}}}).catch(e=>{if(live)setStatus(saveFailureMessage(e,'read'));});return()=>{live=false};
 },[scene,projectId,projectReload,project?.id]);

 useEffect(()=>{const id=setInterval(()=>setRefresh(n=>n+1),120);return()=>clearInterval(id)},[]);
 useEffect(()=>{if(selected&&!registry.current.has(selected)){setSelected('');setChosenKey(null);setMotionTargeting(false);motionOrigin.current=null;}},[frame,refresh,selected]);
 useEffect(()=>{const handler=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler)},[dirty]);

 useEffect(()=>{if(ready&&timelineMode==='scene')player.current?.seekTo(resumeFrame.current);},[ready,scene,projectId,timelineMode]);
 useEffect(()=>{if(!project)return;const timer=setTimeout(()=>browserCache.setItem('editor-resume:'+projectId,JSON.stringify({scene,frame:timelineMode==='scene'?frame:0})),400);return()=>clearTimeout(timer);},[projectId,scene,frame,timelineMode,project]);
 const undo=()=>{if(sceneReadOnly||session.current.busy)return;const prev=history.current.pop();if(prev){future.current.push(copy(docRef.current));setDoc({...prev,revision});setChosenKey(null)}};
 const redo=()=>{if(sceneReadOnly||session.current.busy)return;const next=future.current.pop();if(next){history.current.push(copy(docRef.current));setDoc({...next,revision});setChosenKey(null)}};
 const save=async()=>{
  if(sceneReadOnly)return false;
  if(savingRef.current||!ready)return false;savingRef.current=true;setSaving(true);setStatus('Đang lưu vào dự án…');
  try{const result=await saveEdits({session:session.current,projectId,scene,duration:sceneMeta[scene].duration,document:docRef.current,revision:revisionRef.current,
   onSaved:(d:any,snapshot:EditDocument)=>{savedRef.current=JSON.stringify(snapshot.layers);savedDocumentRef.current=JSON.stringify(d);if(JSON.stringify(docRef.current.layers)===savedRef.current)draftStore.clear(projectId,scene);else draftStore.write(projectId,scene,{...docRef.current,revision:d.revision});revisionRef.current=d.revision;setRevision(d.revision);setDoc(current=>({...current,revision:d.revision}));setSaveBlocked(false);setSaveError('');setConflictNeeded(false);setConflictServer(null);setConflictDraft(null);setProject((p:any)=>p?.id===projectId?{...p,scenes:p.scenes.map((entry:any)=>entry.id===scene?{...entry,document:{...snapshot,revision:d.revision}}:entry)}:p);setStatus(`Đã lưu · bản ${d.revision}`);},
   onError:(error:any)=>{const message=saveFailureMessage(error);setSaveError(message);setStatus('Cần xử lý việc lưu');setSaveBlocked(isSceneLockedError(error));if(isSceneLockedError(error))setProject((p:any)=>p?.id===projectId?{...p,lockedPrefix:[...new Set([...(p.lockedPrefix??[]),scene])]}:p);if(isRevisionConflict(error)){setConflictNeeded(true);setConflictServer(null);setConflictDraft(null);}else{setConflictNeeded(false);setConflictServer(null);setConflictDraft(null);}},
  });return result.ok&&result.current&&JSON.stringify(docRef.current.layers)===savedRef.current;}finally{savingRef.current=false;setSaving(false);}
 };
 const reopenLockedScene=async()=>{
  if(savingRef.current||session.current.busy)return;
  await session.current.exclusive(async()=>{setProjectBusy(true);try{
   const latest=await loadLatestEdits({session:session.current,projectId,scene,duration:sceneMeta[scene].duration});if(!latest.current)return;
   const next=prepareConflictResolution({choice:'server',local:docRef.current,server:latest.document,archive:(snapshot:any)=>draftStore.archive(projectId,scene,snapshot)});
   savedRef.current=JSON.stringify(next.layers);savedDocumentRef.current=JSON.stringify(next);docRef.current=next;revisionRef.current=next.revision;setDoc(next);setRevision(next.revision);history.current=[];future.current=[];setChosenKey(null);
   draftStore.clear(projectId,scene);setSaveError('');setSaveBlocked(false);setConflictNeeded(false);setConflictServer(null);setConflictDraft(null);
   setProject((p:any)=>p?.id===projectId?{...p,scenes:p.scenes.map((entry:any)=>entry.id===scene?{...entry,document:next}:entry)}:p);
   setStatus('Đã mở lại bản đã khóa. Chỉnh sửa trước đó nằm trong Nháp đã giữ.');
  }catch(error:any){setSaveError(saveFailureMessage(error,'read'));}finally{setProjectBusy(false);}});
 };
 const previewConflict=async()=>{
  if(savingRef.current||session.current.busy)return;
  await session.current.exclusive(async()=>{setProjectBusy(true);try{const result=await loadLatestEdits({session:session.current,projectId,scene,duration:sceneMeta[scene].duration});if(result.current){setConflictServer(result.document);setConflictNeeded(true);}}catch(error:any){setSaveError(saveFailureMessage(error));}finally{setProjectBusy(false);}});
 };
 const previewArchivedDraft=async(document:EditDocument)=>{
  if(savingRef.current||session.current.busy)throw Error('Chờ thao tác lưu hiện tại hoàn tất.');
  await session.current.exclusive(async()=>{setProjectBusy(true);try{
   const latest=await loadLatestEdits({session:session.current,projectId,scene,duration:sceneMeta[scene].duration});if(!latest.current)return;
   setConflictDraft(copy(document));setConflictServer(latest.document);setConflictNeeded(true);setSaveError(`Đã mở nháp bản ${document.revision}. Chỉnh sửa hiện tại được giữ nguyên; chọn bản cần dùng để tiếp tục.`);
  }catch(error:any){throw Error(saveFailureMessage(error,'read'));}finally{setProjectBusy(false);}});
 };
 const resolveConflict=async(choice:'local'|'server')=>{
  if(!conflictServer||savingRef.current||session.current.busy)return;if(choice==='local'&&sceneReadOnly){setSaveError('Scene đã khóa; nháp được giữ riêng và không thể ghi vào bản gốc.');return;}
  await session.current.exclusive(async()=>{setProjectBusy(true);try{
   if(choice==='server'){const latest=await loadLatestEdits({session:session.current,projectId,scene,duration:sceneMeta[scene].duration});if(!latest.current)return;if(latest.document.revision!==conflictServer.revision){setConflictServer(latest.document);setSaveError('Bản trên máy chủ vừa thay đổi thêm. Đã đọc bản mới; hãy xem số phiên bản rồi chọn lại.');return;}}
   const next=prepareConflictResolution({choice,local:conflictDraft??docRef.current,server:conflictServer,archive:(snapshot:any)=>draftStore.archive(projectId,scene,snapshot)});
   if(conflictDraft&&JSON.stringify(docRef.current.layers)!==JSON.stringify(conflictServer.layers)&&JSON.stringify(docRef.current.layers)!==JSON.stringify(conflictDraft.layers)&&!draftStore.archive(projectId,scene,docRef.current))throw Error('Chưa sao lưu được chỉnh sửa mới trong phiên này.');
   history.current.push(copy(docRef.current));future.current=[];savedRef.current=JSON.stringify(conflictServer.layers);savedDocumentRef.current=JSON.stringify(conflictServer);revisionRef.current=conflictServer.revision;docRef.current=next;setDoc(next);setRevision(next.revision);
   setProject((p:any)=>p?.id===projectId?{...p,scenes:p.scenes.map((entry:any)=>entry.id===scene?{...entry,document:conflictServer}:entry)}:p);
   setConflictDraft(null);setConflictServer(null);setConflictNeeded(false);setSaveError('');
   if(choice==='local'){draftStore.write(projectId,scene,next);await save();}
   else{draftStore.clear(projectId,scene);setStatus(`Đã dùng bản trên máy chủ · bản ${next.revision}. Nháp trước đó đã được giữ.`);}
  }catch(error:any){setSaveError(saveFailureMessage(error));}finally{setProjectBusy(false);}});
 };
 useEffect(()=>{if(!ready||timelineMode!=='scene')return;if(dirty){try{draftStore.write(projectId,scene,doc);}catch{setStatus('Không lưu được nháp trên trình duyệt. Hãy bấm Lưu chỉnh sửa.');}}},[doc,ready,dirty,draftKey,timelineMode]);
 useEffect(()=>{if(!dirty||saving||projectBusy||saveError||timelineMode!=='scene')return;const timer=setTimeout(()=>{if(!gesture.current&&!inputStart.current)save();},1000);return()=>clearTimeout(timer);},[doc,dirty,saving,projectBusy,saveError,timelineMode]);
 const restoreVersion=async(restoreRevision:number)=>{
  if(sceneReadOnly)throw Error('Scene đã khóa; không thể thay bản đã duyệt bằng phiên bản lịch sử.');
  if(adding||savingRef.current||gesture.current||inputStart.current)throw Error('Chờ thao tác hiện tại hoàn tất.');
  return session.current.exclusive(async()=>{setProjectBusy(true);player.current?.pause();const currentView=session.current.capture();try{
   if(dirty&&!(await save()))throw Error('Chưa lưu được bản hiện tại.');
   const restored=await restoreEdits({session:session.current,projectId,scene,duration:sceneMeta[scene].duration,revision:revisionRef.current,restoreRevision});if(!restored.current)return;
   const next=restored.document;savedRef.current=JSON.stringify(next.layers);savedDocumentRef.current=JSON.stringify(next);docRef.current=next;revisionRef.current=next.revision;setDoc(next);setRevision(next.revision);history.current=[];future.current=[];draftStore.clear(projectId,scene);setSaveError('');
   setProject((p:any)=>p?.id===projectId?{...p,scenes:p.scenes.map((entry:any)=>entry.id===scene?{...entry,document:next}:entry)}:p);
   setStatus(`Đã khôi phục bản ${restoreRevision} · lưu thành bản ${next.revision}`);
   try{const restoredProject=await projectApi('/'+projectId);if(currentView())installProject(restoredProject);}catch{if(currentView())setStatus(`Đã khôi phục bản ${next.revision}. Chưa tải lại được thông tin dự án; thử kết nối lại.`);}
  }finally{setProjectBusy(false);}});
 };
 const openStoryboard=async()=>{const current=session.current.capture();if(dirty&&!(await save())||!current())return;player.current?.pause();setStoryboardOpen(true);};
 const openBuilder=async()=>{if(adding||projectBusy||session.current.busy)return;const current=session.current.capture();if(dirty&&!(await save())||!current())return;player.current?.pause();setBuilderOpen(true);};
 const builderNavigate=async(id?:string)=>{
  const updated=await projectApi('/'+projectId);installProject(updated);setBuilderOpen(false);setLibraryOpen(false);setStoryboardOpen(false);
  const destination=id??updated.sceneOrder[0];if(!destination)return;
  browserCache.setItem('editor-resume:'+projectId,JSON.stringify({scene:destination,frame:0}));
  session.current.select(projectId+':'+destination);setReady(false);setScene(destination);setSelected('');setSidebar(id?'objects':'scenes');
  builderFilmPlay.current=!id;setTimelineMode(id?'scene':'film');
  setProjectReload(n=>n+1);
 };
 useEffect(()=>{if(builderFilmPlay.current&&ready){builderFilmPlay.current=false;setTimelineMode('film');setTimeout(()=>{player.current?.seekTo(0);player.current?.play();},100);}},[ready]);
 const openScene=async(id:string)=>{if(adding||projectBusy||session.current.busy)return;const current=session.current.capture();if(dirty&&!(await save())||!current())return;session.current.select(projectId+':'+id);if(id!==scene)setReady(false);player.current?.pause();setSelected('');setChosenKey(null);setTimelineMode('scene');setScene(id);setSidebar('objects');};
 const openProject=async(id:string)=>{if(adding||projectBusy||session.current.busy)throw Error('Chờ thao tác hiện tại hoàn tất trước khi đổi dự án.');if(id===projectId){setProjectsOpen(false);return;}const current=session.current.capture();if(dirty&&!(await save()))throw Error('Chưa lưu được scene hiện tại.');session.current.select(id+':'+scene);setReady(false);setProjectsOpen(false);setProjectId(id);};
 const reorderScenes=async(order:string[])=>{if(session.current.busy||adding||savingRef.current||gesture.current||inputStart.current)return;return session.current.exclusive(async()=>{const currentView=session.current.capture();setProjectBusy(true);try{if(dirty&&!(await save()))return;player.current?.pause();const data=await projectApi('/'+projectId,{revision:project.revision,sceneOrder:order},'PATCH');if(!currentView())return;installProject(data);if(timelineMode==='film')player.current?.seekTo(0);setStatus('Đã lưu thứ tự scene');}catch(e:any){if(currentView())setStatus(e.message);}finally{setProjectBusy(false);}});};
 const changeTimeline=async(mode:string)=>{if(adding||projectBusy||session.current.busy)return;const currentView=session.current.capture();if(dirty&&!(await save())||!currentView())return;player.current?.pause();setSelected('');setChosenKey(null);setTimelineMode(mode);setFrame(0);if(mode==='film')setSidebar('scenes');};

 const info=registry.current.get(selected),layer=doc.layers[selected]??{},values={...valueAt(layer,frame),z:effectiveZ(info?.role??'object',layer,valueAt(layer,frame).z,info?.authoredZ??0)},isLocked=sceneReadOnly||locked.has(selected)||layoutLocked(doc.layers,selected);
 const orderLocked=!!info&&info.role!=='object'&&!layer.zOrderUnlocked;
 const fieldLocked=(field:string)=>isLocked||saving||projectBusy||(field==='z'&&orderLocked);
 const toggleOrderLock=()=>{const next=copy(docRef.current);const l=next.layers[selected]??={};if(orderLocked&&l.base?.z===undefined&&!l.keys?.z?.length){l.base??={};l.base.z=values.z;}l.zOrderUnlocked=orderLocked;commit(next);setChosenKey(null)};
 const modify=(changes:any,live=false)=>{
  if(sceneReadOnly||session.current.busy||!selected||isLocked||(changes.z!==undefined&&orderLocked))return;
  if(changes.z!==undefined&&info?.role==='object')changes={...changes,z:Math.max(1,Math.min(9999,changes.z))};
  const original=docRef.current,existing=copy(original.layers[selected]??{});
  if(auto&&info&&frame>info.start)for(const field of Object.keys(changes))if(!existing.keys?.[field]?.length){existing.keys??={};existing.keys[field]=[{frame:info.start,value:valueAt(existing,info.start)[field],easing:'linear'}]}
  const next={...original,layers:{...original.layers,[selected]:setValue(existing,frame,changes,auto)}};
  live?setDoc(next):commit(next);
 };
 const toggleKeys=(fields:string[],atFrame?:number)=>{
  const targetF=atFrame!==undefined?atFrame:frame;
  if(sceneReadOnly||session.current.busy||!selected||isLocked||(fields.includes('z')&&orderLocked))return;
  player.current?.pause();
  const next=copy(docRef.current);
  const l=next.layers[selected]??={};
  l.keys??={};
  const exists=fields.every(f=>l.keys[f]?.some((k:any)=>k.frame===targetF));
  if(!exists)setAuto(true);
  const currentValues=valueAt(l,targetF);
  const assetStart=l.asset?.from??0;
  for(const f of fields){
    const keys=l.keys[f]??[];
    if(exists){
      l.base??={};
      l.base[f]=currentValues[f];
      l.keys[f]=keys.filter((k:any)=>k.frame!==targetF);
    }else{
      let updatedKeys=keys.filter((k:any)=>k.frame!==targetF);
      if(!keys.length&&targetF>assetStart){
        const startValues=valueAt(l,assetStart);
        updatedKeys.push({frame:assetStart,value:startValues[f],easing:'linear'});
      }
      updatedKeys.push({frame:targetF,value:currentValues[f],easing:'linear'});
      l.keys[f]=updatedKeys.sort((a:any,b:any)=>a.frame-b.frame);
    }
  }
  commit(next);
  if(exists){
    setChosenKey(null);
    setStatus(`Đã xóa keyframe ${fields.includes('x')||fields.includes('y')?'vị trí':fields[0]==='scale'?'tỉ lệ':fields[0]==='rotation'?'xoay':fields[0]} tại frame ${targetF}`);
  }else{
    setChosenKey({field:fields.includes('x')||fields.includes('y')?'position':fields[0],frame:targetF});
    setStatus(`Đã thêm keyframe ${fields.includes('x')||fields.includes('y')?'vị trí':fields[0]==='scale'?'tỉ lệ':fields[0]==='rotation'?'xoay':fields[0]} tại frame ${targetF}`);
  }
 };
 const updateKey=(action:any)=>{if(sceneReadOnly||session.current.busy||!chosenKey||isLocked||(chosenKey.field==='z'&&orderLocked))return;try{const next=copy(docRef.current);next.layers[selected]=editTrackKey(next.layers[selected],chosenKey.field,chosenKey.frame,action);commit(next);if(action.remove)setChosenKey(null);else if(action.frame!==undefined){setChosenKey({...chosenKey,frame:action.frame});player.current?.seekTo(action.frame)}}catch(e:any){setStatus(e.message)}};
 const deleteKey=()=>updateKey({remove:true});
 const changeKey=(newFrame:number)=>{if(Number.isInteger(newFrame)&&newFrame>=(info?.start??0)&&newFrame<(info?.end??sceneMeta[scene].duration))updateKey({frame:newFrame})};

 const {startDrag,drag,endDrag,cancelDrag}=useDragDrop({session,saving,playing,selected,setSelected,setChosenKey,sceneReadOnly,locked,registry,player,stage,gesture,docRef,frame,auto,setDoc,commit,motionTargeting,motionOrigin,motionDuration,scene,setMotionTargeting,setStatus});

 const shot=sceneMeta[scene].shots.find(s=>frame>=s.from&&frame<s.to)??sceneMeta[scene].shots[0];
 const labels:Record<string,string>={position:'Vị trí X/Y',x:'X',y:'Y',z:'Z · lớp',scale:'Tỉ lệ',rotation:'Xoay',opacity:'Độ mờ',flipX:'Lật ngang',flipY:'Lật dọc'};

 const addAsset=async(selection:any,point?:{x?:number;y?:number;clientX?:number;clientY?:number})=>{
  if(sceneReadOnly){setStatus('Scene đã duyệt · chỉ xem. Chọn scene chưa khóa để thêm tài nguyên.');return;}if(timelineMode==='film'){setStatus('Mở scene để thêm tài nguyên vào đúng đoạn.');return;}if(sceneReadOnly||session.current.busy||saving||adding||!ready)return;if(point?.clientX!==undefined){const r=stage.current!.getBoundingClientRect();if(point.clientX<r.left||point.clientX>r.right||point.clientY!<r.top||point.clientY!>r.bottom){setStatus('Thả tài nguyên vào trong khung preview');return;}point={x:(point.clientX-r.left)/r.width*1920,y:(point.clientY!-r.top)/r.height*1080};}setAdding(true);player.current?.pause();setStatus('Đang thêm tài nguyên…');
  const currentScene=scene,at=frame,end=shot.to,current=session.current.capture();
  try{const parts=[];const boxes=selection.items.map((i:any)=>i.bbox);const minX=Math.min(...boxes.map((b:any)=>b[0])),minY=Math.min(...boxes.map((b:any)=>b[1])),maxX=Math.max(...boxes.map((b:any)=>b[2])),maxY=Math.max(...boxes.map((b:any)=>b[3]));const background=selection.type==='backgrounds';const factor=background?1920/(maxX-minX):Math.min(1,600/(maxY-minY));
   for(const item of selection.items){const r=await fetch('/api/library/prepare?id='+item.id,{method:'POST'});const prepared=await r.json();if(!r.ok)throw Error(prepared.error||'Không sao chép được tài nguyên');const {src}=prepared;const full=item.width===selection.canvas[0]&&item.height===selection.canvas[1];parts.push({src,left:((full?0:item.bbox[0])-minX)*factor,top:((full?0:item.bbox[1])-minY)*factor,width:item.width*factor,height:item.height*factor})}
   if(!current())return;
   const width=background?1920:(maxX-minX)*factor,height=background?1080:(maxY-minY)*factor;
   if(replacementTarget?.scene===currentScene){const id=replacementTarget.id;commit(replaceStoryboardAsset(docRef.current,id,{name:selection.name,type:selection.type,width,height,parts}));setReplacementTarget(null);setSelected(id);setSidebar('objects');setLibraryOpen(false);setStatus('Đã thay tài nguyên · giữ thời gian và keyframe');return;}
   const id=currentScene+'/shot-'+shot.from+'/user-'+crypto.randomUUID();const original=docRef.current;const next={...original,layers:{...original.layers,[id]:{asset:{name:selection.name,type:selection.type,from:at,to:end,left:background?0:(point?.x??960)-width/2,top:background?0:(point?.y??540)-height/2,width,height,parts},base:{z:background?0:100}}}};addedFocus.current=id;setFilter('');commit(next);setSelected(id);setSidebar('objects');setPanel('properties');setLibraryOpen(false);setStatus('Đã thêm · chỉnh thời gian trên timeline');
  }catch(e:any){if(current())setStatus(e.message)}finally{setAdding(false)}
 };

 const handleSelectPoseOrFace=async(character:any,poseItem:any,faceItem:any)=>{
  if(sceneReadOnly||!selected)return;
  const current=session.current.capture();
  try{
   const actor=docRef.current.layers[selected];
   if(actor?.layoutLocked&&Object.values(docRef.current.layers).some((child:any)=>child.parentId===selected&&child.socketBinding&&!actor.sockets?.[child.socketBinding.name]?.[poseItem.id]))throw Error('Pose này chưa định vị điểm cầm. Mở khóa thiết kế và định vị pose trước khi diễn.');
   setStatus('Đang đổi hình ảnh nhân vật…');
   const selection={
    name:character.name+' · '+poseItem.name+(faceItem?' · '+faceItem.name:''),
    type:'characters',
    canvas:character.canvas,
    items:[poseItem,...(faceItem?[faceItem]:[])]
   };
   const boxes=selection.items.map((i:any)=>i.bbox);
   const minX=Math.min(...boxes.map((b:any)=>b[0])),minY=Math.min(...boxes.map((b:any)=>b[1])),maxX=Math.max(...boxes.map((b:any)=>b[2])),maxY=Math.max(...boxes.map((b:any)=>b[3]));
   const factor=Math.min(1,600/(maxY-minY));
   const parts:any[]=[];
   for(const item of selection.items){
    const r=await fetch('/api/library/prepare?id='+item.id,{method:'POST'});
    const prepared=await r.json();if(!current())return;
    if(!r.ok)throw Error(prepared.error||'Không sao chép được tài nguyên');
    const full=item.width===selection.canvas[0]&&item.height===selection.canvas[1];
    parts.push({
     src:prepared.src,
     left:((full?0:item.bbox[0])-minX)*factor,
     top:((full?0:item.bbox[1])-minY)*factor,
     width:item.width*factor,
     height:item.height*factor
    });
   }
   const width=(maxX-minX)*factor,height=(maxY-minY)*factor;
   if(!current())return;
   const existingLayer=docRef.current.layers[selected];
   if(existingLayer?.asset){
    commit(replaceStoryboardAsset(docRef.current,selected,{
     name:selection.name,
     poseKey:poseItem.id,
     type:selection.type,
     width,
     height,
     parts
    }));
   } else {
    const next=copy(docRef.current);
    next.layers[selected]={
     ...existingLayer,
     asset:{
      name:selection.name,
      type:'characters',
      from:shot.from,
      to:shot.to,
      left:values.x-width/2,
      top:values.y-height/2,
      width,
      height,
      parts
     }
    };
    commit(next);
   }
   setStatus(`Đã đổi nhân vật: ${selection.name}`);
  }catch(e:any){
   if(current())setStatus(e.message||'Không đổi được nhân vật');
  }
 };

 const startMotionTargeting=(durationSec:number)=>{
  if(sceneReadOnly||!selected)return;
  setMotionDuration(durationSec);
  setMotionTargeting(true);
  motionOrigin.current={x:values.x,y:values.y,frame};
  setStatus(`Kéo đối tượng trên màn hình tới vị trí đích (+${durationSec}s).`);
 };
 const cancelMotionTargeting=()=>{
  if(motionOrigin.current){
   modify({x:motionOrigin.current.x,y:motionOrigin.current.y},false);
   motionOrigin.current=null;
  }
  setMotionTargeting(false);
  setStatus('Đã hủy chế độ kéo đích.');
 };

 const storyCues=useMemo<StoryCue[]>(()=>{
  const created=createdScenes[scene];
  if(created?.cues?.length){
   return created.cues.map((c:any,index:number)=>({
    id:c.cueId||`cue-${index}`,
    index:index+1,
    from:c.from,
    to:c.to,
    text:c.text,
    durationSec:c.durationSec||(c.to-c.from)/30
   }));
  }
  const sceneData=project?.scenes?.find((s:any)=>s.id===scene);
  if(sceneData?.cues?.length){
   return sceneData.cues.map((c:any,index:number)=>({
    id:c.cueId||`cue-${index}`,
    index:index+1,
    from:c.from,
    to:c.to,
    text:c.text,
    durationSec:c.durationSec||(c.to-c.from)/30
   }));
  }
  if(sceneData?.scriptPlan?.tasks?.length){
   return sceneData.scriptPlan.tasks.map((t:any,index:number)=>({
    id:t.id||`task-${index}`,
    index:index+1,
    from:t.from,
    to:t.to,
    text:t.source?.quote||t.action||`Đoạn ${index+1}`,
    durationSec:(t.to-t.from)/30
   }));
  }
  return (sceneMeta[scene]?.shots||[]).map((s:any,index:number)=>({
   id:`shot-${s.from}`,
   index:index+1,
   from:s.from,
   to:s.to,
   text:s.label||`Phân đoạn ${index+1}`,
   durationSec:(s.to-s.from)/30
  }));
 },[scene,project,refresh]);

 const snapPoints=useMemo(()=>{
  const set=new Set<number>();
  set.add(frame);
  for(const c of storyCues){set.add(c.from);set.add(c.to);}
  return Array.from(set);
 },[storyCues,frame]);

 const {timeFrom,timeTo,dragRange}=useTimeline({sceneReadOnly,session,scene,docRef,setDoc,commit,zoomShot,shot,saving,player,snapPoints});

 const handleSelectCue=(cue:StoryCue)=>{
  player.current?.pause();
  seek(cue.from);
  setActiveCueId(cue.id);
  setStatus(`Câu thoại #${cue.index}: "${cue.text.slice(0,45)}…"`);
 };

 const goPrevCue=()=>{
  if(!storyCues.length)return;
  const prev=[...storyCues].reverse().find(c=>c.from<frame-2);
  if(prev)handleSelectCue(prev);
  else seek(0);
 };
 const goNextCue=()=>{
  if(!storyCues.length)return;
  const next=storyCues.find(c=>c.from>frame+2);
  if(next)handleSelectCue(next);
 };

 const activePlayingCue=storyCues.find(c=>frame>=c.from&&frame<c.to);
 const currentCueObj=activePlayingCue??storyCues.find(c=>c.id===activeCueId)??null;
 const currentCueText=currentCueObj?.text||'';

 const splitAtPlayhead=()=>{
  if(sceneReadOnly||!selected||!layer?.asset)return;
  if(layoutLocked(doc.layers,selected)){setStatus('Không thể cắt đối tượng khi đang bị khóa thiết kế.');return;}
  if(frame<=layer.asset.from||frame>=layer.asset.to){setStatus(`Đưa Playhead vào giữa đoạn (${layer.asset.from} - ${layer.asset.to}) để cắt.`);return;}
  try{
   const result=splitLayerAtFrame(docRef.current,selected,frame,totalFrames);
   commit(result.document);
   setSelected(result.newLayerId);
   setStatus(`Đã cắt clip tại frame ${frame}`);
  }catch(e:any){
   setStatus(`Lỗi khi cắt clip: ${e.message}`);
  }
 };

 const handleAttachParent=(parentId:string)=>{
  if(sceneReadOnly||!selected)return;
  try{
   const next=attachLayer(docRef.current,selected,parentId,frame);
   commit(next);
   setStatus(`Đã gắn vào "${docRef.current.layers[parentId]?.asset?.name||parentId}".`);
  }catch(e:any){
   setStatus(`Chưa gắn được cha: ${e.message}`);
  }
 };

 const handleDetachParent=()=>{
  if(sceneReadOnly||!selected)return;
  try{
   const next=detachLayer(docRef.current,selected);
   commit(next);
   setStatus('Đã tách khỏi cha.');
  }catch(e:any){
   setStatus(`Chưa tách được cha: ${e.message}`);
  }
 };

 const handleToggleLayoutLock=(lockChildren:boolean)=>{
  if(sceneReadOnly||!selected)return;
  const next=structuredClone(docRef.current);
  next.layers[selected].layoutLocked=lockChildren;
  commit(next);
  setStatus(lockChildren?'Đã khóa vị trí các đối tượng con.':'Đã mở khóa vị trí các đối tượng con.');
 };

 const duplicateLayer=()=>{
  if(sceneReadOnly||!selected||!layer.asset)return;
  if(layoutLocked(doc.layers,selected))return;
  const result=duplicateAssembly(docRef.current,selected,scene,()=>crypto.randomUUID());commit(result.document);setSelected(result.id);
  setStatus('Đã nhân bản đối tượng.');
 };
 const deleteLayer=()=>{
  if(sceneReadOnly||!selected)return;
  if(layoutLocked(doc.layers,selected))return;
  commit(deleteAssembly(docRef.current,selected));
  setSelected('');
  setStatus('Đã xóa đối tượng.');
 };
 const flipLayer=(field:'flipX'|'flipY')=>{modify({[field]:!values[field]});};
 const stepLayerZ=(delta:number)=>{modify({z:Math.max(1,Math.min(9999,(values.z||100)+delta*10))});};

 const currentFraming=selected&&layer?.asset?detectFramingPreset(layer,frame):null;
 const visibleNonBgLayers=Object.entries(doc.layers??{}).filter(([,l]:any)=>l?.asset&&l.asset.type!=='backgrounds'&&frame>=l.asset.from&&frame<l.asset.to);
 const hasAnyDimmed=visibleNonBgLayers.some(([,l]:any)=>l.dimmed===true);
 const isFocused=Boolean(selected&&hasAnyDimmed&&layer?.dimmed===false);
 const handleApplyFraming=(preset:'full'|'bust'|'portrait')=>{
  if(sceneReadOnly||!selected)return;
  try{
   commit(applyFramingPreset(docRef.current,selected,preset,frame));
   const label=preset==='portrait'?'Chân dung':preset==='bust'?'Nửa thân':'Toàn thân';
   setStatus(`Đã đổi cỡ khung: ${label}`);
  }catch(e:any){
   setStatus(e.message||'Không đổi được cỡ khung');
  }
 };
 const handleFocusLayer=()=>{
  if(sceneReadOnly||!selected)return;
  try{
   commit(applyFocusToLayer(docRef.current,selected,frame));
   setStatus('Đã bật Focus · làm mờ các đối tượng khác');
  }catch(e:any){
   setStatus(e.message||'Không bật được Focus');
  }
 };
 const handleClearFocus=()=>{
  if(sceneReadOnly)return;
  commit(clearFocusAtFrame(docRef.current,frame));
  setStatus('Đã tắt Focus · hiện rõ tất cả');
 };
 const resetSelectedLayer=()=>{
  if(isLocked||saving||!selected)return;
  const next=copy(docRef.current);
  if(layer.asset)next.layers[selected]={...copy(layer),base:{},keys:{}};
  else delete next.layers[selected];
  commit(next);
  setChosenKey(null);
  setStatus('Đã khôi phục đối tượng về bản gốc.');
 };

 // Global keyboard shortcuts (including Director hotkeys)
 useEffect(()=>{
  const handle=(e:KeyboardEvent)=>{
   if(builderOpen||session.current.busy||createOpen||projectsOpen||exportOpen||backupOpen||draftsOpen||storyboardOpen||shortcutsOpen)return;
   const targetEl=e.target instanceof HTMLElement?e.target:null;
   const input=targetEl&&(['INPUT','SELECT','TEXTAREA'].includes(targetEl.tagName)||targetEl.isContentEditable);
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save();return;}
   if(input)return;
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
   else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
   else if(e.ctrlKey||e.metaKey||e.altKey){return;}
   else if(e.code==='Space'){if(targetEl&&targetEl.closest('button,a,summary,video'))return;e.preventDefault();player.current?.toggle();}
   else if(e.key==='ArrowLeft'){e.preventDefault();seek(frame-1);}
   else if(e.key==='ArrowRight'){e.preventDefault();seek(frame+1);}
   else if(e.key==='Home'){e.preventDefault();seek(0);}
   else if(e.key==='End'){e.preventDefault();seek(totalFrames-1);}
   else if(e.key==='['){e.preventDefault();goPrevCue();}
   else if(e.key===']'){e.preventDefault();goNextCue();}
   else if(e.key==='?'){e.preventDefault();setShortcutsOpen(o=>!o);}
   else if((e.key==='1'||e.key==='2'||e.key==='3')&&selected&&timelineMode==='scene'&&!isLocked&&layer?.asset?.type==='characters'){
    e.preventDefault();
    handleApplyFraming(e.key==='1'?'full':e.key==='2'?'bust':'portrait');
   }
   else if((e.key==='f'||e.key==='F')&&selected&&timelineMode==='scene'&&!isLocked&&layer?.asset?.type&&layer.asset.type!=='backgrounds'){
    e.preventDefault();
    if(isFocused)handleClearFocus();else handleFocusLayer();
   }
   else if((e.key==='h'||e.key==='H')&&selected&&timelineMode==='scene'&&!isLocked){
    e.preventDefault();
    flipLayer('flipX');
   }
   else if(e.key==='Delete'||e.key==='Backspace'){
    if(chosenKey&&!isLocked&&!sceneReadOnly){e.preventDefault();deleteKey();}
    else if(selected&&!isLocked&&!sceneReadOnly&&!layoutLocked(doc.layers,selected)){e.preventDefault();deleteLayer();}
   }
   else if(e.key==='Escape'){
    setSelected('');
    setChosenKey(null);
    if(motionTargeting)cancelMotionTargeting();
   }
  };
  window.addEventListener('keydown',handle);
  return()=>window.removeEventListener('keydown',handle);
 });

 // Scene Continuity
 const continueToNewScene=()=>{
  const entries=captureLayout(docRef.current,frame);
  setLayoutClipboard(entries);
  setAutoPasteNext(true);
  setCreateOpen(true);
 };
 const currentIndex=project?.sceneOrder?.indexOf(scene)??-1;
 const nextSceneId=currentIndex>=0&&currentIndex<(project?.sceneOrder?.length-1)?project.sceneOrder[currentIndex+1]:null;
 const nextSceneObj=nextSceneId?project?.scenes.find((s:any)=>s.id===nextSceneId):null;

 const layerStats=useMemo(()=>{
  let characters=0,backgrounds=0,props=0;
  for(const l of layers){
   const t=doc.layers[l.id]?.asset?.type;
   if(t==='characters')characters++;
   else if(t==='backgrounds')backgrounds++;
   else props++;
  }
  return {total:layers.length,characters,backgrounds,props};
 },[layers,doc.layers]);

 const filteredLayers=useMemo(()=>{
  const q=filter.trim().toLowerCase();
  return layers.filter(l=>{
   const t=doc.layers[l.id]?.asset?.type;
   if(layerTypeFilter==='characters'&&t!=='characters')return false;
   if(layerTypeFilter==='backgrounds'&&t!=='backgrounds')return false;
   if(layerTypeFilter==='other'&&(t==='characters'||t==='backgrounds'))return false;
   if(q&&!l.label.toLowerCase().includes(q))return false;
   return true;
  });
 },[layers,doc.layers,layerTypeFilter,filter]);

 const numberControl=(field:string,step=1)=><label className="number" key={field}><span>{labels[field]}</span><input aria-label={labels[field]} type="number" step={step} value={Math.round(values[field]*1000)/1000} disabled={fieldLocked(field)} onFocus={()=>{player.current?.pause();inputStart.current=copy(docRef.current)}} onChange={e=>{if(e.target.value!==''&&Number.isFinite(Number(e.target.value))){let value=Number(e.target.value);if(field==='scale')value=Math.max(.01,Math.min(100,value));if(field==='opacity')value=Math.max(0,Math.min(1,value));if(field==='z')value=Math.round(value);modify({[field]:value},true)}}} onBlur={()=>{if(inputStart.current){commit(docRef.current,inputStart.current);inputStart.current=null}}}/>{!['x','y'].includes(field)&&<button disabled={fieldLocked(field)} title={`Thêm/xóa keyframe ${labels[field]}`} aria-label={`Thêm/xóa keyframe ${labels[field]}`} aria-pressed={!!layer.keys?.[field]?.some((k:any)=>k.frame===frame)} className={layer.keys?.[field]?.some((k:any)=>k.frame===frame)?'diamond active':'diamond'} onClick={()=>toggleKeys([field])}>◇</button>}</label>;

 const transformControlsBlock=(
  <div className="inspector-transform-fields">
   <button className="position-key" disabled={isLocked||saving} onClick={()=>toggleKeys(['x','y'])}>◇ Keyframe vị trí · frame {frame}</button>
   <div className="xy-controls">{numberControl('x')}{numberControl('y')}</div>
   {info?.role!=='object'&&<div className="order-lock"><strong>{info?.role==='background'?'Background · dưới cùng':'Phụ đề · trên cùng'}</strong><button disabled={isLocked||saving} onClick={toggleOrderLock}>{orderLocked?'Mở khóa Z':'Khóa lại Z'}</button><small>{orderLocked?'Z đang được bảo vệ.':'Đã mở khóa: tự chỉnh thứ tự lớp.'}</small></div>}
   {numberControl('z')}
   {numberControl('scale',.01)}
   {numberControl('rotation')}
   {numberControl('opacity',.05)}
  </div>
 );

 const advancedDrawerNode=selected?(
  <details className="studio-advanced-drawer">
   <summary className="advanced-drawer-summary">
    <span>Socket · Parallax · Mẫu lắp ghép</span>
   </summary>
   <div className="advanced-drawer-body">
    <AssemblyLibraryPanel document={doc} id={selected} scene={scene} frame={frame} end={shot.to} disabled={sceneReadOnly||saving||!ready||timelineMode!=='scene'} onChange={commit}/>
    <AssemblyPanel key={'assembly-'+scene+selected} document={doc} id={selected} frame={frame} disabled={sceneReadOnly||saving||!ready} onChange={commit}/>
    <SocketEditor key={'sockets-'+scene+selected} document={doc} id={selected} frame={frame} disabled={sceneReadOnly||saving||!ready||timelineMode!=='scene'} onChange={commit}/>
    <ParallaxPanel key={'parallax-'+scene+selected} document={doc} id={selected} disabled={sceneReadOnly||saving||!ready||timelineMode!=='scene'} onChange={commit}/>
   </div>
  </details>
 ):null;

 return <TransportContext.Provider value={transport}><main className={'studio-shell mode-'+timelineMode+(proMode?' is-pro':' is-director')}>
  <StudioHeader
    project={project}
    currentScene={timelineMode==='film'?project?.scenes.find((s:any)=>frame>=s.from&&frame<s.to)?.id??scene:scene}
    scenes={project?.scenes || []}
    onSelectScene={openScene}
    onOpenProjects={()=>setProjectsOpen(true)}
    onBuildEpisode={openBuilder}
    onAddScene={()=>{player.current?.pause();setLibraryOpen(false);setCreateOpen(true)}}
    timelineMode={timelineMode as 'scene' | 'film'}
    onChangeTimelineMode={(mode)=>changeTimeline(mode)}
    storyboardOpen={storyboardOpen}
    onOpenStoryboard={openStoryboard}
    libraryOpen={libraryOpen}
    onToggleLibrary={()=>{if(timelineMode==='film')changeTimeline('scene');setSidebar('objects');setLibraryOpen(!libraryOpen)}}
    undo={undo}
    redo={redo}
    canUndo={!sceneReadOnly && !!history.current.length && !saving}
    canRedo={!sceneReadOnly && !!future.current.length && !saving}
    saving={saving}
    dirty={dirty}
    onSave={save}
    onExport={()=>{player.current?.pause();setExportOpen(true)}}
    proMode={proMode}
    onToggleProMode={()=>setProMode(v=>!v)}
    onOpenHistory={()=>{setLibraryOpen(false);setSidebar('history');}}
    onOpenBackup={()=>{player.current?.pause();setBackupOpen(true);}}
    onOpenShortcuts={()=>setShortcutsOpen(true)}
    disabled={sceneReadOnly||projectBusy}
    exportDisabled={saveBlocked||projectBusy}
    statusText={status}
   />

  <Storyboard open={storyboardOpen} projectId={projectId} initialScene={scene} initialFrame={frame} onClose={(changed:boolean)=>{setStoryboardOpen(false);if(changed){setReady(false);setProjectReload(n=>n+1);}}} onEdit={(id:string,frame:number,library:boolean,layerId?:string)=>{storyboardTarget.current={scene:id,frame,library,layerId};browserCache.setItem('editor-resume:'+projectId,JSON.stringify({scene:id,frame}));setStoryboardOpen(false);setTimelineMode('scene');setReady(false);setScene(id);setProjectReload(n=>n+1);}}/>
  <ExportDialog key={'export-'+projectId} open={exportOpen} onClose={()=>setExportOpen(false)} project={project} onBeforeExport={async()=>{if(dirty&&!(await save()))throw Error('Chưa lưu được chỉnh sửa. Hãy lưu trước khi xuất.');}}/>
  <BackupDialog open={backupOpen} onClose={()=>setBackupOpen(false)} onBeforeBackup={async()=>{if(session.current.busy||adding||savingRef.current)throw Error('Chờ thao tác chỉnh sửa hiện tại hoàn tất.');if(dirty&&!(await save()))throw Error('Chưa lưu được chỉnh sửa hiện tại.');}}/>
  <ProjectsDialog open={projectsOpen} current={projectId} onClose={()=>setProjectsOpen(false)} onOpen={openProject} onCreated={()=>setBuilderOpen(true)} onBackup={()=>{setProjectsOpen(false);setBackupOpen(true)}}/>
  <EpisodeBuilder key={'builder-'+projectId} open={builderOpen} projectId={projectId} onClose={async()=>{setBuilderOpen(false);try{const updated=await projectApi('/'+projectId);installProject(updated);if(!updated.sceneOrder.includes(scene))setScene(updated.sceneOrder.at(-1)||'EMPTY');}catch(e:any){setStatus(e.message);}}} onEdit={(id:string)=>builderNavigate(id)} onFilm={()=>builderNavigate()} onChanged={()=>{}}/>
  <ShortcutsDialog open={shortcutsOpen} onClose={()=>setShortcutsOpen(false)} />
  <CreateSceneDialog key={projectId} projectId={projectId} open={createOpen} onClose={()=>setCreateOpen(false)} scenes={project?.scenes||[]} currentSceneId={timelineMode==='film'?project?.scenes?.find((s:any)=>frame>=s.from&&frame<s.to)?.id:scene} onCreated={async(source:any)=>{
   if(adding||savingRef.current)throw Error('Đoạn đã được tạo. Chờ thao tác lưu hiện tại rồi thử mở lại.');
   const current=session.current.capture();
   return session.current.exclusive(async()=>{
    setProjectBusy(true);
    try{
     if(dirty&&!(await save()))throw Error('Đoạn mới đã được tạo. Chưa lưu được chỉnh sửa hiện tại; hãy thử lại để mở đoạn mới.');
     const updated=await projectApi('/'+projectId);
     if(!current())return;
     if(!updated.scenes.some((entry:any)=>entry.id===source.id))throw Error('Chưa tìm thấy đoạn mới trong dự án. Thử mở lại.');
     installProject(updated);
     session.current.select(projectId+':'+source.id);
     setReady(false);
     setTimelineMode('scene');
     setScene(source.id);
     setLibraryOpen(false);
     if(autoPasteNext&&layoutClipboard?.length){
      setAutoPasteNext(false);
      setTimeout(()=>{
       const baseDoc=copy(docRef.current);
       const shot0=sceneMeta[source.id]?.shots?.[0];
       const toFrame=shot0?.to||90;
       commit(pasteLayout(baseDoc,layoutClipboard,source.id,0,toFrame,()=>crypto.randomUUID()));
       setStatus('Đã tạo đoạn mới và tiếp nối nhân vật từ đoạn trước!');
      },300);
     }
    }finally{setProjectBusy(false);}
   });
  }}/>

  {sceneReadOnly&&timelineMode==='scene'&&<p role="status" className="storage-warning">Scene đã duyệt · chỉ xem. Nháp chỉnh sửa được giữ riêng.</p>}
  <DraftRecoveryDialog open={draftsOpen} projectId={projectId} scene={scene} duration={sceneMeta[scene].duration} onClose={()=>setDraftsOpen(false)} onSelect={previewArchivedDraft}/>
  {storageWarning&&<p role="alert" className="storage-warning">{storageWarning}</p>}
  {saveError&&<div className="draft-conflict" role="alert"><strong>{saveBlocked?'Scene đã được khóa':conflictNeeded?'Chọn bản chỉnh sửa cần giữ':'Chưa lưu được chỉnh sửa'}</strong><p>{saveError}</p>{saveBlocked?<div><button disabled={saving||projectBusy} onClick={reopenLockedScene}>Giữ nháp và mở lại bản đã khóa</button><button disabled={saving||projectBusy} onClick={()=>setDraftsOpen(true)}>Xem nháp đã giữ</button></div>:conflictNeeded?conflictServer?<><p>Bản đang sửa: {revision} · Bản trên máy chủ: {conflictServer.revision}. Giữ bản của bạn sẽ thay toàn bộ chỉnh sửa hình ảnh của scene ở bản này.</p><div><button disabled={saving||projectBusy} onClick={()=>resolveConflict('local')}>{conflictDraft?'Dùng nháp trên máy này':'Giữ chỉnh sửa của tôi'}</button><button disabled={saving||projectBusy} onClick={()=>resolveConflict('server')}>Dùng bản trên máy chủ</button><button disabled={saving||projectBusy} onClick={previewConflict}>Đọc lại bản mới</button></div></>:<button disabled={saving||projectBusy} onClick={previewConflict}>Xem bản mới trên máy chủ</button>:<button disabled={saving||projectBusy} onClick={()=>save()}>Thử lưu lại</button>}</div>}

  <div className={'workspace'+(libraryOpen?' has-library':'')} inert={projectBusy}>
   {!project?<div className="empty-project" role={projectLoading?'status':undefined}><h2>{projectLoading?'Đang mở dự án…':'Chọn dự án để bắt đầu'}</h2><p>{projectLoading?'Đang đọc bản dựng đã lưu.':projectError}</p>{!projectLoading&&<div><button className="primary" onClick={()=>setProjectsOpen(true)}>Mở hoặc tạo dự án</button><button onClick={()=>setProjectReload(n=>n+1)}>Thử kết nối lại</button></div>}</div>:project.scenes.length===0?<div className="empty-project"><h2>Bắt đầu câu chuyện của bạn</h2><p>Nhập kịch bản, chia cảnh, chọn nhân vật và bối cảnh rồi dựng từng cảnh theo ý bạn.</p><button className="primary" onClick={openBuilder}>Bắt đầu xây dựng tập phim</button><button onClick={()=>setCreateOpen(true)}>＋ Tạo đoạn đầu tiên</button></div>:<>
    {/* LEFT SIDEBAR: 3 CLEAN SEGMENTED TABS */}
    <aside className={'layers'+(libraryOpen?' asset-panel':'')}>
     <nav className="sidebar-tabs" aria-label="Bảng điều hướng trái">
      <button className={sidebar==='objects'&&!libraryOpen?'active':''} onClick={()=>{setLibraryOpen(false);setSidebar('objects')}}>
       <IconLayers size={13} />
       <span>Lớp</span>
      </button>
      <button className={libraryOpen?'active':''} onClick={()=>{if(timelineMode==='film')changeTimeline('scene');setLibraryOpen(true)}}>
       <IconFolder size={13} />
       <span>Kho PSD</span>
      </button>
      <button className={sidebar==='scenes'&&!libraryOpen?'active':''} onClick={()=>{setLibraryOpen(false);setSidebar('scenes')}}>
       <IconClapper size={13} />
       <span>Cảnh</span>
      </button>
     </nav>

     {replacementTarget&&libraryOpen&&<p className="storage-warning" role="status">Đang thay: {doc.layers[replacementTarget.id]?.asset?.name}<button onClick={()=>setReplacementTarget(null)}>Hủy thay · chuyển sang thêm mới</button></p>}

     {libraryOpen?<AssetLibrary proMode={proMode} onAdd={addAsset} context={{scene,sceneLabel:createdScenes[scene]?.title??scene,frame,shot:shot.label,selected:info?.label,objects:layers.map(l=>l.label)}}/>
      :sidebar==='history'?(
       <div className="history-sidebar-wrap">
        <div className="history-sidebar-head">
         <strong>Lịch sử phiên bản</strong>
         <button type="button" className="history-back-btn" onClick={()=>setSidebar('objects')}>
          <IconChevronLeft size={13} />
          <span>Quay lại</span>
         </button>
        </div>
        <EditHistory projectId={projectId} scene={scene} revision={revision} onRestore={restoreVersion}/>
       </div>
      )
      :sidebar==='scenes'&&project?<SceneList project={project} current={timelineMode==='film'?project.scenes.find((s:any)=>frame>=s.from&&frame<s.to)?.id:scene} onOpen={openScene} onReorder={reorderScenes} onAdd={()=>setCreateOpen(true)} disabled={saving||adding||projectBusy}/>
      :<>
       <div className="layers-header-row">
        <h3>Đối tượng <small>{layers.length}</small></h3>
       </div>
       <div className="layers-search-wrap">
        <IconSearch size={13} className="search-icon" />
        <input aria-label="Tìm đối tượng" placeholder="Tìm lớp trong cảnh…" value={filter} onChange={e=>setFilter(e.target.value)}/>
       </div>
       <div className="layer-filter-pills" role="group" aria-label="Lọc loại lớp">
        {([
         ['all','Tất cả'],
         ['characters','Nhân vật'],
         ['backgrounds','Nền'],
         ['other','Khác'],
        ] as const).map(([key,label])=>(
         <button
          key={key}
          type="button"
          className={layerTypeFilter===key?'active':''}
          onClick={()=>setLayerTypeFilter(key)}
         >
          {label}
         </button>
        ))}
       </div>
       <div className="layer-list">{filteredLayers.map(l=>{
        const targetLayer=doc.layers[l.id];
        const assetType=targetLayer?.asset?.type;
        const isChar=assetType==='characters';
        const isBg=assetType==='backgrounds';
        const isText=l.id.includes('caption')||/caption|sub|thoại/i.test(l.label);
        const iconEl=isChar?<IconUser size={13}/>:isBg?<IconImage size={13}/>:isText?<IconMessage size={13}/>:<IconSparkles size={13}/>;
        const parentName=targetLayer?.parentId?(doc.layers[targetLayer.parentId]?.asset?.name||'Cha'):null;
        let childrenCount=0;
        try{childrenCount=subtree(doc.layers,l.id).length-1;}catch{}
        const isLiveNow=targetLayer?.asset?(frame>=targetLayer.asset.from&&frame<targetLayer.asset.to):true;
        return (
         <div className={'layer-row '+(l.id===selected?'selected':'')+(targetLayer?.parentId?' is-child-layer':'')+(isLiveNow?'':' is-offstage')} key={l.id}>
          <button className="layer-name" ref={button=>{if(button&&addedFocus.current===l.id&&selected===l.id){addedFocus.current=null;button.focus();}}} title={l.label} onClick={()=>{player.current?.pause();setSelected(l.id);setChosenKey(null)}}>
           <span className={'layer-live-dot '+(isLiveNow?'live':'idle')} title={isLiveNow?'Đang hiển thị ở frame này':'Chưa/đã qua đoạn hiển thị'}/>
           <span className="layer-type-icon">{iconEl}</span>
           <span className="layer-title-text">{targetLayer?.parentId?'↳ ':''}{l.label}</span>
           {parentName?(
            <small className="layer-meta-badge child" title={`Thuộc ${parentName}`}>↳ {parentName}</small>
           ):childrenCount>0?(
            <small className="layer-meta-badge parent">{childrenCount} con</small>
           ):(
            <small className="layer-meta-badge time">{((targetLayer?.asset?.from||0)/30).toFixed(1)}s</small>
           )}
          </button>
          <button className={'layer-lock-btn '+(locked.has(l.id)?'locked':'')} aria-label={`Khóa ${l.label}`} title="Khóa / Mở khóa thao tác trên khung xem" onClick={()=>setLocked(current=>{const n=new Set(current);n.has(l.id)?n.delete(l.id):n.add(l.id);return n})}>
           {locked.has(l.id)?<IconLock size={12}/>:<IconUnlock size={12}/>}
          </button>
         </div>
        );
       })}</div>
      </>
     }</aside>

    {/* CENTER CANVAS & STAGE */}
    <section className={"preview panel-"+panel}>
     <div className="canvas-space">
      <div className="stage" ref={stage} onErrorCapture={event=>{if(event.target instanceof HTMLImageElement||event.target instanceof HTMLMediaElement){player.current?.pause();setPlaying(false);setPreviewMediaError(true);}}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='copy'}} onDrop={e=>{e.preventDefault();try{const r=e.currentTarget.getBoundingClientRect();addAsset(JSON.parse(e.dataTransfer.getData('application/x-doyin-asset')),{x:(e.clientX-r.left)/r.width*1920,y:(e.clientY-r.top)/r.height*1080})}catch{}}} onPointerDown={e=>{if(timelineMode==='scene')startDrag(e)}} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={cancelDrag}>
       {ready&&(previewMediaError?<ErrorNotice label="khung xem" onRetry={retryPreview}/>:<ErrorBoundary label="khung xem" resetKey={scene+timelineMode} onRetry={retryPreview}><Player errorFallback={()=> <ErrorNotice label="khung xem" onRetry={retryPreview}/>} key={scene+'-'+timelineMode+'-'+playerAttempt} ref={player} initialFrame={frame} playbackRate={playbackRate} component={(timelineMode==='film'?FilmComposition:Composition) as any} inputProps={timelineMode==='film'?filmInputProps:sceneInputProps} compositionWidth={1920} compositionHeight={1080} durationInFrames={totalFrames} fps={30} controls={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false} style={{width:'100%'}}/></ErrorBoundary>)}
       {showSafeArea&&<div className="canvas-safe-area" aria-hidden="true"><div className="safe-box-action"/><div className="safe-box-title"/></div>}
       {bounds&&!playing&&<div className={'selection '+(isLocked?'locked':'')} style={bounds}><span>{info?.label}</span>{!isLocked&&<button className="scale-handle" aria-label="Kéo để đổi scale" onPointerDown={e=>{e.stopPropagation();startDrag(e,true)}}/>}</div>}

       {/* Subtle Top-Right Stage Monitor HUD */}
       {!playing&&timelineMode==='scene'&&(
        <div className="canvas-stage-hud" onPointerDown={e=>e.stopPropagation()}>
         <button
          type="button"
          className={`stage-hud-btn ${showDialogueOverlay?'active':''}`}
          onClick={()=>setShowDialogueOverlay(v=>!v)}
          title="Hiện/ẩn dòng lời thoại xem nhanh trên khung hình"
         >
          <IconMessage size={12}/>
          <span>Thoại</span>
         </button>
         <button
          type="button"
          className={`stage-hud-btn ${showSafeArea?'active':''}`}
          onClick={()=>setShowSafeArea(v=>!v)}
          title="Bật/tắt khung an toàn 90% / 80% khi căn bố cục"
         >
          <IconGrid size={12}/>
          <span>An toàn</span>
         </button>
        </div>
       )}

       {/* Floating dialogue callout */}
       {showDialogueOverlay&&currentCueText&&!playing&&(
        <div className="canvas-dialogue-callout">
         <span className="callout-badge">{currentCueObj?`#${currentCueObj.index}`:'Thoại'}</span>
         <strong>{currentCueText}</strong>
        </div>
       )}

       {/* Direct Destination Motion HUD */}
       {motionTargeting&&<div className="canvas-motion-hud"><span>Đang kéo đích (+{motionDuration}s) · Thả chuột để áp dụng · Esc để hủy</span></div>}
      </div>
     </div>

     {/* TRANSPORT CONTROLS */}
     <TransportControls
      auto={auto}
      setAuto={setAuto}
      proMode={proMode}
      playbackRate={playbackRate}
      onCyclePlaybackRate={cyclePlaybackRate}
      onPrevCue={goPrevCue}
      onNextCue={goNextCue}
      hasCues={timelineMode==='scene'&&storyCues.length>0}
     />

     {/* TIMELINE REGION */}
     <div className="timeline">
      {timelineMode==='film'&&project?<FilmTimeline project={project} frame={frame} onSeek={seek} onOpen={openScene} onReorder={reorderScenes} disabled={projectBusy}/>:
       <StudioTimeline
         cues={storyCues}
         activeCueId={activeCueId}
         onSelectCue={handleSelectCue}
         layers={doc.layers}
         selectedLayerId={selected}
         onSelectLayer={(id)=>{const asset=doc.layers[id]?.asset;if(asset&&(frame<asset.from||frame>=asset.to)){seek(asset.from);}setSelected(id);}}
         totalFrames={totalFrames}
         currentFrame={frame}
         onSeek={seek}
         playing={playing}
         onDragClip={dragRange}
         onSplitAtPlayhead={splitAtPlayhead}
         onToggleKeyframe={(targetFrame)=>toggleKeys(['x','y'],targetFrame)}
         onSelectKeyframe={(field,kfFrame)=>{setChosenKey({field,frame:kfFrame});}}
         onToggleTrackKeyframe={field=>toggleKeys(trackFields(field))}
         onMoveKeyframe={(field,from,to)=>{if(sceneReadOnly||session.current.busy||fieldLocked(field))return;try{const next=copy(docRef.current);next.layers[selected]=editTrackKey(next.layers[selected],field,from,{frame:to});commit(next);player.current?.seekTo(to);setChosenKey({field,frame:to});}catch(e:any){setStatus(e.message)}}}
         chosenKey={chosenKey}
         disabled={sceneReadOnly}
         zoomShot={zoomShot}
         onToggleZoom={()=>setZoomShot(!zoomShot)}
         shotLabel={shot?.label}
         timeFrom={timeFrom}
         timeTo={timeTo}
         proMode={proMode}
        />
      }
     </div>
     </section>

    {/* RIGHT CONTEXT INSPECTOR */}
    <ErrorBoundary label="bảng chỉnh sửa" resetKey={scene+selected+timelineMode}><aside ref={inspectorRef} className={"inspector panel-"+panel+(chosenKey?" has-key":"")}>
     <h3>{timelineMode==='film'?'Tổng quan phim':info?.label??'Tổng quan cảnh'}</h3>

     <QuickAuthoring
      key={scene+selected}
      selected={selected}
      layer={layer}
      infoLabel={info?.label}
      disabled={isLocked||saving||!ready||timelineMode==='film'}
      canPaste={!!layoutClipboard}
      proMode={proMode}
      document={doc}
      frame={frame}
      onAttachParent={handleAttachParent}
      onDetachParent={handleDetachParent}
      onToggleLayoutLock={handleToggleLayoutLock}
      currentFraming={currentFraming}
      onApplyFraming={handleApplyFraming}
      isFocused={isFocused}
      hasAnyDimmed={hasAnyDimmed}
      onFocusLayer={handleFocusLayer}
      onClearFocus={handleClearFocus}
      onAdd={()=>{setReplacementTarget(null);setSidebar('objects');setLibraryOpen(true)}}
      onReplace={()=>{setReplacementTarget({scene,id:selected});setSidebar('objects');setLibraryOpen(true)}}
      onSelectPose={handleSelectPoseOrFace}
      onSelectFace={handleSelectPoseOrFace}
      motionTargeting={motionTargeting}
      motionDuration={motionDuration}
      onStartMotionTargeting={startMotionTargeting}
      onCancelMotionTargeting={cancelMotionTargeting}
      onCopy={()=>{
       const entries=captureLayout(docRef.current,frame);
       setLayoutClipboard(entries);
       setStatus('Đã chụp bố cục frame hiện tại.');
      }}
      onPaste={()=>{
       if(!layoutClipboard)return;
       const next=copy(docRef.current);
       commit(pasteLayout(next,layoutClipboard,scene,frame,shot.to,()=>crypto.randomUUID()));
       setStatus('Đã dán bố cục vào cảnh.');
      }}
      onDuplicate={duplicateLayer}
      onDelete={deleteLayer}
      onFlip={flipLayer}
      onStepZ={stepLayerZ}
      values={values}
      onContinueToNewScene={continueToNewScene}
      nextScene={nextSceneObj}
      onOpenNextScene={()=>nextSceneId&&openScene(nextSceneId)}
      transformControls={transformControlsBlock}
      cues={storyCues}
      activeCueId={activeCueId}
      onSelectCue={handleSelectCue}
      sceneTitle={createdScenes[scene]?.title??scene}
      sceneDuration={sceneMeta[scene]?.duration??0}
      layerStats={layerStats}
      sceneReadOnly={sceneReadOnly}
      onResetLayer={resetSelectedLayer}
      advancedDrawer={advancedDrawerNode}
     />

     {chosenKey&&<div className="key-settings">
      <h4>Keyframe {labels[chosenKey.field]}</h4>
      {chosenKey.field==='position'&&<p className="hint">X {Math.round(values.x)} · Y {Math.round(values.y)} — hai tọa độ cùng một mốc.</p>}
      <label>Frame <input aria-label="Frame keyframe" type="number" value={chosenKey.frame} disabled={isLocked} onChange={e=>changeKey(Number(e.target.value))}/></label>
      <label>Chuyển động <select aria-label="Easing keyframe" value={trackKeys(layer,chosenKey.field).find((k:any)=>k.frame===chosenKey.frame)?.easing??'linear'} disabled={isLocked} onChange={e=>updateKey({easing:e.target.value})}><option value="linear">Đều</option><option value="smooth">Mềm đầu/cuối</option><option value="ease-in">Tăng tốc</option><option value="ease-out">Chậm dần</option><option value="hold">Giữ đến mốc sau</option></select></label>
      <button onClick={deleteKey} disabled={isLocked}>Xóa keyframe này</button>
     </div>}
    </aside></ErrorBoundary>
   </>}
  </div>
 </main></TransportContext.Provider>;
}

createRoot(document.getElementById('root')!).render(<ErrorBoundary label="Studio"><App/></ErrorBoundary>);
