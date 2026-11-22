// Scene transitions as an overlay inside the scene's own frames. Scene durations come from verified audio,
// so a transition must never overlap or lengthen scenes (unlike @remotion/transitions' TransitionSeries).
export const transitionTypes=Object.freeze(['fade-black','fade-white','wipe-left','wipe-right','flash']);
export const MAX_TRANSITION_FRAMES=90;

export function validateTransitions(value,duration){
  if(value===undefined)return;
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Chuyển cảnh không hợp lệ');
  for(const key of Object.keys(value))if(!['in','out'].includes(key))throw Error('Chuyển cảnh chỉ có "in" và "out"');
  for(const [side,t] of Object.entries(value)){
    if(!t||typeof t!=='object'||!transitionTypes.includes(t.type)||!Number.isInteger(t.frames)||t.frames<1||t.frames>MAX_TRANSITION_FRAMES||t.frames>duration)
      throw Error('Chuyển cảnh '+side+' không hợp lệ (type '+transitionTypes.join('/')+', 1–'+MAX_TRANSITION_FRAMES+' frame)');
    for(const key of Object.keys(t))if(!['type','frames'].includes(key))throw Error('Chuyển cảnh có trường lạ: '+key);
  }
}

const smooth=t=>t*t*(3-2*t);
/** Overlay for one frame of a scene, or null. Out ends fully covered on the last frame; in starts fully covered on frame 0.
 *  clipPath keeps the visible part of the overlay, so a wipe is an overlay whose kept rectangle grows (out) or shrinks (in). */
export function transitionOverlay(transitions,frame,duration){
  if(!transitions)return null;
  for(const side of ['in','out']){
    const t=transitions[side];if(!t)continue;
    if(side==='in'?frame>=t.frames:frame<duration-t.frames)continue;
    const amount=Math.max(0,Math.min(1,side==='out'?(frame-(duration-t.frames)+1)/t.frames:1-frame/t.frames));
    const color=t.type==='fade-white'||t.type==='flash'?'#ffffff':'#000000',eased=smooth(amount);
    if(t.type==='fade-black'||t.type==='fade-white')return {color,opacity:eased,clipPath:null};
    if(t.type==='flash')return {color,opacity:side==='in'?amount*amount:eased*eased,clipPath:null};
    const kept=eased*100;
    if(t.type==='wipe-left')return {color,opacity:1,clipPath:side==='out'?`inset(0 0 0 ${100-kept}%)`:`inset(0 ${100-kept}% 0 0)`};
    return {color,opacity:1,clipPath:side==='out'?`inset(0 ${100-kept}% 0 0)`:`inset(0 0 0 ${100-kept}%)`};
  }
  return null;
}
