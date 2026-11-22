import {useState} from 'react';
import {browserCache} from './browser-cache.mjs';

const PLAYBACK_RATES = [1, 1.5, 2, 0.5] as const;

export function useWorkspacePanels(){
 const [libraryOpen,setLibraryOpen]=useState(false);
 const [zoomShot,setZoomShot]=useState(true);
 const [storyboardOpen,setStoryboardOpen]=useState(false);
 const [createOpen,setCreateOpen]=useState(false);
 const [draftsOpen,setDraftsOpen]=useState(false);
 const [panel,setPanel]=useState('properties');
 const [projectsOpen,setProjectsOpen]=useState(false);
 const [exportOpen,setExportOpen]=useState(false);
 const [backupOpen,setBackupOpen]=useState(false);
 const [sidebar,setSidebar]=useState('objects');
 const [timelineMode,setTimelineMode]=useState('scene');

 const [proMode,setProModeState]=useState<boolean>(()=>browserCache.getItem('studio-pro-mode')==='1');
 const setProMode=(next:boolean|((prev:boolean)=>boolean))=>{
  setProModeState(prev=>{
   const resolved=typeof next==='function'?next(prev):next;
   browserCache.setItem('studio-pro-mode',resolved?'1':'0');
   return resolved;
  });
 };

 const [showDialogueOverlay,setShowDialogueOverlay]=useState(true);
 const [showSafeArea,setShowSafeArea]=useState(false);
 const [shortcutsOpen,setShortcutsOpen]=useState(false);
 const [playbackRate,setPlaybackRate]=useState<number>(1);

 const cyclePlaybackRate=()=>{
  setPlaybackRate(current=>{
   const idx=PLAYBACK_RATES.indexOf(current as (typeof PLAYBACK_RATES)[number]);
   return PLAYBACK_RATES[(idx+1)%PLAYBACK_RATES.length];
  });
 };

 return {
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
 };
}
