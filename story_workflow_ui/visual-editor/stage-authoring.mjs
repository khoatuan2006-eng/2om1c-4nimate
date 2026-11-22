import {applyAuthoringOperations} from './authoring-operations.mjs';
/** Prepared catalog sprites + authored semantic stages -> the existing editor document. */
export function authorStages({id,duration,stages,selections}){
 let document={version:1,revision:0,layers:{}},cursor=0;const stageLayers={};
 for(let i=0;i<stages.length;i++){
  const stage=stages[i];if(stage.from!==cursor||stage.to<=stage.from||stage.to>duration)throw Error('Stage timeline has gaps');cursor=stage.to;
  const commands=[],ids=[];
  for(let j=0;j<stage.sprites.length;j++){
   const s=stage.sprites[j],key='stage-'+i+'-'+j,layerId=id+'/shot-'+stage.from+'/op-'+key;ids.push(layerId);
   commands.push({op:'add-asset',id:key,asset:s.asset,from:stage.from,to:stage.to,placement:{x:s.x,y:s.y,height:s.height,anchor:s.anchor??'bottom-center',flipX:s.flipX??false,z:s.z??(j?100+j:0)}});
   if(s.rotation)commands.push({op:'transform',layerId,values:{rotation:s.rotation}});
   if(s.move&&stage.to-stage.from>=2)commands.push({op:'move',layerId,from:stage.from,to:stage.to,delta:s.move,easing:'smooth'});
  }
  document=applyAuthoringOperations({id,duration},document,commands,selections).document;stageLayers[i]=ids;
 }
 if(cursor!==duration)throw Error('Stage timeline incomplete');return {document,stageLayers};
}
