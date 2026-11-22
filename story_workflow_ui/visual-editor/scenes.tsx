import React from 'react';
import {SceneScope} from './Editable';
import {legacySceneMeta} from '@legacy-scenes';
export const sceneMeta:Record<string,{duration:number;shots:Array<{from:number;to:number;label?:string}>}>=legacySceneMeta;
const cache=new Map<string,React.FC<any>>();
export function withScene(id:string,Component:React.ComponentType<any>):React.FC<any>{
 const key=id+Component.name;
 if(!cache.has(key))cache.set(key,(props:any)=><SceneScope scene={id} shots={sceneMeta[id]?.shots??[]}><Component {...props}/></SceneScope>);
 return cache.get(key)!;
}
