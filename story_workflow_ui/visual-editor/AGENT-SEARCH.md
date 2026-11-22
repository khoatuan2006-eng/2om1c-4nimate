# Context + retrieval + vision for asset discovery

The editor sends scene, frame, shot, selected object and visible object labels with the search. The server reads only the matching scene-data excerpt. Scene edits are not modified.

Workflow (bounded, not a general autonomous agent):
1. Gemini plans intent, named entity, required appearance traits, precise Chinese queries and alternative concrete queries.
2. Retrieve local catalog + remembered visual descriptions, and external asset provider metadata (configured via optional local ignored adapter). This is lightweight lexical RAG with LLM query expansion; it does not use embeddings or a vector database.
3. Load up to 8 candidate images and up to 2 current scene asset references. Gemini Vision evaluates pixels, using scene references for style. A missing/failed image or invalid assessment gets no score.
4. Compute weighted suitability: appearance 60%, style 20%, scene 20%. Unrelated capped 39%; named-character approximation capped 59%; named-character missing traits capped 69%. This heuristic is not a calibrated probability or a video quality score.
5. If no 70+ candidate, perform at most one additional search and evaluate up to 4 new candidates. User chooses; no automatic extraction or scene insertion.

Persistence: local `search-memory/visual-index.json` stores bounded captions for later retrieval. Cached assessments are keyed by query, context, plan and image content hashes. Server-only keys use existing Gemini configuration. Candidate download origins are validated by the local discovery provider adapter; local image reads are registered catalog IDs.

Limitations: observes individual scene resource images, not a screenshot of the fully composited live frame; it does not analyze playback or render quality. Asset identity/style judgments can be wrong and need user review. Caption retrieval is lexical; no feedback-learning/embedding index yet. Costs/latency include planner plus batch vision, sometimes a second vision call. External API failure is reported without invented scores.

Research references:
- https://www.anthropic.com/engineering/building-effective-agents
- https://www.anthropic.com/engineering/contextual-retrieval
- https://ai.google.dev/gemini-api/docs/image-understanding
- https://ai.google.dev/gemini-api/docs/structured-output

Live evidence: local `evidence/zoro-agent-search.json` (gitignored) recorded a live Gemini + Vision response matching target character traits with heuristic scores that remain model-specific rather than a guarantee of correctness.
