import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {FilmComposition} from './ProjectComposition';
const emptyProject={duration:1,scenes:[]};
const Root=()=> <Composition id="ProjectFilm" component={FilmComposition} width={1920} height={1080} fps={30} durationInFrames={1} defaultProps={{project:emptyProject}} calculateMetadata={({props}:any)=>({durationInFrames:Math.max(1,props.project.duration),fps:30,width:1920,height:1080})}/>;
registerRoot(Root);
