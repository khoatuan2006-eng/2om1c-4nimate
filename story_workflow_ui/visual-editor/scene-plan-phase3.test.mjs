import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import sharp from 'sharp';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildScene} from './scene-plan.mjs';
import {resolvePlanTiming} from './timing-resolver.mjs';
import {ProjectStore} from './project-store.mjs';
import {scenePlanPlugin} from './scene-plan-server.mjs';
import {validateDocument} from './model.mjs';
import {computeDuckedVolume,sketchyRectPaths,activeCaptionWordIndex} from './fx-presets.mjs';

const h=c=>c.repeat(64);
const item=(id,name,extra={})=>({id:h(id),name,width:100,height:100,bbox:[0,0,100,100],...extra});
const catalog=[
  {id:'film/bg1',name:'Phòng vệ sinh',type:'backgrounds',collection:'film',canvas:[1920,1080],groups:{layers:[item('1','nền')]}},
  {id:'film/bg2',name:'Boong tàu ban đêm',type:'backgrounds',collection:'film',canvas:[1920,1080],groups:{layers:[item('6','nền đêm')]}},
  {id:'film/hero',name:'Nhật Thành',type:'characters',collection:'film',canvas:[900,1200],groups:{
    poses:[item('2','站立'),item('3','叉腰')],
    faces:[item('4','惊吓',{style:'detailed'}),item('5','坏笑',{style:'detailed'})]}},
  {id:'film/book',name:'Sách cổ',type:'props',collection:'film',canvas:[400,400],groups:{props:[item('7','sách')]}},
];

function makePrepare(bgRel,charRel){
  return async requests=>Object.fromEntries(Object.entries(requests).map(([key,r])=>{
    const owner=catalog.find(a=>a.id===r.catalogId);
    const isBg=owner.type==='backgrounds';
    return [key,{name:owner.name,type:owner.type,width:isBg?1920:400,height:isBg?1080:1100,parts:[{src:isBg?bgRel:charRel,left:0,top:0,width:isBg?1920:400,height:isBg?1080:1100}]}];
  }));
}

test('camera presets compile to bg.camera keyframes and parallax parentId/depth on actors',async()=>{
  const plan={
    version:1,id:'cam-demo',title:'Camera demo',
    location:{asset:'Phòng vệ sinh'},
    cast:{hero:{asset:'Nhật Thành',faceStyle:'detailed'}},
    camera:'drift',
    beats:[
      {id:'b1',quote:'Nhịp một đẩy máy nhẹ',frames:60,shot:'medium',camera:'push-in',actors:[{who:'hero',pose:'đứng',face:'hoảng sợ',at:'left',depth:'near'}]},
      {id:'b2',quote:'Nhịp hai tự kế thừa drift',frames:60,shot:'close',actors:[{who:'hero',pose:'chống nạnh',face:'坏笑',at:'center',depth:'mid'}]},
    ],
  };
  const bgRel=`library-assets/${h('b')}.png`,charRel=`library-assets/${h('c')}.png`;
  const scene=await buildScene(plan,{catalog,prepareSelections:makePrepare(bgRel,charRel)});
  const d=scene.document;
  assert.doesNotThrow(()=>validateDocument(d,120));
  const bg=d.layers['cam-demo/shot-0/op-bg'];
  const actor1=d.layers['cam-demo/shot-0/op-b0-hero'];
  const actor2=d.layers['cam-demo/shot-60/op-b1-hero'];
  assert.equal(bg.camera.enabled,true);
  assert.equal(bg.camera.keys.scale.length,4,'2 beats x (start, end) keyframes');
  assert.equal(bg.camera.keys.scale[0].value,1);
  assert(bg.camera.keys.scale[1].value>1.05,'push-in zooms in');
  assert.equal(actor1.parentId,'cam-demo/shot-0/op-bg');
  assert.equal(actor2.parentId,'cam-demo/shot-60/op-bg'.replace('shot-60','shot-0'));
  assert(actor1.depth>actor2.depth&&actor2.depth>bg.depth,'near > mid > bg parallax depth');
});

test('Timing Resolver supports auto-tts (measured cues + padFrames) and draft estimation',async()=>{
  const basePlan={
    version:1,id:'tts-demo',title:'TTS demo',
    location:{asset:'Phòng vệ sinh'},
    cast:{hero:{asset:'Nhật Thành',faceStyle:'detailed'}},
    timing:{mode:'auto-tts',voiceId:'voice.test.v1',padFrames:12},
    beats:[
      {id:'b1',quote:'Câu thoại một ngắn gọn.',actors:[{who:'hero',pose:'đứng',at:'center'}]},
      {id:'b2',quote:'Câu thoại hai dài hơn một chút để kiểm tra.',actors:[{who:'hero',pose:'chống nạnh',at:'center'}]},
    ],
  };
  let calls=0;
  const mockAudio=async(text,{voiceId})=>{
    calls++;
    const durationSec=calls===1?1.5:2.0;
    return {status:'complete',text,voiceId,publicPath:`audio/${h(String(calls))}.mp3`,sha256:h(String(calls)),durationSec};
  };
  const timed=await resolvePlanTiming(basePlan,{prepareAudio:mockAudio});
  assert.equal(calls,2);
  assert.equal(timed.timingMode,'auto-tts');
  assert.equal(timed.plan.beats[0].frames,Math.ceil(1.5*30)+12);
  assert.equal(timed.plan.beats[1].frames,Math.ceil(2.0*30)+12);
  assert.equal(timed.cues.length,2);
  assert.equal(timed.cues[0].from,0);
  assert.equal(timed.cues[0].to,45);
  assert.equal(timed.cues[1].from,57);

  // Draft mode estimates frames without calling prepareAudio
  let draftCalls=0;
  const draftTimed=await resolvePlanTiming({...basePlan,timing:{mode:'draft'}},{prepareAudio:async()=>{draftCalls++;throw Error('should not call TTS');}});
  assert.equal(draftCalls,0);
  assert(draftTimed.plan.beats[0].frames>=45&&draftTimed.plan.beats[0].frames<=90);
  assert.equal(draftTimed.cues.length,0);
});

test('Detach Guard protects manual UI edits from scene-plan overwrite and HTTP API preview/apply work end-to-end',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'scene-plan-p3-'));
  let store,server;
  try{
    const mediaDir=join(dir,'media');
    mkdirSync(join(mediaDir,'library-assets'),{recursive:true});
    const bgBuf=await sharp({create:{width:1920,height:1080,channels:4,background:{r:30,g:60,b:90,alpha:1}}}).png().toBuffer();
    const charBuf=await sharp({create:{width:400,height:1100,channels:4,background:{r:200,g:80,b:60,alpha:1}}}).png().toBuffer();
    const bgRel=`library-assets/${h('b')}.png`,charRel=`library-assets/${h('c')}.png`;
    writeFileSync(join(mediaDir,bgRel),bgBuf);
    writeFileSync(join(mediaDir,charRel),charBuf);

    store=new ProjectStore(join(dir,'projects.sqlite'),{mediaDirectory:mediaDir});
    const project=store.create('Test Project');
    store.setMode(project.id,'draft');

    // Mount scenePlanPlugin on a local HTTP server
    const middlewares=[];
    scenePlanPlugin({
      store,mediaDirectory:mediaDir,
      catalogReader:async()=>catalog,
      prepareSelections:makePrepare(bgRel,charRel),
    }).configureServer({middlewares:{use:fn=>middlewares.push(fn)}});

    server=http.createServer((req,res)=>{
      let i=0;
      const next=()=>{const fn=middlewares[i++];if(fn)fn(req,res,next);else{res.statusCode=404;res.end();}};
      next();
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const port=server.address().port;
    const post=(path,body)=>fetch(`http://127.0.0.1:${port}${path}`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Origin':`http://127.0.0.1:${port}`},
      body:JSON.stringify(body),
    }).then(async r=>({status:r.status,json:await r.json()}));

    const plan={
      version:1,id:'ep02-p3',title:'Cảnh thử Pha 3',
      location:{asset:'Phòng vệ sinh'},
      cast:{hero:{asset:'Nhật Thành',faceStyle:'detailed'}},
      camera:'drift',
      beats:[{id:'b1',quote:'Nhật Thành đứng nhìn quanh',frames:60,shot:'medium',actors:[{who:'hero',pose:'đứng',face:'hoảng sợ',at:'center'}]}],
    };

    // 1. Tier-1 preview does not write SQLite
    const prev=await post('/api/scene-plans/preview',{plan,frames:[10]});
    assert.equal(prev.status,200);
    assert.equal(prev.json.tier,'tier-1-fast-layout-check');
    assert.equal(prev.json.notForReview,true);
    assert.equal(prev.json.frames.length,1);
    assert(prev.json.frames[0].pngBase64.length>100);
    assert.equal(store.get(project.id).scenes.length,0,'preview never writes to SQLite');

    // 2. Apply creates scene as plan-managed
    const created=await post('/api/scene-plans/apply',{projectId:project.id,revision:project.revision,plan});
    assert.equal(created.status,201);
    assert.equal(created.json.created,true);
    assert.equal(created.json.planState.status,'plan-managed');

    // 3. Re-compile while plan-managed succeeds
    const plan2={...plan,beats:[{...plan.beats[0],quote:'Nhật Thành đổi tư thế',actors:[{who:'hero',pose:'chống nạnh',face:'坏笑',at:'left'}]}]};
    const updated=await post('/api/scene-plans/apply',{projectId:project.id,revision:created.json.projectRevision,documentRevision:created.json.documentRevision,plan:plan2});
    assert.equal(updated.status,200);
    assert.equal(updated.json.created,false);
    assert.equal(updated.json.documentRevision,created.json.documentRevision+1);

    // 4. Director edits manually on Studio UI -> scene becomes detached
    const docNow=store.getEdits('ep02-p3',project.id);
    docNow.layers['ep02-p3/shot-0/op-b0-hero'].base.x+=25;
    const savedManual=store.saveEdits('ep02-p3',docNow,project.id);
    assert.equal(store.get(project.id).scenes[0].planState.status,'detached');

    // 5. Compiler overwrite is blocked with 409 SCENE_DETACHED
    const blocked=await post('/api/scene-plans/apply',{projectId:project.id,revision:updated.json.projectRevision,documentRevision:savedManual.revision,plan});
    assert.equal(blocked.status,409);
    assert.equal(blocked.json.code,'SCENE_DETACHED');

    // 6. Explicit forceResync restores plan-managed and preserves history
    const resynced=await post('/api/scene-plans/apply',{projectId:project.id,revision:updated.json.projectRevision,documentRevision:savedManual.revision,plan,forceResync:true});
    assert.equal(resynced.status,200);
    assert.equal(resynced.json.planState.status,'plan-managed');
    assert(store.history('ep02-p3',project.id).length>=2,'edit_history keeps prior revisions');
  }finally{
    if(server)await new Promise(r=>server.close(r));
    if(store)store.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('multi-location montage (beat.location), beat.props, beat.panel and automatic subtitleCues compile cleanly in one scene',async()=>{
  const plan={
    version:1,id:'montage-demo',title:'Montage + Prop + Panel',
    location:{asset:'Phòng vệ sinh'},
    cast:{hero:{asset:'Nhật Thành',faceStyle:'detailed'}},
    camera:'drift',
    beats:[
      {id:'b1',quote:'Cảnh đầu ở phòng',frames:45,shot:'medium',actors:[{who:'hero',pose:'đứng',face:'hoảng sợ',at:'left'}]},
      {
        id:'b2',quote:'Chuyển sang boong tàu ban đêm, mở bảng hệ thống cùng sách cổ.',frames:60,shot:'medium',
        location:{asset:'Boong tàu ban đêm'},
        camera:'push-in',
        actors:[{who:'hero',pose:'chống nạnh',face:'坏笑',at:'left'}],
        props:[{prop:'Sách cổ',at:'center',height:220,enter:'pop-in'}],
        panel:{title:'THIÊN PHÚ: [HỌC CÓ THU HOẠCH]',text:'• Bảo đảm lợi ích tối thiểu\n• Tập trung tăng rõ rệt',side:'right'},
      },
    ],
  };
  const bgRel=`library-assets/${h('b')}.png`,charRel=`library-assets/${h('c')}.png`;
  const scene=await buildScene(plan,{catalog,prepareSelections:makePrepare(bgRel,charRel)});
  assert.doesNotThrow(()=>validateDocument(scene.document,105));
  const ids=Object.keys(scene.document.layers);
  assert(ids.includes('montage-demo/shot-0/op-bg'),'first background segment');
  assert(ids.includes('montage-demo/shot-45/op-bg1'),'second background segment from beat.location');
  assert(ids.includes('montage-demo/shot-45/op-b1-prop0'),'prop layer added');
  assert.equal(scene.document.layers['montage-demo/shot-45/op-bg1'].camera.enabled,true,'second bg segment has its own camera');
  assert.equal(scene.document.layers['montage-demo/shot-45/op-b1-hero'].parentId,'montage-demo/shot-45/op-bg1','actor parents to its own beat location bg');
  assert.equal(scene.source.panels.length,1);
  assert.equal(scene.source.panels[0].title,'THIÊN PHÚ: [HỌC CÓ THU HOẠCH]');
  assert.equal(scene.source.subtitleCues.length,2,'auto subtitleCues generated for draft beats');
});

test('motion-comic FX presets (aura, cameraShake, focus/speed lines, impact flash) compile cleanly',async()=>{
  const plan={
    version:1,id:'fx-demo',title:'FX Presets',
    location:{asset:'Phòng vệ sinh'},
    cast:{hero:{asset:'Nhật Thành',faceStyle:'detailed'}},
    beats:[{
      id:'b1',quote:'Phải trở nên mạnh mẽ!',frames:60,shot:'close',
      cameraShake:{at:4,frames:12,intensity:14},
      lines:'focus',
      flash:{at:4,frames:3,color:'gold'},
      actors:[{who:'hero',pose:'chống nạnh',face:'坏笑',at:'center',aura:'power'}],
    }],
  };
  const bgRel=`library-assets/${h('b')}.png`,charRel=`library-assets/${h('c')}.png`;
  const scene=await buildScene(plan,{catalog,prepareSelections:makePrepare(bgRel,charRel)});
  assert.doesNotThrow(()=>validateDocument(scene.document,60));
  const bg=scene.document.layers['fx-demo/shot-0/op-bg'];
  assert.equal(bg.camera.enabled,true,'cameraShake activates bg.camera automatically');
  assert(bg.camera.keys.x.length>=4,'cameraShake adds multiple jitter keyframes');
  const kinds=scene.source.effects.map(e=>e.kind);
  assert.deepEqual(kinds,['aura','lines','flash']);
  const aura=scene.source.effects.find(e=>e.kind==='aura');
  assert(aura.z<scene.document.layers['fx-demo/shot-0/op-b0-hero'].base.z,'aura sits behind actor');
});

test('beat.cuts splits long TTS quotes into dynamic sub-shots and actor.motion animates movement keyframes',async()=>{
  const plan={
    version:1,id:'dynamic-demo',title:'Multi-cut & Actor Motion',
    location:{asset:'Phòng vệ sinh'},
    cast:{hero:{asset:'Nhật Thành',faceStyle:'detailed'}},
    beats:[
      {
        id:'b1',quote:'Một câu thoại rất dài năm giây được chia thành ba góc máy nối tiếp nhau để không bị đứng hình!',
        frames:150,
        cuts:[
          {ratio:0.3,shot:'wide',actors:[{who:'hero',pose:'đứng',face:'hoảng sợ',at:'left',motion:'slide-in-left'}]},
          {ratio:0.35,shot:'medium',actors:[{who:'hero',pose:'chống nạnh',face:'坏笑',at:'center',motion:'step-in'}]},
          {ratio:0.35,shot:'close',actors:[{who:'hero',pose:'chống nạnh',face:'坏笑',at:'center',motion:'bob'}]},
        ],
      },
      {
        id:'b2',quote:'Nhịp đứng im quá lâu sẽ tự động phát cảnh báo',
        frames:120,shot:'medium',
        actors:[{who:'hero',pose:'đứng',at:'center',motion:'run-right'}],
      },
    ],
  };
  const bgRel=`library-assets/${h('b')}.png`,charRel=`library-assets/${h('c')}.png`;
  const scene=await buildScene(plan,{catalog,prepareSelections:makePrepare(bgRel,charRel)});
  assert.doesNotThrow(()=>validateDocument(scene.document,270));
  assert.equal(scene.source.shots.length,4,'b1 split into 3 visual cuts + b2 = 4 shots');
  assert.equal(scene.source.shots[0].from,0);
  assert.equal(scene.source.shots[0].to,45);
  assert.equal(scene.source.shots[2].to,150);
  // Actor motion keyframes exist on all animated layers
  const l0=scene.document.layers['dynamic-demo/shot-0/op-b0c0-hero'];
  const l1=scene.document.layers['dynamic-demo/shot-45/op-b0c1-hero'];
  const l2=scene.document.layers['dynamic-demo/shot-98/op-b0c2-hero'];
  const l3=scene.document.layers['dynamic-demo/shot-150/op-b1-hero'];
  assert(l0.keys.x.length>=2,'slide-in-left animates x');
  assert(l1.keys.x.length>=2&&l1.keys.scale.length>=2,'step-in animates x + scale');
  assert(l2.keys.y.length>=3,'bob animates subtle vertical breathing');
  assert(l3.keys.x.length>=2&&l3.keys.y.length>=5,'run-right animates x + running bounce y');
  // Warning emitted for b2 (>90f without cuts), NOT for b1 (each cut <= 53f)
  assert(scene.warnings.some(w=>w.includes('beat b2')&&w.includes('> 90f')),'warns when single visual cut exceeds 90f');
  assert(!scene.warnings.some(w=>w.includes('beat b1')),'no >90f warning when beat.cuts keeps each shot <= 90f');
});

test('at: keep carries an actor final X across cuts in the same location after dash motion',async()=>{
  const plan={
    version:1,id:'keep-demo',title:'Spatial Continuity',
    location:{asset:'Phòng vệ sinh'},
    cast:{hero:{asset:'Nhật Thành',faceStyle:'detailed'}},
    beats:[{
      id:'b1',quote:'Nhật Thành lao sang phải rồi dừng lại đúng chỗ đó.',frames:90,
      cuts:[
        {ratio:0.5,shot:'medium',actors:[{who:'hero',pose:'đứng',at:'left',motion:{type:'dash-right',distance:200}}]},
        {ratio:0.5,shot:'medium',actors:[{who:'hero',pose:'chống nạnh',at:'keep'}]},
      ],
    }],
  };
  const bgRel=`library-assets/${h('b')}.png`,charRel=`library-assets/${h('c')}.png`;
  const scene=await buildScene(plan,{catalog,prepareSelections:makePrepare(bgRel,charRel)});
  const l1=scene.document.layers['keep-demo/shot-45/op-b0c1-hero'];
  const centerX=Math.round(l1.asset.left+l1.asset.width/2+l1.base.x);
  assert.equal(centerX,560+200,'second cut starts exactly where dash-right ended (560 + 200 = 760)');
});

test('rich motion-comic FX presets (mood, particles, impact, lightning, sfxText, speed-horiz, tracked aura.layerId) compile cleanly',async()=>{
  const plan={
    version:1,id:'rich-fx-demo',title:'Rich Comic FX',
    location:{asset:'Phòng vệ sinh'},
    cast:{hero:{asset:'Nhật Thành',faceStyle:'detailed'}},
    beats:[{
      id:'b1',quote:'Hiệu ứng dày đặc không che mặt nhân vật.',frames:90,
      cuts:[
        {
          ratio:0.5,shot:'medium',
          mood:'tension',particles:'sparks',lines:'speed-horiz',
          lightning:{x:900,color:'#a855f7'},
          impact:{at:2,frames:10,x:640,y:520,color:'gold'},
          sfxText:{text:'VỤT!!',style:'speed',at:'top-left',start:2,frames:30},
          actors:[{who:'hero',pose:'đứng',face:'hoảng sợ',at:'left',aura:'power',motion:'dash-right'}],
        },
        {
          ratio:0.5,shot:'close',
          mood:'danger',particles:'embers',
          sfxText:'GẦM!!',
          actors:[{who:'hero',pose:'chống nạnh',face:'坏笑',at:'keep',aura:'rage'}],
        },
      ],
    }],
  };
  const bgRel=`library-assets/${h('b')}.png`,charRel=`library-assets/${h('c')}.png`;
  const scene=await buildScene(plan,{catalog,prepareSelections:makePrepare(bgRel,charRel)});
  assert.doesNotThrow(()=>validateDocument(scene.document,90));
  const fx=scene.source.effects;
  const kinds=fx.map(e=>e.kind);
  for(const k of ['aura','mood','particles','lines','lightning','impact','sfxText']){
    assert(kinds.includes(k),'compiled effects include '+k);
  }
  const aura0=fx.find(e=>e.kind==='aura'&&e.from===0);
  assert.equal(aura0.layerId,'rich-fx-demo/shot-0/op-b0c0-hero','aura binds to exact actor layerId for motion tracking');
  const speedLines=fx.find(e=>e.kind==='lines');
  assert.equal(speedLines.preset,'speed-horiz');
  const mood=fx.find(e=>e.kind==='mood');
  assert(mood.z<speedLines.z&&speedLines.z<fx.find(e=>e.kind==='sfxText').z,'clean z-order: mood < lines < sfxText');
});

test('open-source motion-comic upgrades (cutTransition, filmBurn, halftone, letterbox, portalGlow, dof, debris, glitch sfxText, comic panel, zoom-punch, breathe, bgm auto-ducking + sfx) compile cleanly',async()=>{
  // 1. Auto-ducking volume curve lowers during active cue & recovers smoothly between cues
  const cues=[{from:20,to:60}];
  assert.equal(computeDuckedVolume(14,{baseVolume:0.30,duckVolume:0.10,cues,from:0,to:100,fadeIn:6,fadeOut:6,ramp:6}),0.30,'full volume before speech ramp');
  const midRamp=computeDuckedVolume(17,{baseVolume:0.30,duckVolume:0.10,cues,from:0,to:100,fadeIn:6,fadeOut:6,ramp:6});
  assert(midRamp<0.30&&midRamp>0.10,'smoothly ramps down into speech');
  assert.equal(computeDuckedVolume(35,{baseVolume:0.30,duckVolume:0.10,cues,from:0,to:100,fadeIn:6,fadeOut:6,ramp:6}),0.10,'ducked during active speech');
  assert.equal(computeDuckedVolume(70,{baseVolume:0.30,duckVolume:0.10,cues,from:0,to:100,fadeIn:6,fadeOut:6,ramp:6}),0.30,'recovers after speech');

  // 2. Deterministic sketchy double-ink rectangle paths
  const [p1,p2]=sketchyRectPaths(880,320,6,7);
  assert.equal(p1.startsWith('M '),true);
  assert.notEqual(p1,p2,'double ink passes are slightly distinct');
  assert.deepEqual(sketchyRectPaths(880,320,6,7),[p1,p2],'deterministic per seed');

  // 3. Full compilation with mocked audio preset + TTS timing
  const plan={
    version:1,id:'oss-fx-demo',title:'Open-Source Upgrades Demo',
    location:{asset:'Phòng vệ sinh'},
    cast:{hero:{asset:'Nhật Thành',faceStyle:'detailed'}},
    timing:{mode:'auto-tts',voiceId:'voice.test.v1',padFrames:10},
    bgm:{preset:'action',volume:0.28,duckVolume:0.09},
    beats:[
      {
        id:'b1',quote:'Cú giật camera kèm hiệu ứng mới!',
        camera:'zoom-punch',
        cameraShake:{at:2,frames:12,intensity:14},
        cutTransition:'glitch-slam',
        dof:'soft',
        halftone:true,
        filmBurn:'warm',
        letterbox:true,
        portalGlow:{x:960,y:540,color:'#38bdf8'},
        particles:{type:'debris',x:960,y:500},
        sfxText:{text:'GLITCH!!',style:'glitch',at:'top-right'},
        sfx:[{preset:'impact',at:2,volume:0.9},{preset:'chime',at:15,volume:0.8}],
        panel:{title:'HỆ THỐNG',text:'[Cảnh báo]',style:'comic',side:'left'},
        actors:[{who:'hero',pose:'chống nạnh',face:'坏笑',at:'right',motion:'breathe'}],
      },
    ],
  };
  const bgRel=`library-assets/${h('b')}.png`,charRel=`library-assets/${h('c')}.png`;
  const mockAudio=async(text,{voiceId})=>({status:'complete',text,voiceId,publicPath:`audio/${h('a')}.mp3`,sha256:h('a'),durationSec:2.0});
  const mockPreset=async(preset,{kind})=>({preset,kind,publicPath:`audio/${h(kind==='bgm'?'d':'e')}.mp3`,contentHash:`sha256:${h(kind==='bgm'?'d':'e')}`,sha256:h(kind==='bgm'?'d':'e'),durationSec:kind==='bgm'?12.0:1.2});

  const scene=await buildScene(plan,{catalog,prepareSelections:makePrepare(bgRel,charRel),prepareAudio:mockAudio,prepareAudioPreset:mockPreset});
  assert.doesNotThrow(()=>validateDocument(scene.document,scene.source.duration));

  // Verify camera zoom-punch midKey + decaying shake
  const bgLayer=scene.document.layers['oss-fx-demo/shot-0/op-bg'];
  assert.equal(bgLayer.camera.enabled,true);
  assert(bgLayer.camera.keys.scale.length>=6,'zoom-punch + decaying shake produce rich scale keyframes');

  // Verify breathe motion keyframes on actor
  const actorLayer=scene.document.layers['oss-fx-demo/shot-0/op-b0-hero'];
  assert(actorLayer.keys.y.length>=4&&actorLayer.keys.scale.length>=4,'breathe motion generates y & scale keyframes');

  // Verify all new effects + DoF layer refs + panel style + audioTracks
  const fx=scene.source.effects;
  for(const k of ['dof','portalGlow','halftone','particles','filmBurn','letterbox','sfxText','cutTransition']){
    assert(fx.some(e=>e.kind===k),'effects contain '+k);
  }
  const dof=fx.find(e=>e.kind==='dof');
  assert.equal(dof.bgLayerId,'oss-fx-demo/shot-0/op-bg');
  assert.deepEqual(dof.actorLayerIds,['oss-fx-demo/shot-0/op-b0-hero']);
  assert.equal(scene.source.panels[0].style,'comic');
  assert.equal(scene.source.audioTracks.length,3,'1 bgm + 2 sfx audio tracks');
  assert.equal(scene.source.audioTracks[0].role,'bgm');
  assert.equal(scene.source.audioTracks[0].duckVolume,0.09);
  assert.equal(scene.source.audioTracks[1].preset,'impact');
  assert.equal(scene.source.audioTracks[2].preset,'chime');
});

test('anime wave-2 upgrades (impactFrame, actor.trail, 2D lighting, smoke/rain particles, splitPanel, highlight captionStyle) compile cleanly',async()=>{
  // 1. Character-weighted active word index progression
  const line='Một câu thoại có nhiều từ dài ngắn';
  assert.equal(activeCaptionWordIndex(line,0),0);
  const mid=activeCaptionWordIndex(line,0.5);
  assert(mid>=2&&mid<=5,'mid progress highlights middle word');
  assert.equal(activeCaptionWordIndex(line,1),line.split(' ').length-1);

  // 2. Full plan validation + compilation of items 2, 3, 4
  const plan={
    version:1,id:'wave2-oss-demo',title:'Wave 2 Upgrades',
    location:{asset:'Phòng vệ sinh'},
    cast:{hero:{asset:'Nhật Thành',faceStyle:'detailed'}},
    captionStyle:'comic',
    beats:[
      {
        id:'b1',quote:'Khói pháo hoàng hôn và đòn va chạm!',highlightColor:'#38bdf8',
        frames:60,shot:'medium',
        lighting:'sunset',particles:'smoke',
        impactFrame:{at:4,frames:2,style:'invert'},
        splitPanel:{slant:10,gutter:16},
        actors:[{who:'hero',pose:'đứng',face:'hoảng sợ',at:'left',motion:'dash-right',trail:{color:'cyan',copies:3,step:2}}],
      },
      {
        id:'b2',quote:'Đèn rọi trong cơn mưa đêm!',frames:60,shot:'close',
        lighting:{type:'spotlight',x:560,y:500,radius:440,darkness:0.65},
        particles:'rain',
        impactFrame:'crimson',
        actors:[{who:'hero',pose:'chống nạnh',face:'坏笑',at:'center',motion:'breathe'}],
      },
    ],
  };
  const bgRel=`library-assets/${h('b')}.png`,charRel=`library-assets/${h('c')}.png`;
  const scene=await buildScene(plan,{catalog,prepareSelections:makePrepare(bgRel,charRel)});
  assert.doesNotThrow(()=>validateDocument(scene.document,120));
  assert.equal(scene.source.captionStyle,'comic');
  assert.equal(scene.source.subtitleCues[0].highlightColor,'#38bdf8');
  const fx=scene.source.effects;
  for(const k of ['trail','lighting','particles','impactFrame','splitPanel']){
    assert(fx.some(e=>e.kind===k),'compiled effects include '+k);
  }
  const trail=fx.find(e=>e.kind==='trail');
  assert.equal(trail.layerId,'wave2-oss-demo/shot-0/op-b0-hero');
  assert.equal(trail.copies,3);
  const smoke=fx.find(e=>e.kind==='particles'&&e.preset==='smoke');
  const rain=fx.find(e=>e.kind==='particles'&&e.preset==='rain');
  assert(smoke.z===8420&&rain.z===8420,'weather particles layer cleanly above characters');
  const imp=fx.find(e=>e.kind==='impactFrame'&&e.from===4);
  assert.equal(imp.to,6,'2-frame impactFrame flash');
});

test('persistStage keeps actors & props fixed on the same background and focus dims non-focused objects instead of deleting them',async()=>{
  const plan={
    version:1,id:'persist-stage-demo',title:'Persist Stage & Focus',
    location:{asset:'Phòng vệ sinh'},
    persistStage:true,
    cast:{
      hero:{asset:'Nhật Thành',faceStyle:'detailed'},
      ally:{asset:'Nhật Thành',faceStyle:'detailed'},
    },
    beats:[
      {
        id:'b1',quote:'Nhấn mạnh nhân vật chính mà không xóa nhân vật phụ.',frames:120,
        cuts:[
          {
            ratio:1,shot:'wide',
            actors:[
              {who:'hero',pose:'đứng',face:'hoảng sợ',at:'left'},
              {who:'ally',pose:'chống nạnh',face:'坏笑',at:'right'},
            ],
          },
          {
            // ally omitted -> carried over automatically and dimmed because focus: 'hero'
            ratio:1,shot:'close',focus:'hero',
            actors:[{who:'hero',pose:'chống nạnh',face:'坏笑'}],
          },
          {
            // solo: true -> intentional inner monologue, ally NOT carried over
            ratio:1,shot:'close',solo:true,
            actors:[{who:'hero',pose:'đứng',face:'hoảng sợ',at:'keep'}],
          },
          {
            // leave: ['ally'] -> ally explicitly exited
            ratio:1,shot:'medium',leave:['ally'],
            actors:[{who:'hero',pose:'đứng',face:'hoảng sợ',at:'keep'}],
          },
        ],
      },
    ],
  };
  const bgRel=`library-assets/${h('b')}.png`,charRel=`library-assets/${h('c')}.png`;
  const scene=await buildScene(plan,{catalog,prepareSelections:makePrepare(bgRel,charRel)});
  assert.doesNotThrow(()=>validateDocument(scene.document,120));
  const layerIds=Object.keys(scene.document.layers);
  assert(layerIds.includes('persist-stage-demo/shot-30/op-b0c1-ally'),'ally is automatically carried over into cut 1');
  assert(!layerIds.includes('persist-stage-demo/shot-60/op-b0c2-ally'),'solo: true isolates hero for monologue');
  assert(!layerIds.includes('persist-stage-demo/shot-90/op-b0c3-ally'),'leave: [ally] removes ally cleanly');
  const dof1=scene.source.effects.find(e=>e.kind==='dof'&&e.from===30);
  assert(dof1,'focus generates a dof overlay');
  assert.deepEqual(dof1.dimLayerIds,['persist-stage-demo/shot-30/op-b0c1-ally'],'non-focused ally is dimmed/blurred');
  assert.deepEqual(dof1.actorLayerIds,['persist-stage-demo/shot-30/op-b0c1-hero'],'focused hero stays sharp');
});

test('placement guardrails prevent water-walking, obstacle overlap, actor eclipse, prop occlusion, and child/adult scale inversion',async()=>{
  const richCatalog=[
    ...catalog,
    {id:'film/sea',name:'Biển rộng · S06',type:'backgrounds',collection:'film',canvas:[1920,1080],groups:{layers:[item('a','biển')]}},
    {id:'film/alley',name:'Con hẻm cổ trong thị trấn',type:'backgrounds',collection:'film',canvas:[1920,1080],groups:{layers:[item('b','hẻm')]}},
    {id:'film/kid',name:'Trẻ em trong hồi ức',type:'characters',collection:'film',canvas:[900,1200],groups:{poses:[item('c','站立')],faces:[item('d','惊吓',{style:'detailed'})]}},
    {id:'film/dad',name:'Dân làng',type:'characters',collection:'film',canvas:[900,1200],groups:{poses:[item('e','站立')],faces:[item('f','惊吓',{style:'detailed'})]}},
    {id:'film/wb',name:'白胡子',type:'characters',collection:'film',canvas:[900,1200],groups:{poses:[item('g','站立')],faces:[]}},
  ];
  const prep=async requests=>Object.fromEntries(Object.entries(requests).map(([key,r])=>{
    const owner=richCatalog.find(a=>a.id===r.catalogId);
    const isBg=owner.type==='backgrounds';
    return [key,{name:owner.name,type:owner.type,width:isBg?1920:400,height:isBg?1080:1100,parts:[{src:`library-assets/${h(isBg?'b':'c')}.png`,left:0,top:0,width:isBg?1920:400,height:isBg?1080:1100}]}];
  }));
  const plan={
    version:1,id:'placement-guard',title:'Placement Guardrails',
    location:{asset:'Biển rộng · S06'},
    cast:{
      wb:{asset:'白胡子'},
      kid:{asset:'Trẻ em trong hồi ức',faceStyle:'detailed'},
      dad:{asset:'Dân làng',faceStyle:'detailed'},
      hero:{asset:'Nhật Thành',faceStyle:'detailed'},
    },
    beats:[
      {
        id:'b1',quote:'Cảnh biển tự cắt nửa thân (bust) và Râu Trắng cao hơn người thường.',frames:45,shot:'medium',
        actors:[
          {who:'wb',pose:'站立',at:'center'},
          {who:'hero',pose:'站立',at:'center'},
        ],
      },
      {
        id:'b2',quote:'Trong hẻm tránh giếng đá, trẻ em thấp hơn bố và rương gỗ tự lùi sau nhân vật.',frames:45,shot:'medium',
        location:{asset:'Con hẻm cổ trong thị trấn'},
        actors:[
          {who:'kid',pose:'站立',at:300},
          {who:'dad',pose:'站立',at:'left'},
        ],
        props:[
          {prop:'Sách cổ',at:'left',height:260},
        ],
      },
      {
        id:'b3',quote:'Cận cảnh shot: close tự động cắt chân dung (portrait) để thấy rõ biểu cảm.',frames:45,shot:'close',
        location:{asset:'Phòng vệ sinh'},
        actors:[{who:'hero',pose:'站立',at:'center'}],
      },
    ],
  };
  const scene=await buildScene(plan,{catalog:richCatalog,prepareSelections:prep});
  assert.doesNotThrow(()=>validateDocument(scene.document,135));
  const d=scene.document;
  const wb=d.layers['placement-guard/shot-0/op-b0-wb'];
  const hero=d.layers['placement-guard/shot-0/op-b0-hero'];
  // 1. Sea background triggers automatic bust framing (bottom edge below 1080 -> no water-walking)
  const wbBottom=wb.base.y+wb.asset.height/2+(wb.asset.height*wb.base.scale)/2;
  assert(wbBottom>1180,'sea background automatically frames bust-up (feet below bottom edge)');
  // 2. Anti-overlap separates two actors placed at identical 'center' slot
  const wbCenterX=wb.base.x+wb.asset.width/2;
  const heroCenterX=hero.base.x+hero.asset.width/2;
  assert(Math.abs(heroCenterX-wbCenterX)>=215,'two near actors at same slot are separated >= 220px');
  // 3. Whitebeard is taller than standard adult
  assert(wb.base.scale>hero.base.scale,'Whitebeard heightScale > standard adult');
  // 4. Alley stone well forbiddenZone pushes kid off x=300 into walkable corridor >= 660
  const kid=d.layers['placement-guard/shot-45/op-b1-kid'];
  const dad=d.layers['placement-guard/shot-45/op-b1-dad'];
  const kidCenterX=kid.base.x+kid.asset.width/2;
  assert(kidCenterX>=650,'actor nudged out of stone well forbidden zone into alley corridor');
  // 5. Child is strictly shorter than parent
  assert(kid.base.scale<dad.base.scale*0.75,'child heightScale strictly shorter than adult');
  // 6. Prop overlapping actor drops behind near actor (z < 120)
  const prop=d.layers['placement-guard/shot-45/op-b1-prop0'];
  assert(prop.base.z<dad.base.z,'overlapping prop automatically layers behind near actor');
  // 7. Portrait framing zooms head-and-shoulders close-up with feet well below bottom edge
  const portraitHero=d.layers['placement-guard/shot-90/op-b2-hero'];
  const portraitBottom=portraitHero.base.y+portraitHero.asset.height/2+(portraitHero.asset.height*portraitHero.base.scale)/2;
  assert(portraitBottom>1480&&portraitHero.base.scale>hero.base.scale,'portrait framing crops cleanly to head-and-shoulders');
});
