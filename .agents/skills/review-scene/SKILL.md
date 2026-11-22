---
name: review-scene
description: QG-2 quality review workflow with defect codes, score caps, and evidence requirements. Load this skill when reviewing a rendered scene for technical approval or scoring.
---

# Review Scene Workflow (QG-2)

## Prerequisites

Before reviewing, verify:
- [ ] Scene has been rendered at native 1920×1080/30fps
- [ ] Scene-local audio mix exists (per-scene stems)
- [ ] 2fps shot boards generated
- [ ] Dense transition evidence around pose changes
- [ ] FFprobe QC log exists

## Step 1: Full Playback Review

Watch the rendered scene at full speed. Note:
- Overall story clarity without subtitles
- Visible defects (ghosting, pops, floating, dead holds)
- Audio clarity on simulated phone speaker
- Transition smoothness at scene boundaries

## Step 2: Craft Review Pass

Review each rubric category against the render:

### 10 Rubric Categories

| # | Category | What to check |
|---|----------|--------------|
| 1 | narrativePurpose | Does the scene advance story? Is every visible object justified? |
| 2 | composition | Rule of thirds? Visual hierarchy? Safe area? |
| 3 | cameraLanguage | Lens matches intent? Motivated movement? Framing rules met? |
| 4 | characterPerformance | Performance beats readable? Anticipation→reaction chain? No dead holds? |
| 5 | depth25d | ≥4 depth planes visible? Independent parallax? Not stage-as-one-card? |
| 6 | styleFidelity | Consistent style system? No visible style mismatch between assets? |
| 7 | lightingColor | Environment tint on character? Contact shadow present? Grade consistent? |
| 8 | editRhythm | Each shot provides new info? Transitions motivated? Pacing matches narration? |
| 9 | soundDesign | Narration clear? Ambience establishes space? Music ducks for speech? |
| 10 | technicalQc | No black frames? No missing media? Correct codec/resolution/fps? |

### Scoring anchors

| Score | Meaning |
|------:|---------|
| 5 | Functional but visibly rough |
| 6 | Amateur with recurring visible weaknesses |
| 7 | Solid but one material weakness prevents professional delivery |
| **8** | **Professional-ready: no visible material defect at normal playback** |
| 9 | Exceptional with reference-worthy execution |
| 10 | Rare benchmark (requires comparative evidence) |

**Default ceiling: 7.9** until you write specific evidence supporting 8+.

## Step 3: Defect Detection

Check for these defect codes. If found AND visible in the render, apply the mandatory score cap:

### Defect Code Quick Reference

| Code | Look for | Caps |
|------|----------|------|
| `POSE_GHOST_OR_POP` | Ghost image or abrupt pose swap | performance ≤5.9, rhythm ≤6.9 |
| `SWAP_SLOT_DRIFT` | Character jumps position/size during swap | performance ≤6.4, composition ≤6.7 |
| `STYLE_MISMATCH` | Assets from incompatible style systems | style ≤5.9, composition ≤6.9 |
| `ASSET_INTEGRATION` | Subject floats, lighting doesn't match env | style ≤6.9, lighting ≤6.9 |
| `FLOATING_SUBJECT` | Not attached to ground, no contact shadow | composition ≤5.9, style ≤5.9, depth ≤5.9 |
| `FAKE_25D_STAGE_ONLY` | Whole stage moves as one card | depth ≤6.4, camera ≤6.8 |
| `DEAD_HOLD` | Static hold >1.5s without purpose | performance ≤6.5, rhythm ≤6.5 |
| `WEAK_CHARACTER_MOTION` | Beat reads but character is static | performance ≤6.9 |
| `REACTION_MISSING` | No anticipation/reaction chain | performance ≤6.9, narrative ≤7.4 |
| `REPEATED_FRAMING` | >2 consecutive similar framings | camera ≤6.9, rhythm ≤6.9 |
| `TEXT_COLLISION` | Text overlaps face/action or unreadable | composition ≤6.9, tech ≤7.4 |
| `PURPOSELESS_OBJECT` | Visible object with no function | narrative ≤6.9, composition ≤6.9 |
| `NAMED_ENTITY_MISMATCH` | Wrong character/symbol for a name | narrative ≤6.9, style ≤6.9 |
| `CAMERA_GRAMMAR_ERROR` | Shot size/crop/eyeline contradicts declaration | camera ≤6.9, composition ≤6.9 |
| `OPPRESSIVE_CENTER_ZOOM` | Center-scale zoom, subject too large | camera ≤6.7, composition ≤6.7 |
| `AUDIO_UNDERDESIGNED` | No ambience/foley for visible beats | sound ≤6.9 |
| `AUDIO_TECHNICAL` | Clipping, unintelligible, wrong sync | sound ≤5.9, tech ≤6.9 |
| `AUDIO_BLOB_MIX` | No scene-local preroll/tail, blob mix | sound ≤6.4, rhythm ≤6.9 |
| `MISSING_OR_BLACK_MEDIA` | Black frame or missing media | tech ≤4.9, composition ≤4.9 |

## Step 4: Red-Team Review Pass

For every category scored ≥8, write the **strongest argument against** that score. If the argument holds, lower the score.

## Step 5: Write Results

Update `episode.json → scene.qualityGate`:
- Set scores per category (respecting defect caps)
- Calculate `overallScore` as arithmetic mean
- Write evidence paths, redo notes, defect list
- Set both review passes verdict
- Set `fullPlaybackReviewed: true`

### Thresholds for passing:
- Every category ≥ 8.0
- Overall ≥ 8.2
- Both craft + red-team pass
- Zero open defects

If passing → set `qualityGate.status = 'review-ready'` and `workflow.status = 'technical-approved'`.

If failing → keep `qualityGate.status = 'redo-required'`, increment iteration, write actionable redo notes.

## Step 6: User Approval (SGP-1)

After technical approval, run:
```bash
npm run scene:approve-user -- \
  --episode=series/episodes/<EP>/episode.json \
  --scene=<SXX> \
  --preview=<path-to-preview.mp4> \
  --approved-by=<user> \
  --note="<approval note>" \
  --user-confirmed=yes
```

**Only the user can approve.** Agent cannot self-promote to `approved-by-user`.
