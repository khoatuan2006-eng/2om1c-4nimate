/** Both existing TTS jobs and imported immutable cache audio share the same media root. */
export function audioReference(cue){
 const path=cue.publicPath?.split('?')[0].replace(/^\//,'');
 if(typeof path!=='string'||!(/^[a-z]+\//.test(path))||!(/^(generated\/audio\/[a-zA-Z0-9-]+\.mp3|audio\/[a-f0-9]{64}\.mp3)$/.test(path)))throw Error('Audio trong bản dựng không hợp lệ.');
 const named=/^audio\/([a-f0-9]{64})\.mp3$/.exec(path)?.[1],declared=cue.contentHash?.replace(/^sha256:/,'');
 if(declared&&!/^[a-f0-9]{64}$/.test(declared)||named&&declared&&named!==declared)throw Error('Hash audio không hợp lệ.');
 return {path,expected:named??declared??null};
}
