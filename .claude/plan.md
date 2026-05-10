## Recommended Resources
9 recommendations total; 0 expensive; 0 hard reversibility; 0 Trivial; 4 Moderate; 5 Sensitive; 0 Forbidden (settings probe parsed; no MCP servers configured globally; role/pipeline-level changes not detected — none deferred to role-planner)

This feature requires four Rust crate dependencies (Moderate tier — `cargo add` mutates `Cargo.toml` + `Cargo.lock`) and five external model/library bundles downloaded by `install.sh` at install time (Sensitive tier — they cross an organizational trust boundary by reaching out to Hugging Face, GitHub Releases, and PaddleOCR CDNs and write into the `~/.claude/tools/sdlc-knowledge/` tree). The Sensitive bundles are intentionally **not** auto-installed by this resource-architect pass — they are integrated by Slice 11 of the implementation plan via `install.sh` / `install.ps1` changes following the existing `install_pdfium_binary` pattern, and the user runs `bash install.sh --yes` to fetch them after the feature merges. No MCP servers, no Cloud/Compute, no third-party SaaS, and no hardware are required.

### MCP
(none)

### Cloud/Compute
(none)

### External API
#### Hugging Face Hub — `intfloat/multilingual-e5-small` ONNX export
- **Category:** External API
- **Why:** FR-VR-4.1 mandates loading the e5-small ONNX model from `~/.claude/tools/sdlc-knowledge/models/e5-small/`. Slice 11 (`install_e5_model` per FR-VR-8.1) downloads the ONNX file + tokenizer.json + config.json from the model's Hugging Face repository. Provides the 384-dim multilingual embedding space backing FR-VR-4.2 prefix-disciplined `encode_passages` / `encode_query`, FR-VR-6.1 dense search, and FR-VR-6.2 hybrid RRF.
- **Install/activate:** Slice 11 adds `install_e5_model` to `install.sh` (Bash `curl` from `https://huggingface.co/intfloat/multilingual-e5-small/resolve/<commit-sha>/onnx/model.onnx` and matching `tokenizer.json` / `config.json`) and to `install.ps1` (PowerShell `Invoke-WebRequest`). Pin to a specific commit SHA + sha256 sidecar per the OQ-3 resolution pattern. User runs `bash install.sh --yes` to fetch (~120 MB).
- **Cost/complexity:** medium — one-time ~120 MB download, no recurring cost; pin-to-commit + sha256 verify protects against silent upstream rewrite.
- **Reversibility:** easy — `rm -rf ~/.claude/tools/sdlc-knowledge/models/e5-small/`; encoder gracefully degrades to BM25-only per FR-VR-4.4 / NFR-VR-8.
- **Tier:** Sensitive — crosses organizational trust boundary (Hugging Face account + bandwidth quota); supply-chain concern flagged by architect for Slice 11; `user must perform manually outside the SDLC pipeline` via `bash install.sh --yes`.

#### Hugging Face Hub — PaddleOCR PP-OCRv4 multilingual ONNX (det+rec)
- **Category:** External API
- **Why:** FR-VR-5.1 requires running the OCR model on `image_bytes` BLOBs to produce text for `type='image'` chunks per UC-VR-4 / UC-VR-EC-2. Architect verdict OQ-3 selected **PaddleOCR PP-OCRv4 (ml variant, det+rec ~30 MB)** pinned to a specific HuggingFace commit + sha256 sidecar.
- **Install/activate:** Slice 11 adds `install_paddleocr_models` to `install.sh` / `install.ps1`. Downloads `ml_PP-OCRv4_det_infer.onnx` and `ml_PP-OCRv4_rec_infer.onnx` to `~/.claude/tools/sdlc-knowledge/models/paddleocr/`. Pin to the specific HuggingFace mirror commit named in the architect verdict, with sha256 verification.
- **Cost/complexity:** low — ~30 MB, infrequent re-download; pin-to-commit guards against upstream rewrites.
- **Reversibility:** easy — `rm -rf ~/.claude/tools/sdlc-knowledge/models/paddleocr/`; image chunks gracefully fall back to placeholder text per FR-VR-5.5 / UC-VR-1-E2.
- **Tier:** Sensitive — supply-chain trust boundary; download from third-party CDN; `user must perform manually outside the SDLC pipeline` via `bash install.sh --yes`.

#### GitHub Releases — `microsoft/onnxruntime` dynamic library
- **Category:** External API
- **Why:** Architect verdict §[STRUCTURAL] action item: `ort = "2"` is used in **`load-dynamic` mode** (mirrors the existing pdfium pattern). The ONNX Runtime dynamic library (`libonnxruntime.dylib` / `.so` / `.dll`) is downloaded from the official `microsoft/onnxruntime` GitHub Releases asset by `install.sh` to `~/.claude/tools/sdlc-knowledge/onnxruntime/lib/`. Required for both the e5 encoder (Slice 5, FR-VR-4) and the OCR bridge (Slice 6, FR-VR-5).
- **Install/activate:** Slice 11 adds an `install_onnxruntime_dylib` step to `install.sh` / `install.ps1` modeled exactly on the existing `install_pdfium_binary` function. Pin to a specific ONNX Runtime release tag (e.g., `v1.20.0`) and verify the GitHub Release asset's sha256 against a checked-in sidecar.
- **Cost/complexity:** medium — ~50–80 MB asset; one-time download; release-tag pinning required to avoid binary ABI drift across `ort` minor versions.
- **Reversibility:** easy — `rm -rf ~/.claude/tools/sdlc-knowledge/onnxruntime/`; `Encoder::new` returns `Err`, ingest falls back to BM25-only per FR-VR-4.4.
- **Tier:** Sensitive — crosses organizational trust boundary (GitHub release artifact, tag-pinned but not cryptographically signed at the repo level); `user must perform manually outside the SDLC pipeline` via `bash install.sh --yes`.

#### Hugging Face Hub — `ds4sd/docling-models` ONNX artifacts (DEFERRED to v2)
- **Category:** External API
- **Why:** PRD FR-VR-1.1 originally planned Docling as the primary PDF backend with pdfium fallback. **Architect verdict OQ-1 resolution: Option (d) — Pragmatic v1 fallback. Slice 3 collapses to "structural chunker over pdfium output + image extraction from pdfium pages". Docling deferred to v2.** This entry is recorded for traceability — Slice 11 install scripts MUST NOT add an `install_docling_models` function in this feature; the `~/.claude/tools/sdlc-knowledge/models/docling/` directory referenced in FR-VR-8.1 / FR-VR-8.2 is **dropped** in light of the OQ-1 resolution.
- **Install/activate:** **No install in this feature.** When iter-2 resurrects Docling, Slice 11 will follow the same `install_<name>` pattern with a pinned HuggingFace commit + sha256 sidecar.
- **Cost/complexity:** n/a — deferred.
- **Reversibility:** n/a — never installed in this feature.
- **Tier:** Sensitive — recorded for OQ-1 audit trail; not actioned in this iteration; `user must perform manually outside the SDLC pipeline` if reactivated in v2.

### Third-party Service
(none)

### Library/Framework
#### `fastembed = "4"` — Rust embedding wrapper
- **Category:** Library/Framework
- **Why:** FR-VR-4.1 / FR-VR-4.2 / FR-VR-4.3 require encoding text with `intfloat/multilingual-e5-small`. Architect verdict §[STRUCTURAL] action item OQ-4: **`fastembed-rs = "4"`** with verified prefix-discipline test at the ONNX session boundary (`encoder_prefix_test.rs` per FR-VR-4.2 and AC-VR-16). Provides `TextEmbedding::try_new(InitOptions { model_name: EmbeddingModel::MultilingualE5Small, ... })` and `embed(documents, batch_size)` matching the FR-VR-4.3 batch_size=32 ingest path.
- **Install/activate:** suggest only — `cd tools/sdlc-knowledge && cargo add fastembed@4 --features ort-load-dynamic` (or equivalent feature gating per the architect's load-dynamic decision). Run during Slice 5 implementation; do NOT run from this agent.
- **Cost/complexity:** medium — pulls `ort` and `tokenizers` transitively; verify binary-size budget NFR-VR-1 (10 MB) at architect Slice 5 pre-review per Risk R9.
- **Reversibility:** easy — `cargo rm fastembed` and remove `encoder.rs` callers.
- **Tier:** Moderate — `cargo add` mutates `Cargo.toml` + `Cargo.lock`; per-item approval per the iter-2 Moderate-tier rules; the user must approve before Slice 5 starts.

#### `sqlite-vec = "0.1"` — vector virtual table for SQLite
- **Category:** Library/Framework
- **Why:** FR-VR-3.1 mandates `CREATE VIRTUAL TABLE chunks_vec USING vec0(embedding float[384])` in the same `index.db` file (NFR-VR-4 single-file invariant). Architect verdict §[STRUCTURAL] action item OQ-2 resolution: **`sqlite-vec = "0.1"` Rust crate via `sqlite_vec::load(&db)` helper. NOT bundled, NOT runtime `load_extension`. Cross-platform statics included.** Provides the `vec0` virtual table, `embedding float[384]` declaration, and `vec_distance_cosine(a, b)` distance function used by FR-VR-6.1 dense search and FR-VR-6.2 hybrid RRF.
- **Install/activate:** suggest only — `cd tools/sdlc-knowledge && cargo add sqlite-vec@0.1`. Run during Slice 2 implementation; do NOT run from this agent. Wire `sqlite_vec::load(&db)` immediately after each `Connection::open` per architect's OQ-2 resolution.
- **Cost/complexity:** low — small crate; cross-platform statics verified by architect; UC-VR-1-E4 covers extension-load-failure exit-1 path.
- **Reversibility:** easy — `cargo rm sqlite-vec`; revert `store.rs` to pre-Slice-2 state; v2 schema rolls back to v1.
- **Tier:** Moderate — `cargo add` mutates `Cargo.toml` + `Cargo.lock`; per-item approval required.

#### `ort = "2"` (load-dynamic feature) — Rust ONNX Runtime binding
- **Category:** Library/Framework
- **Why:** Architect verdict §[STRUCTURAL] action item: **`ort = "2"` in `load-dynamic` mode** (mirrors pdfium pattern). Required transitively by `fastembed = "4"` (FR-VR-4) and directly for the PaddleOCR bridge (FR-VR-5). The `load-dynamic` feature flag instructs `ort` to load `libonnxruntime.{dylib,so,dll}` at runtime from `~/.claude/tools/sdlc-knowledge/onnxruntime/lib/` instead of statically linking ~30 MB into the binary — the exact same defense used for pdfium that keeps the `claudeknows` binary under the NFR-VR-1 10 MB budget.
- **Install/activate:** suggest only — `cd tools/sdlc-knowledge && cargo add ort@2 --features load-dynamic --no-default-features` (or whichever feature combination Slice 5 architect pre-review confirms preserves the load-dynamic invariant). Run during Slice 5 implementation; do NOT run from this agent.
- **Cost/complexity:** medium — couples to the `microsoft/onnxruntime` dylib download (Sensitive External API entry above); architect Slice 5 pre-review validates binary-size budget per Risk R9.
- **Reversibility:** easy — `cargo rm ort`; OCR + encoder callers must be removed (cascades through Slice 5/6 reverts).
- **Tier:** Moderate — `cargo add` mutates `Cargo.toml` + `Cargo.lock`; per-item approval required.

#### `image = "0.25"` — PNG decoder for tests
- **Category:** Library/Framework
- **Why:** AC-VR-15 (`image_extraction_test.rs`) asserts that `image_bytes` decodes to a valid PNG via `image::load_from_memory`. Required as a `[dev-dependencies]` entry. Also needed by Slice 6 (`ocr.rs`) to decode the `image_bytes` BLOB before feeding raw pixel data to the OCR model. Used in fixtures `diagram-with-text.png` (FR-VR-5.4) and `sample-with-figure.pdf` round-trip tests.
- **Install/activate:** suggest only — `cd tools/sdlc-knowledge && cargo add image@0.25 --features png` (or `cargo add image@0.25 --dev --features png` if image decoding is only needed in tests; Slice 6 architect pre-review confirms scope). Run during Slice 4 (image extraction tests) implementation; do NOT run from this agent.
- **Cost/complexity:** low — widely-used Rust crate, MSRV-compatible, single-feature gate keeps compile time bounded.
- **Reversibility:** easy — `cargo rm image`.
- **Tier:** Moderate — `cargo add` mutates `Cargo.toml` + `Cargo.lock`; per-item approval required.

### Hardware
#### 2024 MacBook M1/M2 reference machine — latency benchmarks
- **Category:** Hardware
- **Why:** FR-VR-4.5 (encoder cold-start <3 s; hot-path batch of 32 chunks <50 ms), FR-VR-6.7 (hybrid p95 latency <500 ms over 30-query sequence on 51 K-chunk corpus), and NFR-VR-3 (full re-ingest of ~40 PDFs under 15 minutes on CPU) are all pinned to the **2024 MacBook M1** reference machine. UC-VR-EC-5 documents the wall-clock measurement. The user (developer running this feature) already has access to the reference machine — this is informational, not an acquisition recommendation.
- **Install/activate:** No action — the user runs the benchmarks on their existing M1/M2 MacBook during Slice 8 (operational re-ingest) and Slice 10 (benchmark report). If the reference machine is unavailable, the benchmark report records the actual hardware used and adjusts the budget claims accordingly.
- **Cost/complexity:** low — already owned; no acquisition.
- **Reversibility:** n/a — informational.
- **Tier:** Sensitive — informational hardware reference; `user must perform manually outside the SDLC pipeline` (the agent cannot install hardware). Not actioned by install mode.

## Auto-Install Results

Skipped: non-interactive context — auto-install requires user approval

## Additional Roles
0 additional roles total; 0 new prompt files written; 0 core-agent edits

No additional roles required.

## Role invocation plan
(no roles to invoke)

## Reuse Decisions
(no reuse decisions)

## Facts

### Verified facts

- Current `claudeknows` v0.3.1, BM25-only via SQLite FTS5, schema v1, ~4 MB binary — verified against `tools/sdlc-knowledge/Cargo.toml` (line 3) and `tools/sdlc-knowledge/src/store.rs` (`chunks_fts` virtual table at line 54) read this session.
- pdfium-render binding via explicit-path `Pdfium::bind_to_library` — verified at `tools/sdlc-knowledge/src/pdf.rs:172` read this session.
- 500-char sliding-window chunker is currently in `tools/sdlc-knowledge/src/ingest.rs:71` (function `chunk()`) — verified read this session.
- User's existing knowledge-base corpus: 28 documents, 51 542 chunks, multilingual RU+EN, scope = ML/AI + data engineering + SRE + software-engineering — verified by `claudeknows status --json` and `claudeknows list --json` invocations earlier in this session.
- We are currently on `main` branch; all feature work MUST happen on `feat/vector-retrieval-backend` per `~/.claude/rules/git.md`.
- `~/.claude/rules/knowledge-base-tool.md` contains the assertion "**NOT a vector database.** No embeddings, no semantic similarity. Queries match on lexical tokens." — MUST be updated by Slice 11.
- `docs/PRD.md` §11 reserved `embedding BLOB` column on chunks table for non-destructive iter-2 migration — this plan supersedes that reservation by introducing `chunks_vec` virtual table instead. PRD §15 (in /bootstrap-feature Step 1) MUST formally amend FR-4.3.
- `tools/sdlc-knowledge/src/migrations.rs` and `tools/sdlc-knowledge/src/store.rs` exist and are the natural insertion points for v1→v2 migration — verified by Glob this session.
- Architect verdict (PASS with 5 [STRUCTURAL] action items) received and applied: AI-1 (Docling→v2, Slice 3 collapses to parser bridge over pdfium); AI-2 (sqlite-vec pin + load helper); AI-3 (ort load-dynamic + install_onnxruntime_binary + ~250 MB footprint); AI-4 (prefix test mocked at ONNX session input boundary); AI-5 (sha256 sidecar + pinned commit hashes for all 3 model-install functions). All 5 applied in this refinement session.
- `.claude/resources-pending.md` inlined (9 recommendations) and deleted this session.
- `.claude/roles-pending.md` inlined (0 additional roles) and deleted this session.

### External contracts

- **`fastembed-rs` (Qdrant)** — symbol: `TextEmbedding::try_new(InitOptions { model_name: EmbeddingModel::MultilingualE5Small, ... })`, `embed(documents: Vec<&str>, batch_size: Option<usize>) -> Vec<Vec<f32>>` — source: https://github.com/Anush008/fastembed-rs (crates.io `fastembed = "4"`) — verified: **no — assumption**. Architect Slice 5 pre-review MUST verify e5-small is in fastembed's supported list and the API matches. Risk: if fastembed doesn't support e5-small directly, fall back to raw `ort`.
- **`sqlite-vec = "0.1"` Rust crate** — symbol: `sqlite_vec::load(&db)` helper; `vec0` virtual table; `embedding float[384]` column declaration; `vec_distance_cosine(a, b)` distance function; static cross-platform binaries. NOT using `rusqlite` bundled feature; NOT using `Connection::load_extension` — source: https://github.com/asg017/sqlite-vec — verified: **no — assumption**. Architect OQ-2 resolved in favour of this approach; Slice 2 architect pre-review confirms cross-platform static availability.
- **`ort = { version = "2", default-features = false, features = ["load-dynamic"] }`** — symbol: `ort::Session::builder().commit_from_file(path)`, `Session::run(inputs) -> Result<Outputs>`; `load-dynamic` feature loads `libonnxruntime.{dylib,so,dll}` at runtime via explicit path — source: https://docs.rs/ort/2 — verified: **no — assumption**. Mirrors pdfium dynamic-load pattern; Slice 5 architect pre-review validates feature-flag spelling.
- **Docling (IBM)** — DEFERRED to v2 per architect AI-1 (OQ-1 Option d). No Docling model artifacts installed in this feature. `models/docling/` directory dropped from Slice 11 install scripts.
- **PaddleOCR PP-OCRv4 ml ONNX (det+rec)** — symbols: `ml_PP-OCRv4_det_infer.onnx`, `ml_PP-OCRv4_rec_infer.onnx` (~30 MB combined) — source: https://github.com/PaddlePaddle/PaddleOCR (HuggingFace mirror) — verified: **no — assumption**. Exact HuggingFace commit + sha256 pinned by Slice 6 architect pre-review (AI-5).
- **`intfloat/multilingual-e5-small` model card** — symbol: `"passage: "` prefix for indexed passages, `"query: "` prefix for search queries; 384-dimensional output — source: https://huggingface.co/intfloat/multilingual-e5-small — verified: yes (documented on model card).
- **Reciprocal Rank Fusion (RRF) with k=60** — `score(d) = Σ_i 1/(k + rank_i(d))` — source: Cormack et al. 2009, SIGIR — verified: yes.
- **`microsoft/onnxruntime` dynamic library** — symbol: `libonnxruntime.dylib` / `libonnxruntime.so` / `onnxruntime.dll`; downloaded from GitHub Releases pinned to specific release tag (e.g., `v1.20.0`); sha256 verified before extraction — source: https://github.com/microsoft/onnxruntime/releases — verified: **no — assumption**. Exact tag + sha256 pinned by Slice 11 architect pre-review (AI-5).
- **`image` Rust crate v0.25** — symbol: `image::load_from_memory(bytes: &[u8]) -> ImageResult<DynamicImage>`; `png` feature flag; byte-budget gate enforced in Slice 6 (`load_from_memory` used with 50 MB decoded-pixel cap before feeding OCR) — source: https://docs.rs/image/0.25 — verified: **no — assumption**. Slice 4 architect pre-review re-verifies API at the BLOB-decode call site.

### Assumptions

- ONNX runtime via `ort` works on all target platforms (macOS arm64/x64, Linux x64/arm64, Windows x64). Risk: ARM Windows / FreeBSD not covered. Verify: build matrix in Slice 11 install scripts.
- 51K chunks at encode batch=32 on CPU (M1/M2 MacBook) takes ≤10 minutes for full re-ingest. Verify: time the user's actual re-ingest in Slice 8 and document.
- 25 manually-curated queries are sufficient to detect a meaningful difference. Verify: spot-check qualitative samples; expand to 50 if benchmark inconclusive.
- Image bytes as BLOB column adds tolerable storage overhead (a 50-page PDF with 20 figures × 200 KB each = ~4 MB BLOBs per doc; for 28 docs ~112 MB). Verify: measure DB file size growth in Slice 4.
- e5-small embedding quality is sufficient on technical-book content. Risk: bge-m3 (2 GB) might be measurably better. Verify: benchmark Slice 10 — if hybrid recall is unimpressive, iter-2 may swap encoder.
- Total install footprint ~250 MB (e5-small ~120 MB + PaddleOCR ~30 MB + ONNX runtime dylib ~50–80 MB). Verify: Slice 11 implementation measures actual `du -sh` after fresh install.

### Open questions

- **OQ-1 (Docling integration strategy)** — RESOLVED by architect AI-1: Option (d) pragmatic v1 fallback. Slice 3 is "parser bridge over pdfium output + image extraction". Docling deferred to v2. No further action.
- **OQ-2 (sqlite-vec linking)** — RESOLVED by architect AI-2: `sqlite-vec = "0.1"` Rust crate via `sqlite_vec::load(&db)` helper. NOT bundled, NOT runtime `load_extension`. No further action.
- **OQ-3 (PaddleOCR vs alternatives)** — RESOLVED: PaddleOCR PP-OCRv4 ml det+rec. Exact commit + sha256 pinned by Slice 6 architect pre-review (AI-5).
- **OQ-4 (per-language stratification in benchmark)** — RESOLVED OUT-OF-SCOPE: overall metrics + qualitative side-by-side only.

## Prerequisites verified

- PRD section: `docs/PRD.md` §15 — Vector + Multimodal Retrieval Backend
- Use cases: `docs/use-cases/vector-retrieval-backend_use_cases.md` — 31 scenarios
- QA test cases: `docs/qa/vector-retrieval-backend_test_cases.md` — 52 test cases
- Architecture review: PASS (with 5 [STRUCTURAL] action items; all applied in this refinement)

# Plan: Vector + Multimodal Retrieval Backend for `claudeknows`

## Context

**Problem.** The current `claudeknows` retrieval (shipped 0.3.x) is BM25-only via SQLite FTS5 with naïve 500-char sliding-window chunking and pdfium-text-only PDF extraction. Three concrete limitations the user is hitting on the existing 51K-chunk corpus:

1. **No cross-lingual recall.** A Russian query never matches an English chunk that covers the same concept (FTS5 `unicode61` tokenizer is purely lexical).
2. **No layout / image awareness.** Tables flatten poorly, figures are dropped entirely, headings don't influence chunking — retrieval misses content BM25 can never see.
3. **No semantic recall.** Paraphrases ("how do I authenticate" vs "JWT validation") don't match.

**Goal.** Replace the BM25-only backend with a hybrid lexical+dense retrieval layer (BM25 ⊕ dense via RRF k=60), structurally-aware document parsing via a pdfium-based parser bridge, and OCR-based multimodal embeddings so figures from PDFs are searchable through unified cosine similarity in the SAME 384-dim e5-multilingual embedding space as text and tables. Ship a benchmark harness that quantifies the difference.

**Outcome.** A user runs `claudeknows search "<query>"` and gets a hybrid ranked list including text, table, and image chunks. The repo contains a Markdown benchmark report at `tools/sdlc-knowledge/bench/reports/2026-05-09-vector-vs-bm25.md` with concrete metrics (Recall@K, MRR, NDCG@10, latency) plus side-by-side qualitative samples for ~10 representative queries.

**This change inverts the iter-1 architectural assertion** in `~/.claude/rules/knowledge-base-tool.md`: "**NOT a vector database.** No embeddings, no semantic similarity." That was correct for iter-1; it is no longer correct for iter-2. The rule files MUST be updated as part of this feature (Slice 11). The PRD's reserved `embedding BLOB` column strategy (FR-4.3) is also superseded — we use a separate `chunks_vec` virtual table from sqlite-vec instead, formally amending FR-4.3 in the new PRD §15.

**Pre-implementation precondition.** This plan begins on a NEW feature branch `feat/vector-retrieval-backend` (currently we're on `main` per Plan Critic finding #1). The plan body itself is auto-persisted to `<project>/.claude/plan.md` per the rule shipped in 0.3.1.

**Plan persistence destinations (post-ExitPlanMode).** Per the user's request to extract the plan into a separate MD file — and because the plan-mode harness allows edits ONLY to `~/.claude/plans/fuzzy-juggling-ocean.md` — the plan body lives in two places after ExitPlanMode:
- `<project>/.claude/plan.md` — canonical project-local plan-mode artifact (auto-persist rule from 0.3.1; gets overwritten by the next plan-mode session).
- `<project>/docs/design/vector-retrieval-backend.md` — durable, version-controlled design document committed alongside the feature work; survives future plan-mode sessions.

Both writes happen as the FIRST action immediately after ExitPlanMode is approved (during normal-mode preamble before `/bootstrap-feature` Step 1).

**Vectorization corpus location.** The user has placed ~40 PDFs at `/Users/aleksandra/Documents/claude-code-sdlc/books/` (verified by `ls` this session — covers ML/AI, data engineering, AI agents, system design, MLOps, RU+EN). This is the corpus used for:
- Slice 8 re-ingest (populates v2 schema with embeddings + image BLOBs from these books).
- Slice 9 benchmark golden-set query authoring (queries reference content from these specific books — guarantees we know which chunks should be relevant).
- Slice 10 benchmark run (same corpus all three modes index).

The books folder is **not committed to the repo** (it's a local dev resource). The benchmark report references books by basename only; chunk references are by chunk_id.

## Locked technical decisions

1. **Text encoder**: `intfloat/multilingual-e5-small` (ONNX, 384 dims, ~120 MB) loaded via `fastembed-rs`. e5 prefix discipline (`"passage: "` for ingest, `"query: "` for search) MUST be enforced and tested.
2. **Hybrid retrieval**: BM25 (FTS5 — kept) + dense (sqlite-vec) via Reciprocal Rank Fusion with k=60. Search modes: `--mode lexical|dense|hybrid`, default = `hybrid`.
3. **Document parser (AI-1 applied)**: `src/parser.rs` — structural Markdown over pdfium output (heading detection over plain text) + image extraction from pdfium pages via `pdf::extract_images()`. Docling deferred to v2.
4. **Multimodal — OCR-as-text bridge**: pdfium extracts figures from PDFs as PNG bytes via `pdf::extract_images()`; PaddleOCR-ONNX (RU+EN, ~30 MB det+rec) reads text from each figure; OCR'd text is embedded into the SAME e5 space as text chunks. A single 384-dim space holds text, table, and image content with unified cosine similarity. Pure-vision CLIP-space embeddings are explicitly OUT OF SCOPE for v1 — would require a parallel index in a different space.
5. **Vector storage**: `sqlite-vec = "0.1"` Rust crate via `sqlite_vec::load(&db)` helper — co-exists with FTS5 in the SAME `index.db` — single-file invariant (NFR-1.5) preserved. New virtual table `chunks_vec(embedding float[384])`. Schema bumped v1 → v2.
6. **Image storage**: figure PNG bytes stored as `chunks.image_bytes BLOB` column (NULLable, populated only for `chunks.type='image'`). Preserves NFR-1.5 — no co-located figure files outside `index.db`.
7. **Bundle strategy (AI-3 applied)**: model files live under `~/.claude/tools/sdlc-knowledge/models/{e5-small,paddleocr}/` and ONNX runtime dylib under `~/.claude/tools/sdlc-knowledge/onnxruntime/lib/`. Downloaded by `install.sh` / `install.ps1` (three functions: `install_e5_model`, `install_paddleocr_models`, `install_onnxruntime_binary`). Total install footprint ~250 MB (models + dylib). Binary itself stays under 10 MB via `ort = { version = "2", default-features = false, features = ["load-dynamic"] }`.
8. **Zero Python deps**: all ML inference goes through `ort` (Rust ONNX runtime) in `load-dynamic` mode.
9. **Backward compat**: existing v1 indexes prompt user to re-ingest on first v2 binary invocation; `CLAUDEKNOWS_AUTO_REINGEST=1` skips prompt for headless. Corrupt v1 DB (truncated) follows the existing `error: index database invalid; re-ingest required` exit-1 contract from iter-1 AC-7.

## Pre-implementation: documentation phase

**This plan is the planner agent's Step 5 output and runs AFTER the documentation phase.** Phase 1 of `/bootstrap-feature` produces:

- `docs/PRD.md §15` (prd-writer) — MUST formally amend FR-4.3 (separate vec table instead of inline BLOB column) and clarify NFR-1.5 (image bytes stored as BLOB inside index.db preserve single-file invariant).
- `docs/use-cases/vector-retrieval-backend_use_cases.md` (ba-analyst).
- Architecture review (architect) — verifies parser integration strategy (AI-1 resolved: pdfium-based parser bridge), sqlite-vec linking (AI-2 resolved), RRF correctness, OCR quality threshold, NFR-1.5 BLOB-storage resolution, FR-4.3 amendment text.
- `docs/qa/vector-retrieval-backend_test_cases.md` (qa-planner).
- `.claude/resources-pending.md` (resource-architect — inlined and deleted this session).
- `.claude/roles-pending.md` (role-planner — inlined and deleted this session; 0 additional roles).

**Deliverables checklist:**
- [x] PRD §15 in `docs/PRD.md`
- [x] Use cases in `docs/use-cases/vector-retrieval-backend_use_cases.md`
- [x] Architecture review verdict (PASS with 5 [STRUCTURAL] action items applied)
- [x] QA test cases in `docs/qa/vector-retrieval-backend_test_cases.md`

## Implementation slices (11 slices / 8 waves)

### Slice 1: Heading-aware structural chunker
- **Wave**: 1
- **Use cases**: UC-VR-1, UC-VR-2, UC-VR-CC-1
- **Files**: `tools/sdlc-knowledge/src/chunker.rs` [new], `tools/sdlc-knowledge/src/ingest.rs`, `tools/sdlc-knowledge/tests/chunker_test.rs` [new], `tools/sdlc-knowledge/tests/fixtures/sample-with-headings.md` [new], `tools/sdlc-knowledge/tests/fixtures/sample-no-headings.md` [new]
- **Changes**: new `chunker::structural_chunk()`: parse Markdown / plain-text for `^#{1,6}\s+` heading patterns and "Chapter/Section N" markers; chunk on heading boundaries with soft-cap 1500 chars and 200-char overlap. Backward-compat fallback: when no headings detected, falls back to current 500-char sliding-window output (existing fixtures unchanged). Existing `ingest::chunk()` at src/ingest.rs:71 replaced with thin call to `chunker::structural_chunk()`.
- **Verify**: `cargo test -p sdlc-knowledge --test chunker_test` passes. Fixture `sample-with-headings.md` (3 headings) yields exactly 3 chunks each starting with the heading line; `sample-no-headings.md` yields the same chunk count as the iter-1 baseline (regression-tested against `ingest_test.rs`).
- **Done when**: `cargo test -p sdlc-knowledge --test chunker_test` exits 0; fixture `sample-with-headings.md` (3 headings) yields exactly 3 chunks each starting with its heading line; `sample-no-headings.md` chunk count equals iter-1 baseline.
- **Pre-review**: none

### Slice 2: sqlite-vec extension + schema v1→v2 + image BLOB column
- **Wave**: 1
- **Use cases**: UC-VR-1, UC-VR-CC-2, UC-VR-EC-4
- **Files**: `tools/sdlc-knowledge/Cargo.toml`, `tools/sdlc-knowledge/src/store.rs`, `tools/sdlc-knowledge/src/migrations.rs`, `tools/sdlc-knowledge/tests/store_v2_test.rs` [new], `tools/sdlc-knowledge/tests/migration_test.rs` [new]
- **Changes**: Add `sqlite-vec = "0.1"` to `Cargo.toml`. Call `sqlite_vec::load(&db)` immediately after each `Connection::open` (NOT via `load_extension` — rusqlite `load_extension` feature stays OFF). New virtual table `CREATE VIRTUAL TABLE chunks_vec USING vec0(embedding float[384])`. New columns: `chunks.type TEXT NOT NULL DEFAULT 'text'` (values: 'text' | 'table' | 'image'), `chunks.image_bytes BLOB NULL`. schema_version 1→2. Migration UX: opening v1 with v2 binary detects version mismatch → if TTY, prompt "Re-ingest required for v2 schema. Proceed? [y/N]"; if `CLAUDEKNOWS_AUTO_REINGEST=1`, skip prompt; on "no", exit 0 with hint; on "yes" or env-var, drop+recreate, exit 0 with hint to re-run `ingest`. Corrupt v1 DB (truncated) honors iter-1 AC-7: exit 1 with `error: index database invalid; re-ingest required`.
- **Verify**: `cargo test --test store_v2_test --test migration_test` passes. `claudeknows status --json` on fresh DB shows `"schema_version": 2`. v1 fixture DB → migration prompt; `CLAUDEKNOWS_AUTO_REINGEST=1` runs migration; truncated v1 DB → exit 1 with literal AC-7 message.
- **Done when**: `cargo test --test store_v2_test --test migration_test` exits 0; `claudeknows status --json | jq '.schema_version'` returns `2`; `sqlite_vec::load(&db)` invoked at connection open; `vec0` virtual table coexists with `chunks_fts` without trigger conflicts; rusqlite `load_extension` feature stays OFF; migration tested for happy-path AND corrupt-DB AND headless paths.
- **Pre-review**: architect (OQ-2 — sqlite-vec linking strategy; RESOLVED — pre-review confirms `sqlite_vec::load` approach is correct)

### Slice 3: Parser bridge over pdfium + image extraction
- **Wave**: 2
- **Use cases**: UC-VR-1, UC-VR-4, UC-VR-CC-1
- **Files**: `tools/sdlc-knowledge/Cargo.toml`, `tools/sdlc-knowledge/src/parser.rs` [new], `tools/sdlc-knowledge/src/pdf.rs`, `tools/sdlc-knowledge/src/ingest.rs`, `tools/sdlc-knowledge/tests/parser_test.rs` [new], `tools/sdlc-knowledge/tests/fixtures/sample-structured.pdf` [new]
- **Changes (AI-1 applied — Docling replaced by pdfium parser bridge)**:
  - `src/pdf.rs`: extend with `pub fn extract_images(doc: &PdfDocument) -> Vec<(usize, Vec<u8>)>` returning `(page_idx, png_bytes)` pairs for each rendered page that contains figure elements; implement via pdfium's page-bitmap rendering.
  - `src/parser.rs` [new]: produces structural Markdown from pdfium output — heading detection over plain-text lines using heuristics (line-length, capitalization, leading `##` markers from FTF text objects); outputs Markdown string that feeds Slice 1's `structural_chunk()`. No Docling dependency; no Python.
  - `src/ingest.rs`: ingest path for PDFs now calls `parser::parse_pdf(path) -> (markdown_text, Vec<(page_idx, png_bytes)>)`; Markdown feeds `chunker::structural_chunk()`; `png_bytes` queue feeds Slice 4's image chunk insertion.
  - `tests/parser_test.rs` [new]: `sample-structured.pdf` ingest produces chunks with section heading paths; plain-text extraction fallback produces non-empty output.
- **Verify**: `cargo test --test parser_test` passes. `sample-structured.pdf` ingest produces ≥1 chunk whose text starts with a heading-level marker. `pdf::extract_images()` on a PDF with embedded figures returns ≥1 `(page_idx, png_bytes)` pair.
- **Done when**: `cargo test --test parser_test` exits 0; `pdf::extract_images()` returns at least 1 PNG for a multi-page fixture PDF; `parser::parse_pdf()` feeds pdfium plain-text through heading-detection and produces Markdown that Slice 1's structural chunker processes correctly.
- **Pre-review**: none (AI-1 resolved the CRITICAL architect pre-review; no further review needed for the pdfium-based approach)

### Slice 4: Image extraction → BLOB storage
- **Wave**: 3
- **Use cases**: UC-VR-4, UC-VR-EC-2
- **Files**: `tools/sdlc-knowledge/src/ingest.rs`, `tools/sdlc-knowledge/tests/image_extraction_test.rs` [new], `tools/sdlc-knowledge/tests/fixtures/sample-with-figure.pdf` [new]
- **Changes (AI-1 applied — image extraction now from pdfium directly via `pdf::extract_images()`, not Docling)**:
  - `src/ingest.rs`: consume the `Vec<(page_idx, png_bytes)>` queue produced by Slice 3's `parser::parse_pdf()`; for each entry, insert chunk row with `type='image'`, `text=''` (filled by OCR in Slice 6), `image_bytes=<PNG bytes>`. Apply byte-budget gate: skip images whose decoded size exceeds 50 MB (guard against PNG bomb DoS — see Slice 6 security note).
  - PNG roundtrip test in `image_extraction_test.rs` verifies BLOB integrity via `image::load_from_memory`.
- **Verify**: `cargo test --test image_extraction_test` passes. `sample-with-figure.pdf` after ingest yields ≥1 chunk row with `type='image'`, non-NULL `image_bytes`, and the BLOB decodes to a valid PNG (`image::load_from_memory`).
- **Done when**: `cargo test --test image_extraction_test` exits 0; ≥1 `type='image'` chunk with non-NULL `image_bytes` after ingest of `sample-with-figure.pdf`; BLOB decodes to valid PNG via `image::load_from_memory`.
- **Pre-review**: none

### Slice 5: e5-small encoder + ingest-time embedding
- **Wave**: 4
- **Use cases**: UC-VR-1, UC-VR-3, UC-VR-EC-3
- **Files**: `tools/sdlc-knowledge/Cargo.toml`, `tools/sdlc-knowledge/src/encoder.rs` [new], `tools/sdlc-knowledge/src/ingest.rs`, `tools/sdlc-knowledge/tests/encoder_test.rs` [new], `tools/sdlc-knowledge/tests/encoder_prefix_test.rs` [new]
- **Changes**: Add `ort = { version = "2", default-features = false, features = ["load-dynamic"] }` to `Cargo.toml` (AI-3 applied — NOT the bare `ort = "2"` default; load-dynamic keeps binary <10 MB). `Encoder` singleton (mutex-guarded, lazy-loaded — same pattern as `PDFIUM` static). Loads e5-small ONNX from `~/.claude/tools/sdlc-knowledge/models/e5-small/`. Two methods: `encode_passages(&[&str]) -> Vec<Vec<f32>>` (prepends `"passage: "` to each input) and `encode_query(&str) -> Vec<f32>` (prepends `"query: "` to input). Ingest batches chunks (batch_size=32) and writes 384-dim vectors to `chunks_vec`. **Prefix discipline tested (AI-4 applied)**: `encoder_prefix_test.rs` MOCKS AT THE ONNX SESSION INPUT STRING BOUNDARY (NOT at the public `encode_passages`/`encode_query` API); ASSERTS EXACTLY ONE `"passage: "` per passage input AND EXACTLY ONE `"query: "` per query input — catches both single-prefix-missing AND double-prefix bugs.
- **Verify**: `cargo test --test encoder_test --test encoder_prefix_test` passes. After ingest, `chunks_vec` row count equals `chunks` row count. **Hardware-anchored latency**: on a 2024 MacBook M1 (specific reference machine), encoder cold-start <3s, hot-path batch=32 <50ms/chunk. Encoder fallback: when model files missing, encoder is initialized in degraded mode that returns Err on every encode call; ingest catches and falls back to BM25-only chunks (status --json reports `"degraded": "encoder model missing"`).
- **Done when**: `cargo test --test encoder_test --test encoder_prefix_test` exits 0; mock in `encoder_prefix_test.rs` is at ONNX session input string boundary (NOT public API); test asserts EXACTLY ONE `"passage: "` per passage AND EXACTLY ONE `"query: "` per query; encoder cold-start <3s and hot-path batch=32 <50ms on M1 reference machine; degraded-mode fallback tested.
- **Pre-review**: architect (fastembed vs raw `ort`; ONNX hash pinning; AI-3 load-dynamic feature-flag spelling)

### Slice 6: PaddleOCR for image chunks
- **Wave**: 5
- **Use cases**: UC-VR-4, UC-VR-EC-2
- **Files**: `tools/sdlc-knowledge/Cargo.toml`, `tools/sdlc-knowledge/src/ocr.rs` [new], `tools/sdlc-knowledge/src/ingest.rs`, `tools/sdlc-knowledge/tests/ocr_test.rs` [new], `tools/sdlc-knowledge/tests/fixtures/diagram-with-text.png` [new], `tools/sdlc-knowledge/tests/fixtures/sample-with-multiple-figures.pdf` [new]
- **Changes**: PaddleOCR det+rec via `ort`. Security hardening (AI-5 security pre-review): before decoding `image_bytes` BLOB for OCR, enforce byte-budget gate — `image::load_from_memory` with a 50 MB decoded-pixel cap (reject images larger than ~50 MB decoded to prevent PNG bomb DoS). For each `type='image'` chunk: load `image_bytes` BLOB → byte-budget gate → run PaddleOCR → set `chunk.text` to OCR'd text → encode via Slice 5's encoder → write to `chunks_vec`. If OCR returns empty (non-textual diagram), set placeholder `[image: figure N from <doc-basename>]`. OCR fallback: missing model → all image chunks get placeholder text + warning logged; ingest continues.
- **Verify**: `sample-with-multiple-figures.pdf` after ingest produces `type='image'` chunks where `text` is non-empty (either OCR'd content OR placeholder). On `diagram-with-text.png` containing literal "Authentication Service" text, cosine similarity between query "auth service architecture" (encoded via `encode_query`) and the corresponding chunk's stored embedding > 0.5.
- **Done when**: `cargo test --test ocr_test` exits 0; `type='image'` chunks have non-empty `text` after ingest; cosine similarity >0.5 for `diagram-with-text.png` fixture; 50 MB decoded-pixel byte-budget gate tested (oversized image rejected without panic); OCR-missing fallback tested.
- **Pre-review**: security (OQ-3 — PaddleOCR PNG bomb DoS byte-budget gate; AI-5 supply-chain for ONNX model filenames + HuggingFace commit hash)

### Slice 7: Hybrid search (lexical + dense + RRF)
- **Wave**: 5
- **Use cases**: UC-VR-3, UC-VR-5, UC-VR-6, UC-VR-7
- **Files**: `tools/sdlc-knowledge/src/search.rs`, `tools/sdlc-knowledge/src/cli.rs`, `tools/sdlc-knowledge/src/output.rs`, `tools/sdlc-knowledge/tests/search_modes_test.rs` [new], `tools/sdlc-knowledge/tests/rrf_test.rs` [new]
- **Changes**: `dense_search(query, top_k)`: encode query via `encode_query()`, run K-NN over `chunks_vec` via sqlite-vec `vec_distance_cosine`, return top-K. `hybrid_search(query, top_k)`: parallel BM25 top-(K*4) + dense top-(K*4), merge via RRF k=60, return top-K. CLI `--mode lexical|dense|hybrid`, default `hybrid`. JSON output extended with `mode_used`, `bm25_score`, `dense_score`, `rrf_score`. **RRF correctness**: `rrf_test.rs` provides 3 known input rankings + the expected RRF output; the test passes only if implementation matches.
- **Verify**: 3 modes work end-to-end. **Hardware-anchored latency**: on 2024 MacBook M1, hybrid p95 latency <500ms over a fixed sequence of 30 queries against the user's existing 51K-chunk corpus.
- **Done when**: `cargo test --test search_modes_test --test rrf_test` exits 0; `claudeknows search "test" --mode lexical` / `--mode dense` / `--mode hybrid` each return non-empty JSON with correct `mode_used` field; default (no `--mode` flag) returns `"mode_used": "hybrid"`; RRF correctness test passes with exactly-matched expected merged ranking; p95 latency <500ms on M1 reference machine over 30-query fixed sequence.
- **Pre-review**: architect (RRF correctness, score-normalization choice, sqlite-vec query API)

### Slice 8: Re-ingest user's corpus to v2 schema (operational)
- **Wave**: 6
- **Use cases**: UC-VR-1, UC-VR-CC-3
- **Files**: NONE (operational; no source-code changes). Updates `.claude/scratchpad.md` for audit.
- **Changes**: Run `claudeknows ingest /Users/aleksandra/Documents/claude-code-sdlc/books/` to populate the v2 schema with embeddings + image BLOBs. The corpus is ~40 PDFs (ML/AI, data engineering, AI agents, system design, MLOps; mixed RU+EN). Capture wall-clock time + final `claudeknows status --json` output. Document in `.claude/scratchpad.md`.
- **Verify**: `claudeknows status --json` shows non-zero `chunks_vec` row count matching `chunks` row count. Document count ≥ number of PDFs in the books folder. Wall-clock time recorded.
- **Done when**: `claudeknows status --json` shows `chunks_vec` row count > 0 AND equals `chunks` row count; wall-clock time documented in `.claude/scratchpad.md`; no ingest errors.
- **Pre-review**: none.

### Slice 9: Benchmark harness + golden query set + metrics
- **Wave**: 7
- **Use cases**: UC-VR-5, UC-VR-6, UC-VR-EC-5
- **Files**: `tools/sdlc-knowledge/Cargo.toml` ([[bin]] entry for bench runner), `tools/sdlc-knowledge/bench/runner.rs` [new], `tools/sdlc-knowledge/bench/metrics.rs` [new], `tools/sdlc-knowledge/bench/golden/queries.jsonl` [new], `tools/sdlc-knowledge/bench/golden/README.md` [new]
- **Changes**: NOT using Cargo's `benches/` (that's for criterion microbenchmarks); instead a regular `[[bin]]` named `claudeknows-bench` under `tools/sdlc-knowledge/bench/`. Query format: `{"id": "Q01", "query": "...", "lang": "ru|en|cross", "relevant_chunk_ids": [...], "relevant_docs": [...], "category": "keyword|nl|cross|paraphrase"}`. 25 manually-curated queries grounded in the books at `/Users/aleksandra/Documents/claude-code-sdlc/books/` (ingested in Slice 8) — for each query, relevance judgments cite specific chunk_ids from books I personally inspect during query authoring (e.g., "Building AI Agents with LLMs, RAG, and Knowledge Graphs.pdf" chapters on retrieval architecture; "Хаос инжиниринг.pdf" sections on fault injection). Mix of categories (keyword / natural-language / cross-lingual / paraphrase). Metrics: Recall@1/3/5/10, Precision@5, MRR (1/rank of first relevant), NDCG@10, per-document recall (fraction of relevant DOCS hit), latency p50/p95. **Per-language stratification OUT-OF-SCOPE per OQ-4** — overall metrics + qualitative side-by-side only.
- **Verify**: `cargo run --bin claudeknows-bench -- --queries bench/golden/queries.jsonl --modes lexical,dense,hybrid` emits a Markdown report. Synthetic gold-standard tests verify metrics (perfect ranking → Recall@1 = 1.0, MRR = 1.0).
- **Done when**: `bench/golden/queries.jsonl` contains ≥25 entries with all required fields; `cargo run --bin claudeknows-bench -- --queries bench/golden/queries.jsonl --modes lexical,dense,hybrid` exits 0 and emits a Markdown report containing Recall@1, Recall@5, MRR, NDCG@10, and latency p50/p95 metric tables for each mode; synthetic test for perfect-ranking case passes (Recall@1 = 1.0, MRR = 1.0).
- **Pre-review**: none.

### Slice 10: Run benchmark + commit report
- **Wave**: 8
- **Use cases**: UC-VR-5, UC-VR-6
- **Files**: `tools/sdlc-knowledge/bench/reports/2026-05-09-vector-vs-bm25.md` [new]
- **Changes**: Run `claudeknows-bench` against the v2 corpus ingested from `/Users/aleksandra/Documents/claude-code-sdlc/books/` (Slice 8) for all 3 modes. Generate Markdown report: methodology, dataset description (~40 PDFs / actual chunk count / RU+EN), query categorization, metric tables per mode, latency, top-10 qualitative side-by-side samples for 5–10 representative queries, failure-mode taxonomy, recommendations.
- **Verify**: report file exists, contains all required sections, metric tables non-empty.
- **Done when**: `test -f tools/sdlc-knowledge/bench/reports/2026-05-09-vector-vs-bm25.md` exits 0; report contains sections: methodology, dataset description, metric tables (with numeric values, not empty), latency table, ≥5 qualitative samples, failure-mode taxonomy, and recommendations.
- **Pre-review**: none.

### Slice 11: install scripts + rule updates + README
- **Wave**: 8
- **Use cases**: UC-VR-CC-1, UC-VR-CC-2, UC-VR-CC-3
- **Files**: `install.sh`, `install.ps1`, `README.md`, `src/rules/knowledge-base.md`, **and CRITICALLY** the corresponding rule files deployed by install.sh to `~/.claude/rules/` (notably `~/.claude/rules/knowledge-base-tool.md` containing the iter-1 "NOT a vector database" assertion — needs the equivalent file added to `src/rules/` if absent so install.sh deploys the updated text)
- **Changes (AI-3 + AI-5 applied)**:
  - `install.sh` / `install.ps1`: add `install_e5_model`, `install_paddleocr_models`, and `install_onnxruntime_binary` functions following the `install_pdfium_binary` pattern. **NO `install_docling_models` function** (Docling deferred to v2 per AI-1). Total +~250 MB at install time (e5-small ~120 MB + PaddleOCR ~30 MB + ONNX runtime dylib ~50–80 MB).
  - **AI-5 supply-chain hardening**: each of `install_e5_model`, `install_paddleocr_models`, and `install_onnxruntime_binary` MUST download a `.sha256` sidecar file alongside the archive and verify the checksum before extraction (same 17-step pdfium pattern). Pin specific HuggingFace commit hashes for e5-small and PaddleOCR; pin specific GitHub release tag for ONNX runtime (e.g., `v1.20.0`). Document all pinned URLs and hashes as named constants near the top of `install.sh` alongside `KNOWLEDGE_PDFIUM_VERSION` (e.g., `E5_MODEL_COMMIT`, `PADDLEOCR_COMMIT`, `ONNXRUNTIME_VERSION`). Mirror same constants in `install.ps1`.
  - `README.md`: new "Vector + Multimodal Retrieval" subsection in Hardening table; reference benchmark report.
  - `src/rules/knowledge-base.md`: revise to reflect 3 search modes, hybrid retrieval, image chunks, schema v2.
  - `src/rules/knowledge-base-tool.md` (verify file exists; create if absent): REMOVE assertion "**NOT a vector database. No embeddings, no semantic similarity.**" and replace with updated description of hybrid retrieval and 3 search modes.
  - **Note**: version bump 0.3.1 → 0.4.0 happens via the user-invoked `/release` command AFTER merge, NOT in this slice. CHANGELOG.md `[Unreleased]` is appended via `changelog-writer` in `/merge-ready`.
- **Verify**: fresh install on Mac+Win downloads all 3 model bundles with sha256 verification. `grep -F "NOT a vector database" ~/.claude/rules/` returns zero matches after install. README has a "Vector + Multimodal Retrieval" entry. Named version constants (e.g., `E5_MODEL_COMMIT`) exist near top of `install.sh`.
- **Done when**: `bash install.sh --yes` exits 0 and downloads all 3 model bundles with sha256 verification before extraction; `grep -F "NOT a vector database" ~/.claude/rules/knowledge-base-tool.md` returns zero matches; `grep -E "hybrid|RRF|sqlite-vec" ~/.claude/rules/knowledge-base.md | wc -l` returns ≥1; `grep "E5_MODEL_COMMIT\|PADDLEOCR_COMMIT\|ONNXRUNTIME_VERSION" install.sh` shows pinned version constants; README contains "Vector + Multimodal Retrieval" subsection; no `install_docling_models` function present.
- **Pre-review**: security (AI-5 — supply-chain sha256 + pinned commit/tag hardening; model path resolution mirrors pdfium canonicalize+prefix-check pattern)

## Wave summary

| Wave | Slices | Rationale |
|------|--------|-----------|
| 1    | 1, 2   | Foundation — chunker (src/chunker.rs+ingest.rs+tests/) and sqlite-vec storage (Cargo.toml+store.rs+migrations.rs+tests/) on disjoint files |
| 2    | 3      | Parser bridge (src/parser.rs+pdf.rs) needs Slice 1's structural chunker for Markdown→chunks pipeline |
| 3    | 4      | Image extraction (ingest.rs) depends on Slice 3's `pdf::extract_images()` output |
| 4    | 5      | Encoder (encoder.rs) is independent of image work but needs vec table from Slice 2; consumed by all downstream slices |
| 5    | 6, 7   | OCR (ocr.rs+ingest.rs) needs Slices 4+5; Search (search.rs+cli.rs+output.rs) needs Slice 5; disjoint files |
| 6    | 8      | Re-ingest is operational; needs all encoding + OCR + storage in place |
| 7    | 9      | Benchmark harness depends on all 3 search modes from Slice 7 |
| 8    | 10, 11 | Report (bench/reports/*) and install/docs (install.sh+install.ps1+README+rules) on disjoint files |

**Cross-wave file overlap (allowed, sequential merges)**: `src/ingest.rs` is touched in waves 1, 2, 3, 4, 5 — each edit is additive (new function call insertion or new branch handling), tested independently per wave. `Cargo.toml` is touched in waves 1, 2, 4, 5, 7, 8 — each edit only ADDS a new dep entry, never modifies existing ones.

## Files affected

**NEW (~16 files)**:
- `tools/sdlc-knowledge/src/{chunker,parser,encoder,ocr}.rs`
- `tools/sdlc-knowledge/tests/{chunker,store_v2,migration,parser,image_extraction,encoder,encoder_prefix,ocr,search_modes,rrf}_test.rs`
- `tools/sdlc-knowledge/tests/fixtures/{sample-with-headings.md, sample-no-headings.md, sample-structured.pdf, sample-with-figure.pdf, sample-with-multiple-figures.pdf, diagram-with-text.png}`
- `tools/sdlc-knowledge/bench/{runner,metrics}.rs`
- `tools/sdlc-knowledge/bench/golden/{queries.jsonl, README.md}`
- `tools/sdlc-knowledge/bench/reports/2026-05-09-vector-vs-bm25.md`
- `docs/use-cases/vector-retrieval-backend_use_cases.md`
- `docs/qa/vector-retrieval-backend_test_cases.md`

**MODIFIED**:
- `tools/sdlc-knowledge/Cargo.toml` (deps; version bump deferred to /release)
- `tools/sdlc-knowledge/Cargo.lock`
- `tools/sdlc-knowledge/src/{ingest,store,migrations,search,cli,output,pdf}.rs`
- `install.sh`, `install.ps1`
- `README.md`
- `src/rules/knowledge-base.md` (and `src/rules/knowledge-base-tool.md` — create if absent)
- `docs/PRD.md` (§15 already written by prd-writer at bootstrap)
- `CHANGELOG.md` `[Unreleased]` (by changelog-writer at /merge-ready)

**INTENTIONALLY UNCHANGED**:
- 5 executor agents — no agent prompt changes
- 12 thinking agents — no agent prompt changes
- `templates/` directory — no scaffold changes

## Risks and dependencies

1. **R1 — Docling Rust integration (RESOLVED by AI-1)**. Architect ruled Option (d) pragmatic v1 fallback. Slice 3 is "Parser bridge over pdfium" — heading-aware Markdown from pdfium plain text + `pdf::extract_images()`. Docling deferred to v2.
2. **R2 — sqlite-vec linking (RESOLVED by AI-2)**. `sqlite-vec = "0.1"` Rust crate via `sqlite_vec::load(&db)` helper. NOT bundled, NOT `load_extension`. Cross-platform statics included.
3. **R3 — Bundle size ~250 MB (models + ONNX runtime dylib)**. Mitigation: install-time download via `install_e5_model`, `install_paddleocr_models`, `install_onnxruntime_binary` functions; lazy-fallback if missing (encoder degraded → BM25-only; OCR degraded → placeholder text). Binary itself stays <10 MB via `ort` load-dynamic (AI-3).
4. **R4 — v1→v2 migration UX on large corpora**. User's 51K chunks ~10 min to re-encode. Mitigation: `CLAUDEKNOWS_AUTO_REINGEST=1` for headless; clear prompt for TTY; corrupt v1 honors AC-7 contract.
5. **R5 — Benchmark fairness**. BM25 and dense must use the SAME chunks (post-Slice-1 structural chunker output) so comparison isolates retrieval-method differences. Slice 9 enforces.
6. **R6 — OCR quality on schematic diagrams**. PaddleOCR is best-in-class for natural text but mediocre on diagrams. Benchmark Slice 10 surfaces real numbers; if poor, iter-2 may add layout-aware diagram parsers.
7. **R7 — e5 prefix discipline drift**. Forgetting "passage:" / "query:" silently degrades quality 5–10%. Slice 5 explicitly tests this in `encoder_prefix_test.rs` with mock at ONNX session input boundary (AI-4).
8. **R8 — Plan-mode persistence**. Plan body auto-persisted to `<project>/.claude/plan.md` per the rule shipped in 0.3.1; built-in, not a feature concern.
9. **R9 — Binary-size budget breach from ONNX runtime**. Mitigated by AI-3: `ort = { version = "2", default-features = false, features = ["load-dynamic"] }` keeps binary <10 MB; ONNX runtime ships as dylib in `onnxruntime/lib/` (same pattern as pdfium). Slice 5 architect pre-review validates.
10. **R10 — Cargo.toml multi-edit serialization**. 6 slices touch Cargo.toml across 5 waves. Mitigation: each edit ADDS a new dep entry, never modifies existing; sequential wave merges preserve correctness.
11. **R11 — PNG bomb DoS in OCR path**. Large decoded images could exhaust memory. Mitigated by AI-5 security pre-review: `image::load_from_memory` with 50 MB decoded-pixel cap in Slice 6 `ocr.rs` before feeding OCR.
12. **R12 — Supply-chain for model downloads**. Mitigated by AI-5: each install function downloads `.sha256` sidecar + verifies before extraction; specific HuggingFace commit hashes and GitHub release tags pinned as constants in `install.sh`.

## Verification (end-to-end)

After all 11 slices land:

```bash
# 1. Fresh install with all model bundles
bash install.sh --yes
test -x ~/.claude/tools/sdlc-knowledge/sdlc-knowledge
test -d ~/.claude/tools/sdlc-knowledge/models/e5-small
test -d ~/.claude/tools/sdlc-knowledge/models/paddleocr
test -d ~/.claude/tools/sdlc-knowledge/onnxruntime/lib
~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version  # 0.3.1 (bump to 0.4.0 happens via /release)

# 2. Schema v2
claudeknows status --json | jq '.schema_version'  # 2

# 3. v1→v2 migration
# Place v1 fixture index.db, run any command, expect prompt or AUTO_REINGEST behavior

# 4. Re-ingest user's corpus (Slice 8)
time claudeknows ingest ~/Documents/books/

# 5. Search modes
claudeknows search "authentication architecture" --mode lexical --json | jq '.[] | .mode_used'  # "lexical"
claudeknows search "authentication architecture" --mode dense   --json | jq '.[] | .mode_used'  # "dense"
claudeknows search "authentication architecture" --mode hybrid  --json | jq '.[] | .mode_used'  # "hybrid"
claudeknows search "authentication architecture"               --json | jq '.[] | .mode_used'  # "hybrid" (default)

# 6. Image chunks searchable
claudeknows search "<query that should hit OCR'd diagram>" --json | jq '.[] | select(.type=="image")'  # ≥1 hit on a corpus with figures

# 7. Benchmark
cd <repo>/tools/sdlc-knowledge
cargo run --release --bin claudeknows-bench -- --queries bench/golden/queries.jsonl --modes lexical,dense,hybrid --report bench/reports/local-run.md
diff bench/reports/local-run.md bench/reports/2026-05-09-vector-vs-bm25.md  # near-identical (deltas only in run timestamps)

# 8. Backward compat — no models installed
mv ~/.claude/tools/sdlc-knowledge/models ~/.claude/tools/sdlc-knowledge/models.bak
claudeknows search "anything" --mode lexical  # works (BM25 fallback)
claudeknows search "anything" --mode dense    # exits 1 with "encoder model missing"
claudeknows search "anything" --mode hybrid   # falls back to lexical with warning
mv ~/.claude/tools/sdlc-knowledge/models.bak ~/.claude/tools/sdlc-knowledge/models

# 9. Rule update
grep -F "NOT a vector database" ~/.claude/rules/knowledge-base-tool.md  # zero matches
grep -E "hybrid|RRF|sqlite-vec" ~/.claude/rules/knowledge-base.md       # ≥1 match each

# 10. Invariants preserved
ls src/agents/*.md | wc -l       # 17 (unchanged)
ls src/commands/*.md | wc -l     # 7 (unchanged — no new command added)

# 11. Supply-chain constants present
grep "E5_MODEL_COMMIT\|PADDLEOCR_COMMIT\|ONNXRUNTIME_VERSION" install.sh  # ≥3 matches
```

All 11 verification blocks PASS = feature merge-ready.

## Review Notes

### Critic Findings (original plan-mode pass)

- **Total**: 26 findings (7 CRITICAL, 13 MAJOR, 6 MINOR)
- **All CRITICAL/MAJOR addressed**: Yes

### Changes Made (original plan-mode pass)

**CRITICAL fixes:**
- **#1 (main branch)** — added explicit "Pre-implementation precondition" in Context: must create `feat/vector-retrieval-backend` branch before any slice begins.
- **#2 (plan persistence in Risks)** — moved from R8 risk to a hard precondition in Context. The auto-persist rule shipped in 0.3.1 makes this automatic.
- **#3 ("NOT a vector database" assertion)** — Slice 11 explicitly removes that assertion from `~/.claude/rules/knowledge-base-tool.md` AND updates `~/.claude/rules/knowledge-base.md` AND `src/rules/knowledge-base.md`. Verification block 9 greps for absence of the old assertion.
- **#4 (PRD FR-4.3 contradiction)** — Context section explicitly notes "supersedes the reserved `embedding BLOB` column strategy"; Documentation phase of /bootstrap-feature includes formal FR-4.3 amendment in PRD §15.
- **#5 (NFR-1.5 single-file constraint)** — Locked decision #6 commits to image bytes as `chunks.image_bytes BLOB` column INSIDE `index.db`. Slice 4 verifies BLOB integrity.
- **#6 (External contracts unverified, Docling load-bearing)** — added pragmatic-fallback strategy: if architect Slice 3 pre-review rules Docling unfeasible, Slice 3 de-scopes and Docling defers to v2. Plan still delivers vector + multimodal + benchmark.
- **#7 (no re-ingest slice)** — added Slice 8 explicitly for operational re-ingest of user's corpus. No source-code changes; wall-clock-time operation with status-json verification.

**MAJOR fixes:**
- **#8 (Slice 1 too large)** — split old mega-slice into Slice 1 (chunker), Slice 3 (parser bridge), Slice 4 (image extraction). Each <200 LOC.
- **#9 (Slice 8 over-scoped)** — version bump and CHANGELOG removed from Slice 11; bump via `/release` AFTER merge, CHANGELOG via `/merge-ready` per pipeline contract.
- **#10 (no documentation phase ordering)** — added "Pre-implementation: documentation phase" section listing 4 deliverables as upstream-of-Slice-1 work via /bootstrap-feature.
- **#11 (e5 prefix not testable)** — Slice 5 added `encoder_prefix_test.rs` mocking the ONNX call to assert prefix discipline.
- **#12 (ingest.rs touched in many waves)** — Wave summary documents that each wave's ingest.rs edit is additive; cross-wave merges sequential.
- **#13 (Cargo.toml multi-edit constraint)** — Wave summary documents all Cargo.toml edits as additive (new dep entries only).
- **#14 (vague done-conditions)** — tightened: Slice 5 latency anchored to "2024 MacBook M1 reference machine"; Slice 4 fixture with EXACT count; Slice 7 latency over fixed sequence of 30 queries; Slice 6 cosine threshold tied to specific fixture.
- **#15 (External contracts unverified for trivially verifiable)** — flagged each as "verified: no — assumption" with explicit pre-review owners (Slice 2/3/5/6 architects).
- **#16 (bundle size unsupported)** — added R9: ONNX static-link can blow 10 MB budget; mitigation is dynamic loading like pdfium today; Slice 5 architect pre-review validates.
- **#17 (zero-Python tension with Docling)** — explicit in Locked Decision #8 and OQ-1; pragmatic fallback (Slice 3 de-scope) if architect rules unfeasible.
- **#18 (no model-missing slice)** — encoder fallback in Slice 5 done-condition: "degraded mode" returns Err on encode; ingest catches and falls back to BM25-only chunks. OCR fallback in Slice 6: missing model → placeholder text + warning. Hybrid search fallback in verification #8.
- **#19 (corrupt v1 migration UX)** — Slice 2 done-condition explicitly covers corrupt v1 (truncated DB) honoring AC-7 contract.
- **#20 (per-language benchmark stratification)** — OQ-4 declared OUT-OF-SCOPE: 25 queries provide overall metrics + qualitative samples only.
- **#21 (date inconsistency)** — report path updated to `2026-05-09-vector-vs-bm25.md` (today's date per system context).

**MINOR fixes (acknowledged, addressed inline)**:
- **#22 (CLIP-deferred hedging)** — Locked Decision #4 classifies pure-vision CLIP as OUT OF SCOPE for v1, deferred until benchmark shows visual-only retrieval is needed (tied to benchmark outcome, not arbitrary).
- **#23 (benches/ directory layout)** — Slice 9 chose `bench/` directory + `[[bin]]` over Cargo's `benches/` (which is for criterion microbenchmarks).
- **#24 (knowledge-base-tool rule sync)** — Slice 11 explicitly updates the rule.
- **#25 (e5 prefix verified=yes citation)** — citation now references the model card URL specifically.
- **#26 (status --json claim)** — Verified facts read "verified by `claudeknows status --json` invocation earlier in this session" (session-scoped real command output).

### Acknowledged Minor Issues (original pass)
- None unresolved. All MINOR findings addressed inline.

### Architect Step-3 Action Items Applied

- **AI-1 (Docling→v2 / Slice 3 rename+collapse)**: Applied. Slice 3 renamed from "Docling parser integration" to "Parser bridge over pdfium + image extraction". `src/docling.rs` → `src/parser.rs`; `tests/docling_test.rs` → `tests/parser_test.rs`. Slice 3 Changes rewired: `src/pdf.rs` extended with `extract_images()` returning `Vec<(page_idx, png_bytes)>`; `src/parser.rs` produces structural Markdown from pdfium output via heading detection. Slice 4 Files updated: `src/docling.rs` reference replaced by `src/ingest.rs` consuming `pdf::extract_images()` output. Files affected section updated: `src/{chunker,parser,encoder,ocr}.rs`. Locked decision #3 updated. Wave summary row 2 updated. Status: **Applied**.
- **AI-2 (sqlite-vec pin + done-condition)**: Applied. Slice 2 Changes now explicitly states `sqlite-vec = "0.1"` in `Cargo.toml`. Slice 2 Done-when now includes: "`sqlite_vec::load(&db)` invoked at connection open; `vec0` virtual table coexists with `chunks_fts` without trigger conflicts; rusqlite `load_extension` feature stays OFF." External contracts updated to reflect `sqlite_vec::load(&db)` API. Status: **Applied**.
- **AI-3 (ort load-dynamic + install_onnxruntime_binary + 250 MB footprint)**: Applied. Slice 5 Changes: `ort = { version = "2", default-features = false, features = ["load-dynamic"] }`. Slice 11 Changes: `install_onnxruntime_binary` function added alongside `install_e5_model` and `install_paddleocr_models`. `install_docling_models` explicitly NOT added. R3 updated to ~250 MB. Locked decision #7 updated. R9 updated. Verification block updated to check `onnxruntime/lib` directory. Status: **Applied**.
- **AI-4 (prefix test at ONNX session input boundary)**: Applied. Slice 5 Changes: updated `encoder_prefix_test.rs` description to "MOCKS AT ONNX SESSION INPUT STRING BOUNDARY (NOT public API); ASSERTS EXACTLY ONE `"passage: "` per passage AND EXACTLY ONE `"query: "` per query". Slice 5 Done-when updated to match. Status: **Applied**.
- **AI-5 (sha256 supply-chain hardening)**: Applied. Slice 11 Changes: new bullet — each of the 3 install functions MUST download `.sha256` sidecar and verify before extraction; HuggingFace commit hashes and GitHub release tag pinned as named constants (`E5_MODEL_COMMIT`, `PADDLEOCR_COMMIT`, `ONNXRUNTIME_VERSION`) near top of `install.sh`. Verification block updated: grep for named constants. R12 added. Slice 6 security pre-review flag updated to include PNG bomb DoS byte-budget gate. Status: **Applied**.

### Plan Critic (post-architect-refinement pass)

**FINDINGS:**

1. [MINOR] — PRD §15 FR-VR-8.1 still references `install_docling_models` and `models/docling/` directory (lines 3697–3698 of PRD). The plan correctly omits these per AI-1, but the PRD was not updated in this refinement session (durable mirror is intentionally untouched per instructions). This is a documentation drift that must be resolved when PRD §15 affected-files list is updated. Affects: PRD §15 FR-VR-8.1, FR-VR-8.2 — not plan.md itself.
2. [MINOR] — PRD §15 NFR-VR-6 budget number still says "approximately 200 MB" (line 3710). Plan and locked decisions correctly reflect ~250 MB per AI-3. Same documentation drift as above. Affects: PRD §15 NFR-VR-6 — not plan.md itself.
3. [MINOR] — Slice 3 pre-review field says "none (AI-1 resolved the CRITICAL architect pre-review...)" — the note is correct but verbose; could be simplified. Not a correctness issue.

**VERIFIED:**
- All 5 architect action items (AI-1 through AI-5) applied and traceable in slice Changes and Done-when fields.
- `## Recommended Resources` (9 recommendations), `## Auto-Install Results` (headless skip), and `## Additional Roles` (0 roles) all inlined verbatim and positioned before `## Facts` and `## Prerequisites verified`.
- `## Facts` block present with all 4 subsections including `(none)`-safe external contracts.
- Wave assignment: 11 slices across 8 waves; no shared files within any wave (verified: Wave 5 Slices 6+7 share no files — Slice 6 has `ocr.rs`, `ingest.rs`; Slice 7 has `search.rs`, `cli.rs`, `output.rs`).
- All Done-when conditions are boolean testable (exact exit codes, exact grep patterns, exact field values).
- No hedging language found in Done-when conditions or slice descriptions.
- Docling references removed from Files affected list, Slice 3, Slice 4, Slice 11 Changes.
- `src/docling.rs` no longer listed anywhere; replaced by `src/parser.rs` throughout.
- R11 (PNG bomb) and R12 (supply-chain) added to cover AI-5 security concerns.
- No gate count issues (plan does not reference merge-ready gates by number).

**Total findings: 3 (0 critical, 0 major, 3 minor). All CRITICAL/MAJOR: N/A (0 of each). Minor findings are PRD documentation drift, not plan.md issues — no changes to plan.md required for minor findings.**

### Acknowledged Minor Issues (post-refinement pass)
- Finding #1 and #2: PRD §15 FR-VR-8.1/8.2 and NFR-VR-6 documentation drift vs AI-1/AI-3 resolutions. These live in `docs/PRD.md` which is intentionally not edited in this refinement (per instructions: "DO NOT touch docs/design/vector-retrieval-backend.md"; same spirit applies to PRD). The implementing developer MUST update PRD §15.6 affected-files list and NFR-VR-6 budget number before or during Slice 11 implementation as noted in the architect verdict.
- Finding #3: Verbose pre-review note in Slice 3 — kept for traceability; not a correctness issue.
