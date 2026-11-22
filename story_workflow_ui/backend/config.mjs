import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const appRoot = resolve(dirname(fileURLToPath(import.meta.url)));
export const workspaceRoot = resolve(process.env.WORKSPACE_ROOT ?? resolve(appRoot, '../..'));
export const assetRoot = resolve(process.env.ASSET_ROOT ?? join(workspaceRoot, 'assets'));
export const ossRoot = process.env.OSS_ROOT ? resolve(process.env.OSS_ROOT) : '';
export const psdBridgePath = join(assetRoot, 'psd_bridge.py');
export const stateRoot = resolve(process.env.ORBIT_STATE_ROOT ?? join(appRoot, 'data'));
export const statePath = join(stateRoot, 'orchestrator-state.json');
export const artifactRoot = join(stateRoot, 'artifacts');
export const sourceRoot = join(stateRoot, 'sources');
export const assetRegistryPath = join(stateRoot, 'asset-registry.json');
export const assetLibraryRoot = resolve(process.env.ASSET_LIBRARY_ROOT ?? join(assetRoot, 'library'));
export const assetSourceRoots = [
  assetRoot,
  workspaceRoot,
  ...(ossRoot ? [ossRoot] : []),
  ...(process.env.EXTRA_ASSET_SOURCE_ROOT ? [resolve(process.env.EXTRA_ASSET_SOURCE_ROOT)] : []),
];
export const keysFilePath = resolve(process.env.KEYS_FILE_PATH ?? join(appRoot, '..', 'keys.txt'));
export const publicRoot = resolve(process.env.ORBIT_PUBLIC_ROOT ?? join(appRoot, '..', 'public'));

export const port = Number(process.env.ORCHESTRATOR_PORT ?? 4788);
export const testMode = process.env.ORBIT_TEST_MODE === '1';
export const motionRoot = resolve(process.env.MOTION_ROOT ?? join(workspaceRoot, 'motion_intro'));
export const remotionPreviewUrl = process.env.REMOTION_PREVIEW_URL ?? 'http://127.0.0.1:3005/GeneratedProductionScene';

export const GEMINI_TIMEOUT_MS = 45000;
export const LOCAL_ASSET_TIMEOUT_MS = 45000;
export const PSD_BRIDGE_TIMEOUT_MS = 120000;
