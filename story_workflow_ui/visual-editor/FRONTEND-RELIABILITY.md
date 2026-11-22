# Studio reliability and local authentication

The existing Studio runtime, SQLite project store, catalog and compositions remain authoritative.

## Checks

From `D:/Doyin/story_workflow_ui`:

```powershell
node node_modules/typescript/bin/tsc -p visual-editor/tsconfig.json
npm.cmd run video:edit:test
npx.cmd playwright install chromium
npm.cmd run video:edit:e2e
```

The suite contains 13 E2E cases and 2 browser component cases. The E2E suite builds the production frontend and opens it in Chromium against an isolated temporary SQLite store with generated test images. It covers scene reopening, playback, XY edits, save/reload, undo/redo, autosave, pose changes through prepare-media, canvas dragging, duplication/deletion/flipping, keyframes, direct motion, clip trimming, media-error recovery and login/logout. Two additional browser component checks exercise crash isolation, retry and scene reset. Tests never write production projects and never export video. Traces/screenshots on failure and JSON results are under `visual-editor/evidence/frontend-tests`.

## Authentication

Authentication is optional for existing local installations. To require a password, set `EDITOR_PASSWORD` before starting either the standalone launcher or Vite. The password must have at least 12 characters and at most 1024 UTF-8 bytes. For example, in PowerShell 7:

```powershell
$env:EDITOR_PASSWORD = Read-Host 'Mật khẩu Studio' -MaskInput
$env:EDITOR_NO_BROWSER = '1'
node visual-editor/launch-editor.mjs
```

Restart the runtime to apply a password change; all sessions are revoked on restart. Do not put real passwords into source files or command-line arguments. Clear the variable after stopping with `Remove-Item Env:EDITOR_PASSWORD` if desired.

With authentication enabled, HTML navigation goes to `/auth/login`; all project APIs, frontend files and media require a session. Login issues an eight-hour HttpOnly SameSite=Strict cookie. Logout and password changes invalidate sessions. Login requires a same-origin POST and repeated wrong attempts trigger a one-minute cooldown. The launcher can authenticate its health probe, but that probe credential cannot authorize project/media requests. The UI provides logout and a link to sign in again without closing the current tab when a session expires.

The runtime still binds to `127.0.0.1`. This is single-user local authentication; multi-user permissions, public hosting and TLS deployment require a separate deployment design.

## Frontend structure

`useTransport` owns playback state, listener cleanup and bounded seeking. A typed TransportContext supplies TransportControls. `useSelection` owns the registry, selection and canvas visibility/bounds. `useDragDrop` owns canvas gesture handling; `useTimeline` owns clip move/trim behavior. `useWorkspacePanels` owns panel/dialog visibility. App retains project persistence, conflict handling and workflow orchestration.

Player's own error fallback and the Inspector boundary offer independent retry. Scene changes reset failed regions. The outer App boundary offers last-resort recovery; unsaved snapshots use the existing draft store. Boundaries catch React render errors, while async API failures continue through the existing request/error handling.
