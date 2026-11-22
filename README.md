# 2om1c 4nimate

Reusable **motion-comic authoring studio & declarative animation engine** (Studio 3022) powered by React, Remotion, Vite, SQLite FTS5 indexing, and AI-assisted storytelling workflows.

## Key Capabilities

- **Declarative Scene Plan & Compiler** (`story_workflow_ui/visual-editor/scene-plan.mjs`): Author multi-cut storytelling beats (`beat.cuts[]`) with verbatim quote-synced speech bubbles, camera angles (`ots`, `reverse`, `hero-low`, `dutch-left/right`), depth/parallax layers, and character/prop motion presets.
- **Modular Motion-Comic FX & CapCut-Style Memory Filters** (`story_workflow_ui/visual-editor/ComicFxOverlays.tsx`, `fx-presets.mjs`): Composable CSS/SVG overlays for warm & cold nostalgic flashback grading, old-film grain/scratches, speech bubbles, emotes, silhouettes, spotlights, atmospheric particles, and kinetic speed lines.
- **Visual Studio 3022 Editor** (`story_workflow_ui/visual-editor/App.tsx`): Interactive timeline, keyframe inspection, asset/pose/face picker, and Remotion preview composition.
- **Lossless Remotion Export Pipeline** (`export-server.mjs`, `export-worker.mjs`): Browser-direct and scoped headless MP4 export with audio muxing and frame/duration verification.
- **On-Demand PSD Archive Indexer & Extractor** (`psd-archive.mjs`, `scripts/extract-one-psd.py`): FTS5 search, thumbnail caching, and lazy extraction of layered character/prop/background PSDs.
- **MCP Studio Bridge** (`studio-mcp.mjs`): Tooling interface for agent-driven scene inspection, catalog search, and plan synchronization.

## Setup

1. Install dependencies in both `motion_intro` (Remotion + Babel core) and `story_workflow_ui`:
   ```bash
   cd motion_intro && npm install
   cd ../story_workflow_ui && npm install
   ```
2. Provide your own local asset library / PSD archive paths via environment variables (`EDITOR_LIBRARY_DIR`, `EDITOR_IMPORTS_DIR`, `PSD_ARCHIVE_DIR`) or optional gitignored `*.local.*` adapters.
3. Run typecheck, unit tests, and launch Studio 3022:
   ```bash
   cd story_workflow_ui
   npm run video:edit:check
   node visual-editor/launch-editor.mjs
   ```

> **Note:** Private external asset providers (`*.local.*`), SQLite databases (`*.sqlite*`), credential files (`keys.txt`, `.env`), and media/episode materials are intentionally excluded via `.gitignore`.
