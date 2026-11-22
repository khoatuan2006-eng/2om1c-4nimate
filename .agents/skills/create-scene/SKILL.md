---
name: create-scene
description: Step-by-step workflow for creating a new scene in the Kawasaki motion-comic series. Includes scaffolding, camera/framing checklists, and validation. Load this skill when adding or modifying scenes.
---

# Create Scene Workflow

## Step 1: Read the router and compile a minimal spec

Read `motion_intro/AGENT-INDEX.md`, the episode cursor and `EPISODE-INDEX.md`. Start from `series/episodes/_template/minimal-scene-spec.json`; author purpose, subjects, shot intent, focus target, screen direction and genuine exceptions.

Compile with:

Run the scaffolder to generate a skeleton scene:

```bash
node scripts/core/scaffold-scene.mjs --episode=series/episodes/<EP>/episode.json --scene=<SXX> --spec=<minimal-spec.json> --dry-run
```

Review the dry-run output, then remove `--dry-run` to write.

## Step 2: Review authored, derived and override fields

Do not manually duplicate derived metadata. Review compiler output and add an override only when direction requires an exception. The minimal spec owns title, purpose/visual intent, narration/subtitle, subjects, shot intent, focus target, screen direction, assets and continuity.

### Must fill (scene-level):
- `title` — internal label, never rendered
- `visualIntent` — 1-2 sentence visual goal
- `subtitle` — scene summary
- `subtitleCues[]` — timed to narration phrases
- `narrationText` — full narration text

### Must fill (per-shot):
- `focusTarget` — what camera focuses on
- `blocking` — spatial arrangement description
- `purpose` — what new information this shot reveals
- `cropRule` — intentional crop points

### Must fill (production):
- `lighting.motivation` — why this light setup
- `grounding.groundPlane` — surface description
- `continuity[]` — links to previous scene
- `acceptanceCriteria[]` — 4+ testable criteria

### Optional override:
- `camera.motivation` — if different from default
- `shots[].movement` — if different from template
- `production.sound.ambience` — scene-specific atmosphere

## Step 3: Camera/Framing Checklist

Before manual pixel placement, run `assets:geometry-scene`, visually verify each new geometry sidecar once, then run `scene:solve-layout`. New scenes author semantic slots rather than x/y. Use pixel values only as compiler output; intentional adjustments use semantic slot offsets with a reason.

Before committing shot data, verify against these rules:

### Shot declaration (all required):
- [ ] `subjectCount`: 0 | 1 | 2 | group
- [ ] `shotSize`: ECU/CU/MCU/MS/MLS/FS/WS/EWS/OTS/insert
- [ ] `cropRule`: intentional crop point (never at chin/wrist/elbow/knee/ankle)
- [ ] `composition`: rule-of-thirds / central / symmetry / diagonal / triangle
- [ ] `eyeLine`, `headroom`, `lookRoom`, `screenDirection`, `axis180`

### Framing by subject count:
| Count | Rule |
|-------|------|
| 1 portrait/CU | Eyes near upper 1/3, face is highest contrast, crop forehead/chin only for ECU |
| 1 medium | Keep hands if acting, negative space toward gaze direction |
| 1 full | Feet + ground plane visible, contact shadow, realistic headroom |
| 2 two-shot | Scale/distance/overlap shows relationship, maintain eyeline + 180° axis |
| OTS | Foreground shoulder/head creates depth, don't block subject expression |
| Group 3+ | Triangle or diagonal layout, clear hierarchy |

### Push-in/zoom contract:
- [ ] `frameAnchor` declared (NOT canvas center)
- [ ] `startCoverage` and `endCoverage` declared
- [ ] `maxScaleChange` ≤ 12% (default), split shot if more needed
- [ ] Headroom 6-10%, eye line at 35-40% height
- [ ] `torso-up` default: keep head + shoulders + chest/waist
- [ ] No body parts with narrative meaning cropped out

### Lens guide:
| Lens | Use for | Avoid |
|------|---------|-------|
| 24-35mm | Establishing, disaster, space dominates | Close-up faces |
| 50mm | Dialogue, neutral observation | - |
| 65-85mm | Reaction, power, detail, compression | Wide establishing |

## Step 4: Validate

```bash
npm run series:validate
```

Fix any errors. Common issues:
- Shots not contiguous (gaps or overlaps in fromFrame/toFrame)
- Performance beats not covering full duration
- Missing grounding placement for visible character
- Missing objectPurpose for visible asset

## Step 5: Preview Studio and preview-lock

Inspect the active composition in Remotion Preview Studio. Create and complete a preflight manifest, then run `scene:preview-lock`. Do not native-render while any episode scene remains preview-unlocked.

Use the `KawasakiScenePreview` composition for daily work and run `scene:work` for the next deterministic action. Critical snapshots are content-addressed per frame; preserve cache hits and render only misses.

With explicit diagnostic authorization, run `scene:preview-inspect` to create critical-frame snapshots/contact sheet. Run `scene:subtitle-guard` and resolve every `needs-direction` collision before preview-lock. Diagnostic stills do not replace full-speed playback.

After every scene is preview-locked, explicit current-conversation user authorization may open `render:native-batch`. Native output remains scene-local.

## Step 6: Review

Load the `review-scene` skill for QG-2 review workflow.
