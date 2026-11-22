import type React from 'react';

export const legacySceneMeta: Record<string, { duration: number; shots: Array<{ from: number; to: number; label?: string }> }> = {};
export const legacyComponents: Record<string, React.ComponentType<any>> = {};
export const legacySavedEdits: Record<string, any> = {};
