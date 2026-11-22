// Timing Resolver: resolves beat durations and audio cues for a scene plan.
// Supports two modes on the same declarative plan:
//   - 'auto-tts' (production default): prepares/measures each beat's quote via narration-cache (TTS + ffprobe)
//     and derives exact frame counts (+ padFrames, default 12f at 30fps) plus CreatedScene audio cues.
//   - 'draft': uses explicit beat.frames or estimates duration from quote word count without calling TTS.
import {prepareNarration} from './narration-cache.mjs';

export const DEFAULT_FPS=30;
export const DEFAULT_PAD_FRAMES=12;
export const DEFAULT_VOICE_ID='voice.capcut.mai.v1';

/** Estimate a readable draft duration (45-90f at 30fps) when beat.frames is omitted in draft mode. */
export function estimateDraftFrames(quote,fps=DEFAULT_FPS){
  const words=String(quote??'').trim().split(/\s+/).filter(Boolean).length;
  const seconds=Math.max(1.5,Math.min(3.0,words*0.32+0.6));
  return Math.round(seconds*fps);
}

/**
 * Resolve beat frames and audio cues for a scene plan.
 * Returns { plan: resolvedPlanWithFrames, cues, timingMode, duration }.
 */
export async function resolvePlanTiming(plan,{prepareAudio=prepareNarration}={}){
  const cfg=plan.timing??{mode:'draft'};
  const mode=cfg.mode??'draft';
  if(!['draft','auto-tts'].includes(mode))throw Error('Kế hoạch cảnh: timing.mode phải là draft hoặc auto-tts');
  const fps=cfg.fps??DEFAULT_FPS;
  const padFrames=cfg.padFrames??DEFAULT_PAD_FRAMES;
  const voiceId=cfg.voiceId??DEFAULT_VOICE_ID;

  const beats=[],cues=[];
  let cursor=0;

  for(let i=0;i<(plan.beats??[]).length;i++){
    const beat=plan.beats[i];
    if(mode==='draft'){
      const frames=Number.isInteger(beat.frames)?beat.frames:estimateDraftFrames(beat.quote,fps);
      beats.push({...beat,frames});
      cursor+=frames;
      continue;
    }
    // auto-tts mode: measure real audio duration for beat.quote
    const narration=await prepareAudio(beat.quote,{voiceId});
    const audioFrames=Math.max(6,Math.ceil(narration.durationSec*fps));
    const frames=Math.max(12,audioFrames+padFrames);
    const from=cursor,to=cursor+frames;
    cues.push({
      cueId:`${plan.id}-${beat.id}`,
      from,
      to:from+audioFrames,
      text:beat.quote,
      publicPath:narration.publicPath,
      sha256:narration.sha256,
      durationSec:narration.durationSec,
      voiceId:narration.voiceId??voiceId,
    });
    beats.push({...beat,frames});
    cursor=to;
  }

  return {
    plan:{...plan,beats},
    cues,
    timingMode:mode,
    duration:cursor,
  };
}
