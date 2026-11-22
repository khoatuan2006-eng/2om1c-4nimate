export function assertAudioDraft(job,draft,projectId){
 if(!job||typeof job!=='object')throw Object.assign(Error('Trạng thái audio chưa hợp lệ. Giữ bản nháp và kiểm tra lại audio.'),{code:'INVALID_AUDIO_JOB'});
 const lines=String(draft.text??'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 if(job.id!==draft.id||(job.projectId??'nhat-thanh-ep01')!==projectId||job.voiceId!==draft.voiceId||JSON.stringify(job.lines)!==JSON.stringify(lines))throw Object.assign(Error('Audio này thuộc một nội dung hoặc giọng đọc khác. Giữ nội dung đang nhập và tạo bản nháp mới.'),{status:409});
 const invalid=()=>Object.assign(Error('Trạng thái hoặc thời lượng audio chưa hợp lệ. Giữ bản nháp và kiểm tra lại audio trước khi chọn nền.'),{code:'INVALID_AUDIO_JOB'});
 if(!['queued','running','cancelling','complete','failed','interrupted','cancelled'].includes(job.status)||!Array.isArray(job.cues)||job.cues.length>lines.length)throw invalid();
 let frame=0;
 for(let i=0;i<job.cues.length;i++){
  const cue=job.cues[i];
  if(!cue||cue.text!==lines[i]||cue.cueId!==draft.id+'-'+i||!Number.isFinite(cue.durationSec)||cue.durationSec<=0||typeof cue.publicPath!=='string'||!cue.publicPath.startsWith('/')||cue.publicPath.startsWith('//'))throw invalid();
  const from=frame;frame+=Math.ceil(cue.durationSec*30);
  if(job.status==='complete'&&(cue.from!==from||cue.to!==frame))throw invalid();
 }
 if(job.status==='complete'&&(job.cues.length!==lines.length||!Number.isSafeInteger(job.duration)||job.duration!==frame||frame<1||frame>108000))throw invalid();
 return job;
}
