import {assemblyPlugin} from './assembly-server.mjs';
import {productionWorkflowPlugin} from './production-workflow-server.mjs';
import {previewEvidencePlugin} from './preview-evidence-server.mjs';
import {previewPlaybackPlugin} from './preview-playback-server.mjs';
import {supplementalUploadPlugin} from './supplemental-server.mjs';
import {episodeWorkflowPlugin} from './episode-workflow-server.mjs';
import {projectPlugin} from './project-server.mjs';
import {authoringOperationsPlugin} from './authoring-operations-server.mjs';
import {scenePlanPlugin} from './scene-plan-server.mjs';
import {psdArchivePlugin} from './psd-archive-server.mjs';
import {scriptPlanPlugin} from './script-plan-server.mjs';
import {createdScenesPlugin,getAudioJobs} from './created-scenes-server.mjs';
import {exportPlugin,getExportJobs} from './export-server.mjs';
import {libraryPlugin} from './library-server.mjs';
import {mediaMiddleware} from './static-files.mjs';
import {mediaRoot} from './project-store.mjs';
import {backupPlugin,getBackupOperations} from './backup-server.mjs';
import {wallQuadPlugin} from './wall-quad-server.mjs';
export function installEditorApi(middlewares,{audioGenerator}={}){
 middlewares.use(mediaMiddleware(mediaRoot));
 const adapter={middlewares};
 const captures=previewEvidencePlugin();
 for(const routes of [assemblyPlugin(),projectPlugin(),productionWorkflowPlugin(),previewPlaybackPlugin(),captures,supplementalUploadPlugin(),authoringOperationsPlugin(),scenePlanPlugin(),psdArchivePlugin(),scriptPlanPlugin(),createdScenesPlugin({generate:audioGenerator}),episodeWorkflowPlugin(),exportPlugin(),libraryPlugin(),backupPlugin(),wallQuadPlugin()])routes.configureServer(adapter);
 const audio=getAudioJobs(),exports=getExportJobs();
 const backups=getBackupOperations();
 return {shutdown:async options=>{const results=await Promise.allSettled([audio.shutdown(options),exports.shutdown(options),backups.shutdown(),captures.shutdown()]);const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;}};
}
