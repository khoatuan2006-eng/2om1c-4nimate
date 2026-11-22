# Critical Rules — Always Loaded

> 20 rules that apply to EVERY action inside `motion_intro/`. For specialized checklists, load the relevant skill.

## Workflow (SGP-1)

1. **One active scene at a time.** Check `episode.json → workflow.activeScene` before any work.
2. **Sequential prefix.** Approved scenes form a contiguous prefix from S01. Never skip.
3. **User approval is separate from technical approval.** `review-ready` ≠ `approved`.
4. **Never render master while any scene is `redo-required`.**
5. **Changes to an approved scene invalidate it** — but only if the scene's own render/inputs changed; a later-scene-only edit preserves the locked prefix.

## Scoring (QG-2)

6. **Judge the rendered video only.** Never score code, JSON, plans, or intent.
7. **Default ceiling is 7.9** until evidence supports 8+.
8. **Every defect lowers its related category.** Technical QC cannot compensate for weak direction.
9. **Both craft + red-team must pass** with zero open defects before `review-ready`.
10. **Evidence required:** playable render + 2fps shot boards + dense transition frames + FFprobe QC.

## Visual

11. **True 2.5D requires ≥4 visible depth planes** (far, mid, subject, near) + separate contact shadow layer.
12. **Every visible character needs grounding** — foot/seat/body anchor + contact shadow.
13. **No slideshow.** Every shot must change information, emotion, power, or spatial relationship.
14. **No center-zoom.** Camera reframe needs a `frameAnchor`, not just canvas-center scale.

## Sound

15. **Per-scene stem mix** — narration, music, ambience, SFX as separate stems.
16. **Target: -16 LUFS, ≤-1.5 dBTP.** Narration must be clear on phone speakers.
17. **Narration preroll ≥18 frames, tail ≥30 frames** (unless hard-cut waiver in direction.md).

## Process

18. **direction.md is the creative source of truth.** Change direction first, then code.
19. **Use `scaffold-scene.mjs` for new scenes.** Fill TODO fields instead of writing JSON from scratch.
20. **Run `series:validate` before any render.** Validation must pass.

## When you need more detail

- Camera/framing rules → load skill `create-scene`
- QG-2 defect codes and caps → load skill `review-scene`
- Audio mix details → read `series-bible.md §13`
- Asset generation rules → read `series-bible.md §4.2`
