# Workflow scope in story_workflow_ui

For story authoring/rebuilding in visual-editor Studio, use `../.agents/skills/studio-storytelling/SKILL.md` via the video-system resume entry. Register and inspect a causal story chain before expanding; layer/source coverage is not a storytelling review. Do not export unless the user explicitly requests export.

For visual-editor/Studio work, use `../video-system/RESUME.md`, the selected project profile and editor SQLite API. The simple-scene handoff and database below do not own visual-editor projects. Native rules remain scoped by root AGENTS.md.

## Continuing simple-scene work across chats

For `simple-scene` series work, begin with:
`node simple-scene/episode-handoff-cli.mjs read --series=<series-id> --episode=<episode-id>`
Run from `D:/Doyin/story_workflow_ui`. Report series revision and active scene before changes. Read this fresh SQLite-derived handoff rather than replaying old demo scripts or editing JSON exports. Read targeted scene/context through the series service as needed.

Use the handoff `rules`, `imagePolicy`, open defects and next action. User-approved direction persists, but native render authorization must be checked in the current conversation. Evidence whose `current` is false is historical, not approval. A changed image/reference hash invalidates its review.

Update handoff through `episode-handoff-cli.mjs patch --series=... --episode=... --revision=... --version=... --file=<patch-json>` after each workflow step and before long work. The version is the handoffVersion returned by read. Use absolute workspace paths for image records and evidence. Record model-generated/edited assets with prior resource search evidence, exact prompt, actual model/tool identity, reference files and hashes, purpose, and visual-review status. Do not label a pending result as pass. Read the imagegen skill before creating/editing bitmap assets; prefer original local resources and minimal edits, without overuse.

`data/series/work.sqlite` is authoritative. `data/series/<id>/handoff/<episode>/` contains derived exports, never an independently editable database. Native renders/QG-2 for motion_intro still follow the root AGENTS.md.
