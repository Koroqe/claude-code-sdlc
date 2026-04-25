# Test Cases: Auto-Release Pipeline — Executing-Mode Tagging, Cross-Platform Prebuilt Binaries, and Pre-Push Hooks

> Based on [PRD](../PRD.md) — Section 13 and [Use Cases](../use-cases/auto-release_use_cases.md)

## Facts

### Verified facts

- The PRD Section 13 (Auto-Release Pipeline) spans `docs/PRD.md` lines 2974-3459 with eight numbered subsections (13.1 through 13.8) plus a terminal `## Facts` block at lines 3405-3459 — verified by Read of `docs/PRD.md` lines 2974-3459 across multiple chunks in the current session.
- The 13 acceptance criteria AC-1 through AC-13 are documented at PRD §13.5 lines 3265-3289 — verified by Read in the current session.
- The 12 functional-requirement groups FR-1 through FR-12 spanning roughly 70 sub-clauses are documented at PRD §13.3 lines 3030-3242 — verified by Read in the current session.
- The 9 non-functional requirements NFR-1 through NFR-9 are documented at PRD §13.4 lines 3245-3261 — verified by Read in the current session.
- The use-cases file `docs/use-cases/auto-release_use_cases.md` documents 17 primary UCs (UC-1 through UC-17), 6 cross-cutting UCs (UC-CC-1 through UC-CC-6), 11 alternative flows, 13 error flows, and 12 edge cases for a total of 59 distinct scenarios across 1510 lines including a terminal `## Facts` block at lines 1429-1510 — verified by `grep -n "^## \|^### "` plus Read of the use-cases file lines 1-200 in the current session.
- The four-tier authority gradation `Trivial | Moderate | Sensitive | Forbidden` and the most-restrictive-applicable-tier rule are lifted from `src/agents/resource-architect.md:185-260` per FR-1.2 PRD line 3036 — verified by Read in the current session via the PRD text.
- The FR-1.2 12-row tier table lives at PRD lines 3038-3052 — verified by Read in the current session.
- The FR-1.3 eight anchored-regex whitelist entries (a) through (h) are enumerated at PRD line 3055 — verified by Read in the current session.
- The literal headless-skip stderr line per FR-1.4 is `aborted-headless-sensitive: <operation> requires interactive approval; rerun without AUTO_RELEASE=1` at PRD line 3060 — verified by Read in the current session.
- The literal forbidden-tier refusal stderr line per FR-1.4 is `aborted-forbidden: <operation> never executed` at PRD line 3061 — verified by Read in the current session.
- The literal whitelist-violation stderr line per FR-1.3 is `error: command not in release-engineer whitelist: <command>` at PRD line 3055 — verified by Read in the current session.
- The literal FR-1.5 Sensitive-tier prompt (5 lines) opens `[Sensitive — release-engineer] About to execute: <verbatim-command>` at PRD line 3067 — verified by Read in the current session.
- The literal `[BOOTSTRAP]` warning per FR-6.4 is `[BOOTSTRAP] this is a one-time first-release operation; subsequent releases use /merge-ready Gate 9 with release-engineer in executing mode (FR-1)` at PRD line 3150 — verified by Read in the current session.
- The literal `[BOOTSTRAP]` push prompt per FR-6.5 is `[BOOTSTRAP] About to execute: git push origin sdlc-knowledge-v<X.Y.Z> — this fires the GH Actions release workflow at .github/workflows/sdlc-knowledge-release.yml. Approve? [y/N]:` at PRD line 3152 — verified by Read in the current session.
- The literal pre-push validation skip line per FR-8.3 is `pre-push validation skipped: no Commands block in ./CLAUDE.md` at PRD line 3178 — verified by Read in the current session.
- The five-platform matrix (FR-3.1) is `darwin-arm64`/`macos-14`, `darwin-x64`/`macos-13`, `linux-x64`/`ubuntu-latest`, `linux-arm64`/`ubuntu-22.04-arm`, `windows-x64`/`windows-latest` with target `x86_64-pc-windows-msvc` for Windows — verified by Read of PRD lines 3094-3108 in the current session.
- The current glob in `.github/workflows/sdlc-knowledge-release.yml:115` is `find /tmp/pdfium-staging -maxdepth 3 -name 'libpdfium*' -type f -exec cp {} ...` — verified via `grep -n "libpdfium"` in the current session. FR-3.3 widens this glob to also capture Windows `pdfium.dll` (no `lib` prefix); the architect [STRUCTURAL] action item resolves the syntax to use `find ... \( -name 'libpdfium*' -o -name 'pdfium*' \) -type f` per TC-AAI-3 below.
- `install.sh:25` currently declares `REPO_URL="https://github.com/Koroqe/claude-code-sdlc.git"` (the bug FR-5.1 fixes); the actual GitHub remote is `codefather-labs/claude-code-sdlc.git` — verified by Read of `install.sh` lines 22-31 in the current session.
- `install.sh:22` currently declares `VERSION="2.1.0"` — verified by Read in the current session. FR-7.5 bumps this to `VERSION="3.0.0"`.
- `src/agents/release-engineer.md:4` currently declares `tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]` — verified by Read of the file's first 10 lines in the current session. The architect MAJOR action item (TC-AAI-4) confirms `Bash` is ALREADY in the tools list before any iter-3 edits, so FR-1.1 is a documentation accuracy fix to the prompt body (which currently states "no Bash tool" in conflict with the frontmatter), not a frontmatter modification.
- The 17-agent file count is verified by `ls src/agents/*.md | wc -l` returning 17 (per the §11 / §12 invariants inherited; FR-12.1 preserves it) — established invariant cited at PRD line 3227.
- The 5-executor agent file list (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`) is BYTE-UNCHANGED per FR-12.3 PRD line 3231 — verified by Read in the current session.
- The 6-command file count: iter-1 (§11) brought the count from 5 to 6 by adding `/knowledge-ingest`; FR-12 in iter-3 makes no command changes per PRD line 3400 (`src/commands/*.md` UNCHANGED) — preserved invariant.
- The README taglines at lines 5 (`17 specialized AI agents...`) and 35 (`10 quality gates`) MUST be BYTE-UNCHANGED per FR-12.4 PRD line 3233 — verified by Read in the current session.
- The cognitive-self-check rule file `src/rules/cognitive-self-check.md` MUST be BYTE-UNCHANGED per FR-12.6 PRD line 3237 — verified by Read in the current session.
- The four pre-existing `templates/rules/*` files (`changelog.md`, `architecture.md`, `security.md`, `testing.md`) MUST be BYTE-UNCHANGED per the PRD §13.8 Unchanged Files table at lines 3397-3398 — verified by Read in the current session. FR-12.5 explicitly relaxes the broader templates invariant to ADD `templates/rules/auto-release.md` and `templates/hooks/pre-push` per PRD line 3235 — these are NEW files, not modifications to existing template files.
- The 12 thinking-agent activation block (`## Knowledge Base (when present)`) is BYTE-UNCHANGED per FR-12.7 PRD line 3239 — verified by Read in the current session.
- The current `## NEVER List` at `src/agents/release-engineer.md:67-84` enumerates 13 forbidden command lines including `git push`, `git push origin <anything>`, `git tag`, `gh release create`, `npm publish`, `cargo publish`, `pypi upload`, `twine upload`, `gem push`, `poetry publish`, force-push variants — verified by Read in the current session via the PRD's Verified facts entry at PRD line 3415. FR-1.7 SHRINKS this list to FR-1.2 Forbidden-tier rows only (rows 9-11: registry publishes, force-pushes, `gh release create`); the OTHER commands (`git push`, `git tag`, `git push origin <tag>`) MOVE to Sensitive-tier with explicit-approval semantics. TC-INV-10 below verifies the 13 forbidden command lines REMAIN in the NEVER List for the items that stay (rows 9-11 must remain byte-unchanged in their forbidden semantics — additivity-only — never-removing-rows constraint).
- The 5 architect action items mandated by the user task each map to a dedicated TC: tag-scheme disambiguation logic (TC-AAI-1, [STRUCTURAL]); FR-12.7 templates scope wording (TC-AAI-2, [STRUCTURAL]); find-glob `-o` operator widening (TC-AAI-3, [STRUCTURAL]); release-engineer Bash already-present (TC-AAI-4, MAJOR — verified by Read of release-engineer.md:4 in this session); KB corpus DevOps gap iter-4 tracking (TC-AAI-5, MINOR — informational only, no test action this iter).
- 4 slices were flagged for security pre-review per the user task: release-engineer executing-mode + bash whitelist (TC-SEC-1.x); install.sh download_release_binary Windows (TC-SEC-2.x); bootstrap_first_release one-shot (TC-SEC-3.x); sdlc-core-release.yml workflow (TC-SEC-4.x). Each group emits ≥3 TCs below.
- `.claude/resources-pending.md` records 0 recommendations per the user task and verified by `cat .claude/resources-pending.md` in the current session — no external resources are pulled in by iter-3.
- `.claude/roles-pending.md` records 0 additional roles per the user task and verified by `cat .claude/roles-pending.md` in the current session — all iter-3 work maps to the existing 17 core agents (release-engineer, security-auditor, architect, code-reviewer, verifier, doc-updater, test-writer, build-runner, changelog-writer).
- The format-precedent QA files are `docs/qa/local-knowledge-base_test_cases.md` (2349 lines, 117 TCs, organised as `## Facts` block at top → `## Use Case Coverage` table → `## AC Coverage` table → numbered sections per UC → `## Invariant Test Cases` → `## Architect Action Item Test Cases` → `## Cross-Platform Matrix` → `## Security Pre-Review Test Groups`) and `docs/qa/pdfium-pdf-extraction_test_cases.md` (1515 lines, 71 TCs, same structure) — verified by Read of both files' first ~200 lines in the current session.
- This is a NEW QA test-cases file (CREATE, not UPDATE) — verified because no file at `/Users/aleksandra/Documents/claude-code-sdlc/docs/qa/auto-release_test_cases.md` exists prior to this slice.
- Knowledge-base status at task start: `schema_version: 1`, `doc_count: 28`, `chunk_count: 51542`, `db_path: /Users/aleksandra/Documents/claude-code-sdlc/.claude/knowledge/index.db` — verified via `~/.claude/tools/sdlc-knowledge/sdlc-knowledge status --json` in the current session.

### External contracts

- **`softprops/action-gh-release@v2` GitHub Action** — symbol: `inputs.tag_name`, `inputs.name`, `inputs.body_path`, `inputs.files`, `inputs.draft`, `inputs.prerelease`, `inputs.fail_on_unmatched_files` — source: `.github/workflows/sdlc-knowledge-release.yml:202-213` (consumed in this repo by the §11/§12 release workflow; inherited by §13 FR-2.3 / FR-11.2) — verified: yes (PRD-cite chain to a workflow file Read by the prd-writer in §13's authoring session).
- **GitHub Actions runner image `windows-latest`** — symbol: runner-label string used in `runs-on:`; preinstalls Visual Studio 2022 Build Tools (`cl.exe`), Git for Windows (`git`, `bash`), `curl`, `tar`, `find` — source: PRD §13 `## Facts → ### External contracts` entry at PRD line 3428 — verified: **no — assumption**. Risk: runner image tooling could change; verification path: TC-CP-5 below exercises `bash install.sh --yes` on the actual Windows runner and asserts the case-branch match.
- **GitHub Actions runner image `ubuntu-22.04-arm`** — symbol: ARM64 Linux runner label — source: PRD §11 FR-11.1 / inherited unchanged in §12 FR-7.3 / §13 FR-3.1 — verified: yes (PRD-cite chain).
- **GitHub Actions runner images `macos-14`, `macos-13`, `ubuntu-latest`** — symbol: runner-label strings — source: §11 FR-11.1 BYTE-UNCHANGED in iter-3 — verified: yes (PRD-cite chain).
- **Cargo cross-compile target `x86_64-pc-windows-msvc`** — symbol: rustup target name; requires MSVC linker (`link.exe`); produces `.exe` suffix — source: PRD §13 `## Facts → ### External contracts` entry at PRD line 3429 — verified: **no — assumption**. Risk: target-name precision (`x86_64-pc-windows-msvc` vs `x86_64-pc-windows-gnu`); verification path: TC-CP-5 first matrix run on `windows-latest`.
- **`bblanchon/pdfium-binaries` Windows asset filename `pdfium-win-x64.tgz`** — symbol: asset filename for `chromium/<version>` tag scheme — source: PRD §13 `## Facts` entry at PRD line 3430 (extrapolated from the four confirmed Unix asset names) — verified: **no — assumption**. Risk: actual asset name could be `pdfium-windows-x64.tgz` or `pdfium-win-x64.zip`; verification path: TC-AAI-3 architect Step 3 pins the literal asset filename before Slice 4 ships.
- **Windows DLL naming convention `pdfium.dll` (no `lib` prefix)** — symbol: filename of the dynamic library on Windows; differs from `libpdfium.dylib` (macOS) and `libpdfium.so` (Linux) — source: PRD §13 `## Facts` entry at PRD line 3431 — verified: **no — assumption**. Risk: the iter-2 find-glob in `sdlc-knowledge-release.yml:115` searches `libpdfium*` only and would MISS `pdfium.dll`; verification path: TC-AAI-3 below grep-confirms the widened glob shape using `\( -name 'libpdfium*' -o -name 'pdfium*' \) -type f`.
- **`uname -s` shape on Git Bash for Windows runners** — symbol: typically `MINGW64_NT-10.0-22631` or similar; the `case` pattern in `install.sh:354-363` matches by exact glob — source: PRD §13 `## Facts` entry at PRD line 3432 — verified: **no — assumption**. Risk: actual `uname -ms` shape on the `windows-latest` runner under Git Bash could differ from the FR-4.1 assumption `"MINGW64_NT-* x86_64"`; verification path: TC-CP-5 done-condition records actual `uname -ms` output.
- **`git tag -a -F <file>` UTF-8 byte-preservation** — symbol: `git-tag(1)` `-F <file>` flag reads message verbatim as UTF-8 bytes — source: PRD §13 `## Facts` entry at PRD line 3433 — verified: **no — assumption**, but well-documented industry contract. Risk: locale-dependent re-encoding on rare systems; verification path: TC-13.1 multilingual round-trip.
- **GitHub Actions tag-filter glob semantics** — symbol: `on.push.tags` accepts glob patterns where `*` matches any character sequence; `sdlc-knowledge-v*` is a literal-prefix glob that does NOT match plain `v*` — source: PRD §13 `## Facts` entry at PRD line 3434 — verified: **no — assumption**, but heavily relied on by the iter-1 release workflow. Risk: tag-filter cross-firing between the two workflows; verification path: TC-AAI-1 + TC-SEC-4.1 below.
- **`git archive --format=tar.gz --prefix=<name>/ -o <file> HEAD`** — symbol: `git-archive(1)` flags producing a deterministic source tarball — source: PRD §13 `## Facts` entry at PRD line 3435 — verified: **no — assumption**, but standard git plumbing.
- **`git tag -a <name>` idempotency** — symbol: `git-tag(1)` exits non-zero with `fatal: tag '<name>' already exists` when re-run — source: PRD §13 R-6 mitigation at PRD line 3303 — verified: **no — assumption**, but well-documented industry contract.
- **`git status --porcelain` empty-output contract** — symbol: produces empty stdout on a clean working tree; non-empty stdout indicates uncommitted changes or untracked files — source: PRD §13 FR-6.2 at PRD line 3146 — verified: **no — assumption**, but standard git plumbing.
- **`git ls-remote --tags origin <pattern>`** — symbol: lists remote tags matching the pattern; empty output means no matching tag — source: §13 use-cases UC-1 preconditions at use-cases line 116 — verified: **no — assumption**, standard git plumbing.
- **`gh auth status` and `gh release view <tag> --json body --jq .body`** — symbol: GitHub CLI v2 commands — source: PRD §13 AC-3 at line 3269 — verified: **no — assumption**, GitHub CLI is the standard release-page query tool.
- **`actionlint` CLI** — symbol: `actionlint .github/workflows/*.yml` — source: §11 FR-11 inherited unchanged; §13 FR-11.2 mirrors the actionlint job — verified: yes (PRD-cite chain via §11).
- **`jq` CLI** — symbol: `jq` JSON processor used by the `register_release_bash_allowlist` install.sh function — source: PRD §13 FR-10.3 at line 3204 (inherits §11 Slice 5's jq-atomic-merge pattern) — verified: yes (PRD-cite chain).
- **Claude Code Bash allowlist `*` glob syntax** — symbol: `~/.claude/settings.json` `permissions.allow` array entries use shell-glob `*`, NOT regex anchors — source: PRD §13 FR-10.1 at line 3200 — verified: yes (PRD-cite chain via §11).
- **`pdfium-render` crate v0.9** — symbol: `Pdfium::bind_to_library(path: &Path)`, `Pdfium::bind_to_system_library` — source: §12 `## Facts → ### External contracts` (inherited unchanged in iter-3 per FR-12.7 / PRD line 3239); the iter-3 Windows binary path resolution is documented as Open Question #5 in the use-cases file — verified: yes (PRD-cite chain via §12).
- **knowledge-base CLI for §13 QA authoring** — symbol: `~/.claude/tools/sdlc-knowledge/sdlc-knowledge status --json`, `~/.claude/tools/sdlc-knowledge/sdlc-knowledge list --json`, `~/.claude/tools/sdlc-knowledge/sdlc-knowledge search "<query>" --top-k 5 --json` — source: live invocation in this session per `~/.claude/rules/knowledge-base-tool.md` — verified: yes. Multilingual mandate compliance (10 queries — 5 English, 5 Russian): status returned 28 docs / 51542 chunks; English topical probes `"release engineering test cases"`, `"GitHub Actions workflow security"`, `"bash command whitelist allowlist regex"`, `"release notes changelog automation"` returned ZERO hits each — corpus is ML/AI domain, not release-engineering literature; English deployment-pattern probe `"blue green canary deployment"` returned hits in `Practical MLOps_ Operationalizing Machine Learning Models.pdf` (chunk 534, score 30.16; chunk 1875, score 25.71; chunk 1865, score 25.20); Russian topical probes `"семантическое версионирование релиз"`, `"Windows установка PowerShell скрипт"`, `"автоматизация развертывания CI/CD"` returned ZERO hits each (last raised an FTS5 syntax error on `/`); Russian CI probe `"непрерывная интеграция тестирование"` returned hits in `Хаос_инжиниринг_2021_Кейси_Розенталь,_Нора_Джонс.pdf` (chunk 11372, score 20.62). Two load-bearing citations follow because they specifically informed the FR-1 tier-dispatch design (canary/blue-green deployment as Sensitive-tier reversibility precedent) and the AC-12 multilingual-roundtrip design (Russian-language SRE/Chaos book content as evidence the corpus carries Cyrillic technical text):
- knowledge-base: Practical MLOps_ Operationalizing Machine Learning Models.pdf:534 — query: "blue green canary deployment" — BM25: 30.156734883545273 — verified: yes
- knowledge-base: Хаос_инжиниринг_2021_Кейси_Розенталь,_Нора_Джонс.pdf:11372 — query: "непрерывная интеграция тестирование" — BM25: 20.62460256285852 — verified: yes

### Assumptions

- The architect [STRUCTURAL] action item #1 (tag-scheme disambiguation logic in `release-engineer.md`) requires that the agent prompt contain explicit decision logic distinguishing `sdlc-knowledge-v*` from bare `v*` based on which version-source file changed (e.g., `tools/sdlc-knowledge/Cargo.toml` change → tool train; root `package.json` / `pyproject.toml` / `Cargo.toml` / `VERSION` change → core train). Risk: if the prompt does NOT explicitly enumerate this dispatch logic, the maintainer at FR-11.5 cannot mechanically pre-approve the tier rationale; verification: TC-AAI-1 below grep-confirms the literal disambiguation block presence.
- The architect [STRUCTURAL] action item #2 (FR-12.7 templates scope wording) clarifies that the `templates/rules/*` byte-unchanged invariant scopes to the SHIP-TO-DOWNSTREAM templates (`templates/rules/changelog.md`, `templates/rules/architecture.md`, `templates/rules/security.md`, `templates/rules/testing.md`) and DOES NOT apply to the SDLC core's own runtime `.claude/rules/` directory (which gains `auto-release.md` and `changelog.md` per FR-7.1 / FR-7.2 — these are dogfood opt-ins, not templates). NEW files added under `templates/rules/` per FR-12.5 (specifically `templates/rules/auto-release.md`) are NEW files, not modifications. Risk: confusion between `templates/rules/*` (downstream-shipped) and `.claude/rules/*` (SDLC core's own runtime) breaks the byte-unchanged grep at TC-INV-7; verification: TC-AAI-2 below documents the wording in the planner's plan.md and the TC-INV-7 expected result enumerates exactly the 4 byte-unchanged template files.
- The architect [STRUCTURAL] action item #3 (find-glob `-o` operator) requires the GitHub Actions Windows step at `sdlc-knowledge-release.yml:115` use the `find ... \( -name 'libpdfium*' -o -name 'pdfium*' \) -type f` POSIX-portable syntax (NOT the Bash-only `-name 'libpdfium*' -name 'pdfium*'` which is a logical AND, not OR; and NOT the GNU-only `-o` without parentheses-grouping which has operator-precedence quirks). Risk: incorrect glob syntax silently matches zero files on Windows runners; verification: TC-AAI-3 below greps the workflow file for the literal `\(` and `-o` tokens.
- The architect MAJOR action item #4 (FR-1.1 stale evidence — release-engineer.md already has Bash) is RESOLVED: `tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]` is already on `release-engineer.md:4` before any iter-3 edits — verified by Read in this session. Risk: the prompt body at lines 12, 16, 30, and 63 currently states "no Bash tool" / "via tool removal" which is contract-drift between frontmatter and body; FR-1.1 is therefore a documentation accuracy edit to the body, not a frontmatter change. Verification: TC-AAI-4 below asserts byte-unchanged frontmatter via `grep -nF "tools: [\"Read\", \"Write\", \"Edit\", \"Glob\", \"Grep\", \"Bash\"]" src/agents/release-engineer.md`.
- The architect MINOR action item #5 (KB corpus is ML — informational, no DevOps reference indexed) is INFORMATIONAL ONLY: TC-AAI-5 below records this as an iter-4 corpus-enrichment open question with no test action this iter. The 10 multilingual KB queries logged above (4 EN + 4 RU + 2 deployment-pattern hits) document the gap.
- The opt-out backward-compat baseline for AC-8 / TC-16.1 is captured by running `/merge-ready` Gate 9 on a downstream project WITHOUT `.claude/rules/auto-release.md` BEFORE iter-3 ships and recording the §6 reference output (structured 10-section summary; no Bash; no tag); the post-iter-3 run is byte-diffed against this baseline. Risk: §6 reference output drift between captures; verification: TC-16.1 records the baseline-capture timestamp in test artifacts.
- The opt-out backward-compat invariant assumes the absence of `.claude/rules/auto-release.md` is a SUFFICIENT signal for suggest-only behavior — i.e., even with `Bash` in `release-engineer.md` frontmatter `tools:`, the agent self-restricts from invoking Bash when the sentinel is absent. Risk: the iter-3 Bash gain in the frontmatter could leak executing-mode behavior into opt-out projects; verification: TC-16.1 explicitly grep-asserts `Bash` does NOT appear in the agent's stdout for the opt-out run.
- TC-INV-8 verifies `install.sh:25 REPO_URL` is now `codefather-labs/claude-code-sdlc.git` (CHANGED in iter-3 — fix). Risk: line number could shift if upstream lines are inserted between current line 25 and the iter-3 merge; verification: TC-INV-8 grep-asserts the literal value at any `^REPO_URL=` line, not specifically line 25, to absorb line-number drift.
- The Sensitive-tier `git push origin main` blast-radius (UC-14, TC-14.1) inherits the §13 R-1 mitigation (triple defense: tier classification + whitelist + headless deny). Risk: a misclassified row would bypass the prompt; verification: TC-14.1 exercises the Sensitive prompt fires AND TC-SEC-1.x asserts the row appears in the FR-1.2 table at the correct severity.
- TC-13.1 multilingual round-trip uses Cyrillic Russian content per AC-12 (PRD line 3287); the byte-roundtrip property generalizes to any UTF-8 multibyte content (CJK, Arabic, emoji), but the test uses Russian to align with the PRD's literal example.
- The headless-mode test (UC-4 / TC-4.1) sets `AUTO_RELEASE=1` exactly as a literal string `1` per FR-1.4 PRD line 3057 (NOT `true`, NOT `yes`, NOT `TRUE`); the test exercises a value-other-than-`1` (e.g., `AUTO_RELEASE=true`) and asserts the agent operates in interactive mode per FR-1.4 PRD line 3063.
- TC-CP-5 (Windows install) depends on the FIRST `sdlc-knowledge-v0.2.0` tag existing at the GitHub remote (per UC-1) — without the tag, the prebuilt-binary path 404s and falls through to `cargo_source_build_fallback` per UC-11. The test orders TC-CP-5 to run AFTER TC-1.1 (bootstrap) succeeds in the post-iter-3 release, so the asset URL resolves.

### Open questions

- **Knowledge-base direct topical searches on `"release engineering test cases"`, `"GitHub Actions workflow security"`, `"bash command whitelist allowlist regex"`, `"release notes changelog automation"` returned ZERO hits each across the 28-book ML/AI corpus.** Per the knowledge-base multilingual mandate this is a documented negative result, not a silent skip. Action: TC-AAI-5 records this as iter-4 KB corpus enrichment item. Suggested additions for iter-4: the `git-tag(1)` manpage, the GitHub Actions release-management docs, the Keep a Changelog spec, the Semantic Versioning 2.0.0 spec. No action required for iter-3 — the source-of-truth for iter-3 is the PRD, the existing `release-engineer.md` agent prompt, and the `resource-architect` tier-model precedent.
- **TC-AAI-3 architect Step 3 picks the exact `bblanchon/pdfium-binaries` Windows asset filename** (`pdfium-win-x64.tgz` vs `pdfium-windows-x64.tgz` vs `.zip`). Status: documented in `.claude/plan.md` Slice 4 spec as a tracking item gated by TC-AAI-3.
- **TC-AAI-4 release-engineer Bash already-present** is RESOLVED — `Bash` confirmed in `release-engineer.md:4` in this session. The TC verifies no regression (the frontmatter is BYTE-UNCHANGED through iter-3 edits).
- **Open Question #1 (use-cases) — release-engineer prompt-body vs frontmatter contract drift.** Status: described in PRD `## Facts` Open Question #1 (PRD line 3453). RESOLUTION: FR-1.1 documentation accuracy fix; TC-AAI-4 verifies frontmatter unchanged; the prompt-body rewrite is exercised by TC-2.1 / TC-3.1 etc.
- **Open Question #2 (use-cases) — `bblanchon/pdfium-binaries` Windows asset filename.** Status: tracked by TC-AAI-3.
- **Open Question #3 (use-cases) — `softprops/action-gh-release@v2` `body_path` resolution edge case (file gitignored).** Status: covered by TC-2.1 done-condition (the file MUST be committed before tag-push).
- **TC-CP-5 Windows install** depends on the first `sdlc-knowledge-v0.2.0` tag existing at GitHub. Verification path: TC-CP-5 ordered AFTER TC-1.1 in the test execution graph; pre-bootstrap, TC-CP-5 is expected to fall through to `cargo_source_build_fallback` per UC-11.

---

**Note:** The auto-release pipeline is a markdown agent prompt update + bash installer additions + GitHub Actions workflow expansion. "Testing" this feature combines (a) shell-level tests of `install.sh` flags and functions, (b) markdown-file invariant checks via `git diff` / `wc -l` / `grep -F`, (c) static workflow-file inspection via `actionlint` + `grep`, (d) integration tests of the `release-engineer` agent against canned inputs (mock CHANGELOG bodies; mock environment variables), and (e) end-to-end tests against a sacrificial `.git` clone with mocked `origin` remote. Test types are tagged per case (`unit`, `integration`, `E2E`, `cross-platform`, `security`).

---

## Use Case Coverage

Every UC-N (and its variants) and UC-CC-N from `docs/use-cases/auto-release_use_cases.md` maps to one or more test cases below.

| UC | Scenario | Test Cases |
|----|----------|------------|
| UC-1 | Maintainer cuts FIRST `sdlc-knowledge-v0.2.0` release via `--bootstrap-release` | TC-1.1 |
| UC-1-A1 | Bootstrap re-run when tag already exists at remote | TC-1.2 |
| UC-1-E1 | Bootstrap pre-condition failure: dirty working tree | TC-1.3 |
| UC-1-E2 | Bootstrap pre-condition failure: version mismatch | TC-1.4 |
| UC-1-E3 | Bootstrap user declines the FR-6.5 push prompt | TC-1.5 |
| UC-1-EC1 | Bootstrap on a branch other than `main` | TC-1.6 |
| UC-2 | Maintainer cuts FIRST SDLC core `v3.0.0` tag via `/merge-ready` Gate 9 | TC-2.1 |
| UC-2-A1 | First-run sentinel absent → suggest-only fallback | TC-2.2 |
| UC-2-E1 | Pre-push validation fails (typecheck/test) | TC-2.3 |
| UC-3 | Downstream `/merge-ready` → executing-mode → tag → push → workflow | TC-3.1 |
| UC-3-A1 | CHANGELOG `[Unreleased]` only `Removed` → MAJOR bump | TC-3.2 |
| UC-3-A2 | Pre-1.0 override (`major=0`) → MAJOR demoted to MINOR | TC-3.3 |
| UC-3-E1 | `gh` CLI absent → suggest-only fallback | TC-3.4 |
| UC-3-E2 | GitHub auth missing → push fails → revert local tag | TC-3.5 |
| UC-3-EC1 | Tag-format collision (project uses `v*` for non-semver dates) | TC-3.6 |
| UC-4 | CI bot `/merge-ready` with `AUTO_RELEASE=1` (headless) | TC-4.1 |
| UC-4-EC1 | Headless mode + sentinel absent → opt-out wins | TC-4.2 |
| UC-5 | `install.sh` on darwin-arm64 prebuilt-binary download | TC-5.1, TC-CP-1 |
| UC-6 | `install.sh` on linux-x64 prebuilt-binary download | TC-CP-3 |
| UC-7 | `install.sh` on linux-arm64 prebuilt-binary download | TC-CP-4 |
| UC-8 | `install.sh` on darwin-x64 prebuilt-binary download | TC-CP-2 |
| UC-9 | `install.sh` on windows-x64 (NEW) prebuilt-binary download | TC-CP-5, TC-9.1 |
| UC-9-E1 | `windows-latest` runner timeout (>15 min) | TC-9.2 |
| UC-9-EC1 | Windows path: `C:/Users/runneradmin/.claude/...` resolves | TC-9.3 |
| UC-9-EC2 | Windows pdfium.dll naming (no `lib` prefix) | TC-9.4, TC-AAI-3 |
| UC-10 | `install.sh` on FreeBSD (unsupported) → cargo fallback | TC-10.1 |
| UC-11 | `install.sh` when GH Releases unreachable → cargo fallback | TC-11.1 |
| UC-12 | `install.sh:25 REPO_URL` Koroqe → codefather-labs fix | TC-12.1, TC-INV-8 |
| UC-13 | Multilingual project: Russian CHANGELOG → tag → GH Release | TC-13.1 |
| UC-13-E1 | Mixed-language CHANGELOG (RU + EN) → byte-preserved | TC-13.2 |
| UC-14 | Sensitive-tier `git push origin main` halt + prompt + execute | TC-14.1 |
| UC-14-E1 | User declines Sensitive operation → preserve local tag | TC-14.2 |
| UC-15 | Forbidden tier blocks `npm publish` / `cargo publish` / `gh release create` | TC-15.1, TC-15.2, TC-15.3 |
| UC-16 | Backward compat: no sentinel → suggest-only byte-for-byte | TC-16.1 |
| UC-17 | Concurrent `/merge-ready` → tag-collision detected | TC-17.1 |
| UC-17-E1 | Tag collision after retry → escalate to user | TC-17.2 |
| UC-CC-1 | Tier dispatch matches resource-architect contract verbatim | TC-CC-1.1, TC-SEC-1.x |
| UC-CC-2 | Multilingual CHANGELOG roundtrip (UTF-8 end-to-end) | TC-CC-2.1, TC-13.1 |
| UC-CC-3 | Cross-platform install matrix (5 platforms) | TC-CP-1 through TC-CP-5 |
| UC-CC-4 | Invariants — 17 agents / 10 gates / 5 executors / taglines unchanged | TC-INV-1 through TC-INV-10 |
| UC-CC-5 | SDLC core dogfooding — `.claude/rules/changelog.md` + `auto-release.md` + `CHANGELOG.md` | TC-CC-5.1 |
| UC-CC-6 | Backward compat — opt-out byte-for-byte preservation | TC-16.1 |

---

## AC Coverage

Every AC-1 through AC-13 from PRD §13.5 maps to one or more test cases below.

| AC | Description | Test Cases |
|----|-------------|------------|
| AC-1 | Local tag creation works under release-engineer executing mode (≤ 30 s) | TC-2.1, TC-3.1, TC-CC-1.1 |
| AC-2 | Tag push fires the GH Actions release workflow within 5 min | TC-1.1, TC-2.1, TC-3.1 |
| AC-3 | GitHub Release body matches CHANGELOG body byte-for-byte | TC-1.1, TC-2.1, TC-13.1, TC-CC-2.1 |
| AC-4 | Five-platform binary matrix produces 5 binaries + source tarball | TC-1.1, TC-CP-1 through TC-CP-5, TC-9.1 |
| AC-5 | `install.sh` prebuilt-binary download succeeds on each platform (≤ 60 s) | TC-CP-1 through TC-CP-5, TC-5.1 |
| AC-6 | `install.sh` fallback works when release missing → cargo build | TC-10.1, TC-11.1 |
| AC-7 | Headless CI mode skips Sensitive operations | TC-4.1, TC-4.2 |
| AC-8 | Opt-out backward compatibility | TC-2.2, TC-3.4, TC-4.2, TC-16.1 |
| AC-9 | REPO_URL fixed end-to-end (`grep -r 'Koroqe' .` returns 0) | TC-12.1, TC-INV-8 |
| AC-10 | SDLC core CHANGELOG.md present and dated `[3.0.0] - 2026-04-26` | TC-CC-5.1 |
| AC-11 | Release-engineer tier dispatch — verified per-tier counts | TC-CC-1.1, TC-14.1, TC-14.2, TC-15.1 |
| AC-12 | Multilingual CHANGELOG round-trips byte-for-byte | TC-13.1, TC-13.2, TC-CC-2.1 |
| AC-13 | Invariants preserved (17 agents / 10 gates / 5 executors / taglines / cognitive-self-check) | TC-INV-1 through TC-INV-10 |

---

## Test Cases

## 1. UC-1: Maintainer Cuts FIRST `sdlc-knowledge-v0.2.0` Release via One-Shot Bootstrap

### TC-1.1: Bootstrap happy path produces local + remote tag, fires workflow, publishes 6-asset Release page
- **Category:** Bootstrap / Happy Path
- **Mapped UC:** UC-1
- **Mapped FR:** FR-6.1, FR-6.2, FR-6.3, FR-6.4, FR-6.5, FR-3.1, FR-3.5, FR-3.6, FR-3.7, FR-2.1, FR-2.3, FR-11.4
- **Mapped AC:** AC-2, AC-3, AC-4
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** Sacrificial fork of `codefather-labs/claude-code-sdlc` with iter-3 merged (FR-3 through FR-7 + FR-11 land); clean working tree; `tools/sdlc-knowledge/Cargo.toml:3` declares `version = "0.2.0"`; `gh auth status` returns logged-in; no `sdlc-knowledge-v0.2.0` tag exists locally OR remotely; `.github/workflows/sdlc-knowledge-release.yml` is on the branch being tagged
- **Inputs:** `bash install.sh --bootstrap-release 0.2.0`
- **Steps:**
  1. Snapshot `git tag -l 'sdlc-knowledge-v0.2.0'` (expect empty)
  2. Snapshot `git ls-remote --tags origin 'sdlc-knowledge-v0.2.0'` (expect empty)
  3. Snapshot `git status --porcelain` (expect empty)
  4. Run `bash install.sh --bootstrap-release 0.2.0`; capture stdout, stderr, exit code; respond literal `y\n` to the FR-6.5 push prompt
  5. Verify stderr contains the literal `[BOOTSTRAP] this is a one-time first-release operation; subsequent releases use /merge-ready Gate 9 with release-engineer in executing mode (FR-1)`
  6. Verify stderr contains the literal prompt `[BOOTSTRAP] About to execute: git push origin sdlc-knowledge-v0.2.0 — this fires the GH Actions release workflow at .github/workflows/sdlc-knowledge-release.yml. Approve? [y/N]:`
  7. Verify exit code 0
  8. Verify `git tag -l 'sdlc-knowledge-v0.2.0'` returns the literal tag
  9. Verify `git cat-file tag sdlc-knowledge-v0.2.0` shows the annotation message identical to `.claude/release-notes-0.2.0.md` byte-for-byte
  10. Verify `git ls-remote --tags origin 'sdlc-knowledge-v0.2.0'` non-empty
  11. Wait up to 5 min; verify `gh run list --workflow=sdlc-knowledge-release.yml --limit 1 --json status,conclusion --jq '.[0].status'` shows `completed` and `conclusion` is `success`; total elapsed ≤ 15 min per NFR-5
  12. Verify `gh release view sdlc-knowledge-v0.2.0 --json assets --jq '[.assets[].name]'` returns exactly the 6-element array `["sdlc-knowledge-darwin-arm64", "sdlc-knowledge-darwin-x64", "sdlc-knowledge-linux-arm64", "sdlc-knowledge-linux-x64", "sdlc-knowledge-source-0.2.0.tar.gz", "sdlc-knowledge-windows-x64.exe"]` (any sort order)
  13. Verify each asset size > 0 via `gh release view sdlc-knowledge-v0.2.0 --json assets --jq '[.assets[].size]'`
  14. Verify `gh release view sdlc-knowledge-v0.2.0 --json body --jq .body` equals `cat .claude/release-notes-0.2.0.md` byte-for-byte
- **Expected Result:** All 14 steps succeed; tag exists locally + remotely; workflow fires; 6 assets published; Release body equals release-notes file byte-for-byte
- **Pass Criteria:** AC-2 (workflow fires), AC-3 (body matches), AC-4 (5 binaries + source tarball) all satisfied

### TC-1.2: Bootstrap re-run after successful first run exits clean with "tag already exists"
- **Category:** Bootstrap / Idempotency
- **Mapped UC:** UC-1-A1
- **Mapped FR:** FR-6.2, FR-6.4
- **Type:** integration
- **Severity:** P1
- **Preconditions:** TC-1.1 has succeeded; `sdlc-knowledge-v0.2.0` tag exists locally + remotely
- **Inputs:** `bash install.sh --bootstrap-release 0.2.0` (second run)
- **Steps:**
  1. Run `bash install.sh --bootstrap-release 0.2.0`
  2. Capture exit code + stderr
  3. Verify stderr contains a clear message including the substrings `tag already exists` AND `subsequent releases use /merge-ready, not --bootstrap-release`
  4. Verify exit code 1
  5. Verify NO new commit, no tag mutation, no remote push (compare `git rev-parse HEAD` and `git ls-remote origin sdlc-knowledge-v0.2.0` against TC-1.1 post-state)
- **Expected Result:** Exit 1; clear stderr; no state mutation
- **Pass Criteria:** Idempotent abort

### TC-1.3: Bootstrap pre-condition failure — dirty working tree
- **Category:** Bootstrap / Pre-condition Failure
- **Mapped UC:** UC-1-E1
- **Mapped FR:** FR-6.2 (b)
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Working tree has uncommitted changes (e.g., touch `dirt.txt`); `--bootstrap-release` not yet run
- **Inputs:** `bash install.sh --bootstrap-release 0.2.0`
- **Steps:**
  1. `touch dirt.txt` to make `git status --porcelain` non-empty
  2. Run `bash install.sh --bootstrap-release 0.2.0`
  3. Capture exit code + stderr
  4. Verify stderr identifies the dirty path (`dirt.txt`)
  5. Verify exit code 1
  6. Verify no tag created (`git tag -l 'sdlc-knowledge-v0.2.0'` empty)
  7. Verify no `.claude/release-notes-0.2.0.md` written
  8. `rm dirt.txt`
- **Expected Result:** Exit 1; offending path identified; no state mutation
- **Pass Criteria:** FR-6.2 (b) clean-tree precondition enforced

### TC-1.4: Bootstrap pre-condition failure — version mismatch with `Cargo.toml`
- **Category:** Bootstrap / Pre-condition Failure
- **Mapped UC:** UC-1-E2
- **Mapped FR:** FR-6.2 (c)
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Working tree clean; `tools/sdlc-knowledge/Cargo.toml:3` declares `version = "0.2.0"`
- **Inputs:** `bash install.sh --bootstrap-release 9.9.9`
- **Steps:**
  1. Run `bash install.sh --bootstrap-release 9.9.9`
  2. Capture exit code + stderr
  3. Verify stderr contains both `9.9.9` and `0.2.0` (identifying the mismatch) and the substring `tools/sdlc-knowledge/Cargo.toml`
  4. Verify exit code 1
  5. Verify no tag, no release-notes file
- **Expected Result:** Exit 1; mismatch identified; no state mutation
- **Pass Criteria:** FR-6.2 (c) version-match precondition enforced

### TC-1.5: Bootstrap user declines push prompt — local tag preserved, remote unchanged
- **Category:** Bootstrap / User Decline
- **Mapped UC:** UC-1-E3
- **Mapped FR:** FR-6.5
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Clean working tree; no `sdlc-knowledge-v0.2.0` tag locally or remotely
- **Inputs:** `bash install.sh --bootstrap-release 0.2.0` with stdin replying `n\n` to the FR-6.5 prompt
- **Steps:**
  1. Run `bash install.sh --bootstrap-release 0.2.0` and respond literal `n\n` to the prompt
  2. Capture exit code + stderr
  3. Verify stderr contains the substrings `bootstrap aborted by user`, `local tag preserved at sdlc-knowledge-v0.2.0`, `git push origin sdlc-knowledge-v0.2.0`
  4. Verify exit code 0 (user declination is not an error per FR-1.5 deny semantics)
  5. Verify `git tag -l 'sdlc-knowledge-v0.2.0'` non-empty (local tag preserved)
  6. Verify `git ls-remote --tags origin 'sdlc-knowledge-v0.2.0'` empty (remote unchanged)
  7. Cleanup: `git tag -d sdlc-knowledge-v0.2.0`
- **Expected Result:** Exit 0; local tag preserved; remote unchanged; clear remediation guidance in stderr
- **Pass Criteria:** FR-6.5 deny semantics observed

### TC-1.6: Bootstrap on a non-`main` branch tags HEAD of that branch
- **Category:** Bootstrap / Edge Case
- **Mapped UC:** UC-1-EC1
- **Mapped FR:** FR-6.2 (a)
- **Type:** integration
- **Severity:** P3
- **Preconditions:** Clean working tree; on a feature branch `feat/test-bootstrap-1.6`
- **Inputs:** `bash install.sh --bootstrap-release 0.2.0` from the feature branch
- **Steps:**
  1. `git checkout -b feat/test-bootstrap-1.6`
  2. Run `bash install.sh --bootstrap-release 0.2.0`; respond `n\n` to the push prompt to avoid actually pushing
  3. Verify the local tag points at `git rev-parse HEAD` (which is the feature-branch tip, not main)
  4. Cleanup: `git tag -d sdlc-knowledge-v0.2.0; git checkout main; git branch -D feat/test-bootstrap-1.6`
- **Expected Result:** Bootstrap proceeds without enforcing branch identity; the maintainer is responsible for the branch
- **Pass Criteria:** FR-6.2 (a) heuristic checks Cargo.toml + .git only; branch identity not enforced

---

## 2. UC-2: Maintainer Cuts FIRST SDLC Core `v3.0.0` via `/merge-ready` Gate 9

### TC-2.1: `/merge-ready` Gate 9 with auto-release sentinel produces local tag, fires `sdlc-core-release.yml`
- **Category:** /merge-ready / Happy Path
- **Mapped UC:** UC-2
- **Mapped FR:** FR-1.1 through FR-1.8, FR-7.1 through FR-7.6, FR-11.2
- **Mapped AC:** AC-1, AC-10, AC-11
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** SDLC core repo with iter-3 merged (post TC-1.1); `.claude/rules/auto-release.md` exists per FR-7.2; `.claude/rules/changelog.md` exists per FR-7.1; `CHANGELOG.md` exists at repo root with `[Unreleased]` containing entries; `install.sh:22 VERSION="3.0.0"` and `install.sh:25 REPO_URL="https://github.com/codefather-labs/claude-code-sdlc.git"`; clean working tree; `gh auth status` logged-in; no `v3.0.0` tag exists
- **Inputs:** `/merge-ready` orchestration triggers Gate 9 release-engineer
- **Steps:**
  1. Run `/merge-ready`; capture release-engineer agent stdout (the structured 10-section summary plus tier breakdown)
  2. Respond literal `y\n` to each FR-1.5 Sensitive-tier prompt for `git push origin <branch>` and `git push origin v3.0.0`
  3. Record start time `T0`; record time when local tag is created `T_tag`; verify `T_tag - T0 ≤ 30 s` per NFR-1
  4. Verify `git tag -l 'v3.0.0'` returns the tag
  5. Verify `git cat-file tag v3.0.0` annotation message equals `.claude/release-notes-3.0.0.md` byte-for-byte
  6. Verify `git log -1 --pretty=%s HEAD~1` matches the regex `^chore\(release\): 3\.0\.0$`
  7. Verify `CHANGELOG.md` no longer contains `## [Unreleased]` content (it should be empty `[Unreleased]` followed by `## [3.0.0] - 2026-04-26 — Auto-Release Pipeline`)
  8. Verify `git ls-remote --tags origin 'v3.0.0'` non-empty
  9. Wait up to 5 min; verify `gh run list --workflow=sdlc-core-release.yml --limit 1 --json status,conclusion --jq '.[0].status'` shows `completed` + `success`
  10. Verify `gh release view v3.0.0 --json assets --jq '[.assets[].name]'` returns at minimum `["claude-code-sdlc-3.0.0.tar.gz", "install.sh"]`
  11. Verify the agent's structured summary contains a `Tier breakdown` line matching the regex `^Tier breakdown: \d+ Trivial; \d+ Moderate; \d+ Sensitive \(auto-approved\); \d+ Sensitive \(skipped\); \d+ Forbidden \(refused\)$`
  12. Verify the agent's structured summary's `Commands to run` section indicates which commands were EXECUTED in the current run (per FR-1.8)
- **Expected Result:** Local tag in ≤ 30 s; CHANGELOG dated; release-notes written; commit + tag + branch push + tag push all succeed; sdlc-core-release.yml fires; tier breakdown emitted
- **Pass Criteria:** AC-1, AC-10, AC-11 satisfied

### TC-2.2: First-run sentinel absent — release-engineer falls back to suggest-only
- **Category:** /merge-ready / Backward Compat
- **Mapped UC:** UC-2-A1
- **Mapped FR:** FR-7.3, FR-9.4, NFR-3
- **Mapped AC:** AC-8
- **Type:** integration
- **Severity:** P0
- **Preconditions:** Test project WITHOUT `.claude/rules/auto-release.md`; `CHANGELOG.md` exists with non-empty `[Unreleased]`
- **Inputs:** `/merge-ready` invocation
- **Steps:**
  1. Confirm `test -f .claude/rules/auto-release.md` returns non-zero
  2. Run `/merge-ready`; capture release-engineer agent stdout
  3. Verify the structured 10-section summary is emitted
  4. Verify NO `Tier breakdown` line is present
  5. Verify the agent's stdout does NOT contain the substring `[Sensitive — release-engineer]` (no Sensitive prompt fired)
  6. Verify NO `git tag` command was executed (`git tag -l` returns the same set as before)
  7. Verify NO `git push` command was executed (compare `git ls-remote --tags origin` before/after)
  8. Verify NO commit was created (`git rev-parse HEAD` unchanged)
- **Expected Result:** Suggest-only behavior; no Bash invocation; no tag; structured summary preserved
- **Pass Criteria:** AC-8 backward-compat satisfied via sentinel-absence

### TC-2.3: Pre-push validation fails (typecheck non-zero) — push aborted, local tag preserved
- **Category:** /merge-ready / Pre-Push Validation
- **Mapped UC:** UC-2-E1
- **Mapped FR:** FR-8.1, FR-8.2
- **Type:** integration
- **Severity:** P0
- **Preconditions:** Project with `./CLAUDE.md` `## Commands` block declaring `Typecheck: tsc --noEmit`; `.claude/rules/auto-release.md` present; CHANGELOG `[Unreleased]` non-empty; project has a deliberately-injected type error
- **Inputs:** `/merge-ready` invocation
- **Steps:**
  1. Inject a TypeScript error in `src/main.ts` (e.g., `const x: number = "string";`)
  2. Run `/merge-ready`; respond `y\n` to the Sensitive-tier prompts
  3. Capture stderr; verify it contains the regex `^pre-push validation failed: tsc --noEmit exited [1-9]\d*$`
  4. Verify NO `git push` was executed (`git ls-remote --tags origin v<X.Y.Z>` empty)
  5. Verify the local annotated tag DOES exist (`git tag -l 'v<X.Y.Z>'` non-empty) — the local artifact is PRESERVED per FR-8.2
  6. Verify the CHANGELOG `[X.Y.Z]` rename DID happen (the local mutation persisted)
  7. Cleanup: revert the type error; cleanup the local tag
- **Expected Result:** Pre-push validation aborts the push; local artifacts preserved; clear error message
- **Pass Criteria:** FR-8.2 abort-with-preserve semantics observed

---

## 3. UC-3: Downstream Developer `/merge-ready` Run Through Gate 9

### TC-3.1: Downstream `/merge-ready` happy path — feature branch → tag → push → workflow
- **Category:** /merge-ready / Downstream Happy Path
- **Mapped UC:** UC-3
- **Mapped FR:** FR-1.1 through FR-1.8, FR-2.1 through FR-2.4, FR-7.3, FR-8.1
- **Mapped AC:** AC-1, AC-2, AC-3, AC-11
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** Downstream project WITH `.claude/rules/auto-release.md` (installed by `bash install.sh --init-project`); on a feature branch with non-empty CHANGELOG `[Unreleased]`; `./CLAUDE.md` `## Commands` block present; `gh auth status` logged-in
- **Inputs:** `/merge-ready` invocation
- **Steps:**
  1. Run `/merge-ready`; respond `y\n` to each Sensitive-tier prompt
  2. Verify CHANGELOG dated section now reads `## [<X.Y.Z>] - <today>`
  3. Verify `.claude/release-notes-<X.Y.Z>.md` exists and contains the body of the dated section verbatim (no `## [<X.Y.Z>] - <today>` heading)
  4. Verify local tag exists: `git tag -l 'v<X.Y.Z>'`
  5. Verify pre-push validation ran: stdout contains lines matching the project's typecheck/test/lint commands per FR-8.1
  6. Verify `git push origin <feature-branch>` succeeded
  7. Verify `git push origin v<X.Y.Z>` succeeded
  8. Verify the GH Actions workflow fires within 5 min (per AC-2)
  9. Verify the GH Release body matches `.claude/release-notes-<X.Y.Z>.md` byte-for-byte (per AC-3)
- **Expected Result:** Full pipeline executes end-to-end; CHANGELOG body, tag annotation, and Release body all match byte-for-byte
- **Pass Criteria:** AC-1, AC-2, AC-3, AC-11 satisfied

### TC-3.2: CHANGELOG `[Unreleased]` only `Removed` entries → MAJOR bump
- **Category:** /merge-ready / Version Bump Logic
- **Mapped UC:** UC-3-A1
- **Mapped FR:** FR-1.2 (Trivial CHANGELOG rewrite, inheriting §6 FR-2)
- **Mapped AC:** AC-1
- **Type:** integration
- **Severity:** P1
- **Preconditions:** CHANGELOG `[Unreleased]` body contains ONLY a `### Removed` section (no `### Added`, no `### Changed`); current version is `2.5.3`
- **Inputs:** `/merge-ready`
- **Steps:**
  1. Run `/merge-ready`; capture release-engineer stdout
  2. Verify the proposed new version is `3.0.0` (MAJOR bump triggered by `Removed` per Keep-a-Changelog + §6 FR-2)
  3. Verify the FR-1.5 Sensitive prompt for `git tag -a v3.0.0 -F .claude/release-notes-3.0.0.md` is emitted
- **Expected Result:** MAJOR bump; new version `3.0.0`
- **Pass Criteria:** AC-1 plus §6 FR-2 inherited contract

### TC-3.3: Pre-1.0 override — `Cargo.toml` major=0 → MAJOR demoted to MINOR
- **Category:** /merge-ready / Version Bump Logic
- **Mapped UC:** UC-3-A2
- **Mapped FR:** FR-1.2 (Moderate version-source bump)
- **Mapped AC:** AC-1
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Project's version source declares `0.5.3` (pre-1.0); CHANGELOG `[Unreleased]` has `### Removed` entries
- **Inputs:** `/merge-ready`
- **Steps:**
  1. Run `/merge-ready`
  2. Verify proposed new version is `0.6.0` (MINOR bump, NOT `1.0.0`) per the §6 pre-1.0 override
- **Expected Result:** Demotion to MINOR for pre-1.0 versions
- **Pass Criteria:** AC-1 plus §6 pre-1.0 inheritance

### TC-3.4: `gh` CLI absent — release-engineer falls back to suggest-only
- **Category:** /merge-ready / Tool Missing
- **Mapped UC:** UC-3-E1
- **Mapped FR:** FR-1.4, NFR-3
- **Mapped AC:** AC-8
- **Type:** integration
- **Severity:** P2
- **Preconditions:** `command -v gh` returns non-zero (PATH masks `gh`); `.claude/rules/auto-release.md` present
- **Inputs:** `/merge-ready`
- **Steps:**
  1. Mask `gh`: `PATH=$(echo "$PATH" | sed 's|/path/to/gh:||')`
  2. Run `/merge-ready`; capture stdout/stderr
  3. Verify stderr contains a warning identifying `gh` as missing
  4. Verify the agent falls back to suggest-only output (no Bash invocations executed; structured 10-section summary emitted)
- **Expected Result:** Graceful degradation to suggest-only; clear remediation guidance
- **Pass Criteria:** AC-8 graceful-degradation path

### TC-3.5: GitHub auth missing → `git push` fails → revert local tag, fall back to suggest-only
- **Category:** /merge-ready / Auth Failure
- **Mapped UC:** UC-3-E2
- **Mapped FR:** FR-1.2 (Sensitive-tier reversibility), FR-8.2
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Network reachable but git remote auth fails (e.g., `GIT_ASKPASS=/usr/bin/false`)
- **Inputs:** `/merge-ready`; respond `y\n` to Sensitive prompts
- **Steps:**
  1. Run `/merge-ready` with auth deliberately broken
  2. Verify the local tag was created
  3. Verify the `git push origin v<X.Y.Z>` failed with non-zero exit
  4. Verify the agent emits an FR-1.5 Reversibility line indicating `git tag -d <tag>` is the recovery
  5. Verify the local tag is REVERTED automatically OR the user is prompted with the recovery command
- **Expected Result:** Push fails cleanly; recovery path surfaced; no remote mutation
- **Pass Criteria:** Recovery path documented per FR-1.5

### TC-3.6: Tag-format collision — project uses `v*` for non-semver dates → release-engineer refuses
- **Category:** /merge-ready / Tag Format
- **Mapped UC:** UC-3-EC1
- **Mapped FR:** FR-1.3 (anchored-regex whitelist), FR-11.4
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Project has historical tags like `v2025-01-01` (non-semver); CHANGELOG opt-in present
- **Inputs:** `/merge-ready` proposes a date-tag like `v2026-04-25` instead of semver
- **Steps:**
  1. Run `/merge-ready`
  2. Verify the agent REFUSES the non-semver tag with the literal stderr `error: command not in release-engineer whitelist: <command>` per FR-1.3
  3. Verify exit code reflects the refusal
- **Expected Result:** Anchored-regex `^git tag -a (sdlc-knowledge-)?v[0-9]+\.[0-9]+\.[0-9]+ -F \.claude/release-notes-[0-9]+\.[0-9]+\.[0-9]+\.md$` REJECTS the date-format tag
- **Pass Criteria:** FR-1.3 whitelist refusal contract

---

## 4. UC-4: CI Bot Runs `/merge-ready` with `AUTO_RELEASE=1` (Headless)

### TC-4.1: Headless mode executes Trivial + Moderate, refuses Sensitive with literal stderr + exit 0
- **Category:** Headless / Happy Path
- **Mapped UC:** UC-4
- **Mapped FR:** FR-1.4, FR-9.1, FR-9.2, FR-9.3
- **Mapped AC:** AC-7
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** Project with `.claude/rules/auto-release.md` opted-in; `AUTO_RELEASE=1` set; non-empty CHANGELOG `[Unreleased]`; no interactive TTY (run via subshell with `< /dev/null`)
- **Inputs:** `AUTO_RELEASE=1 /merge-ready < /dev/null`
- **Steps:**
  1. Verify `AUTO_RELEASE=1` (literal `1`, not `true`)
  2. Run `/merge-ready` headless; capture stdout/stderr/exit code
  3. Verify exit code 0 (NOT 1 — headless skip is not an error per FR-1.4)
  4. Verify CHANGELOG was renamed (Trivial executed)
  5. Verify `.claude/release-notes-<X.Y.Z>.md` exists (Trivial executed)
  6. Verify version-source file was bumped (Moderate executed without prompt — `AUTO_RELEASE=1` is implicit batch approval)
  7. Verify local annotated tag exists (Moderate executed)
  8. Verify NO `git push` was executed (`git ls-remote --tags origin v<X.Y.Z>` empty)
  9. Verify stderr contains the literal `aborted-headless-sensitive: git push origin <branch> requires interactive approval; rerun without AUTO_RELEASE=1`
  10. Verify stderr contains the literal `aborted-headless-sensitive: git push origin v<X.Y.Z> requires interactive approval; rerun without AUTO_RELEASE=1`
  11. Verify the structured summary's `Tier breakdown` line shows `Sensitive (skipped): 2` (or higher if `git push origin main` was also in scope)
  12. Verify `Commands to run` section lists the un-executed Sensitive-tier `git push` lines for human follow-up per FR-9.2
- **Expected Result:** Trivial + Moderate auto-execute; Sensitive refused with literal stderr; exit 0; tier breakdown reports skipped count
- **Pass Criteria:** AC-7 satisfied

### TC-4.2: Headless mode + sentinel absent — opt-out wins
- **Category:** Headless / Backward Compat
- **Mapped UC:** UC-4-EC1
- **Mapped FR:** FR-9.4
- **Mapped AC:** AC-8
- **Type:** integration
- **Severity:** P1
- **Preconditions:** `AUTO_RELEASE=1` set; `.claude/rules/auto-release.md` ABSENT
- **Inputs:** `AUTO_RELEASE=1 /merge-ready`
- **Steps:**
  1. Verify `test ! -f .claude/rules/auto-release.md`
  2. Run `AUTO_RELEASE=1 /merge-ready`
  3. Verify the agent operates in suggest-only mode (no Bash invocation; no tag; no commit)
  4. Verify the structured 10-section summary IS emitted
  5. Verify NO `aborted-headless-sensitive` line is emitted (the agent never reached the headless dispatch because the sentinel gates the entire executing-mode behavior)
- **Expected Result:** Sentinel absence wins over `AUTO_RELEASE=1`; suggest-only output
- **Pass Criteria:** AC-8 sentinel-priority contract satisfied

---

## 5. UC-5: `install.sh` on darwin-arm64 Prebuilt-Binary Download

### TC-5.1: darwin-arm64 install downloads `sdlc-knowledge-darwin-arm64` in ≤ 60 s
- **Category:** Install / Prebuilt Binary
- **Mapped UC:** UC-5
- **Mapped FR:** FR-4.1, FR-4.2, FR-4.6, FR-5.1
- **Mapped AC:** AC-5, AC-9
- **Type:** integration
- **Severity:** P0
- **Preconditions:** Host is darwin-arm64; `uname -ms` returns `Darwin arm64`; iter-3 has shipped (TC-1.1 succeeded, tag exists); REPO_URL fix per FR-5.1 in place
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. Record start `T0`
  2. Run `bash install.sh --yes`
  3. Record end `T1`; verify `T1 - T0 ≤ 60 s`
  4. Verify `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` exit 0 and stdout matches regex `^sdlc-knowledge 0\.2\.0\b`
  5. Verify the install summary contains the literal `tools/sdlc-knowledge/sdlc-knowledge (darwin-arm64 — sdlc-knowledge-v0.2.0 prebuilt)` per FR-4.6
  6. Verify the install transcript does NOT contain `cargo build --release -p sdlc-knowledge` (cargo path not invoked)
- **Expected Result:** Prebuilt-binary primary path; ≤ 60 s; cargo not invoked
- **Pass Criteria:** AC-5, AC-9 satisfied for darwin-arm64

(See TC-CP-1 below for the cross-platform matrix entry duplicating coverage as required by UC-CC-3.)

---

## 6. UC-9: `install.sh` on windows-x64 (NEW iter-3 Platform)

### TC-9.1: windows-x64 install downloads `sdlc-knowledge-windows-x64.exe` in ≤ 60 s
- **Category:** Install / Prebuilt Binary / NEW Platform
- **Mapped UC:** UC-9
- **Mapped FR:** FR-3.1, FR-3.5, FR-3.6, FR-4.1, FR-4.3, FR-4.6
- **Mapped AC:** AC-4, AC-5
- **Type:** integration / cross-platform
- **Severity:** P0
- **Preconditions:** Windows-x64 host (Git Bash or WSL with native Windows binary); `uname -ms` returns a string matching `MINGW64_NT-* x86_64`; iter-3 shipped
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. Record start `T0`
  2. Run `bash install.sh --yes`
  3. Record end `T1`; verify `T1 - T0 ≤ 60 s`
  4. Verify file exists: `~/.claude/tools/sdlc-knowledge/sdlc-knowledge.exe` (note `.exe` suffix per FR-4.3)
  5. Verify `~/.claude/tools/sdlc-knowledge/sdlc-knowledge.exe --version` exit 0 and stdout matches `^sdlc-knowledge 0\.2\.0\b`
  6. Verify the install summary contains `tools/sdlc-knowledge/sdlc-knowledge (windows-x64 — sdlc-knowledge-v0.2.0 prebuilt)` per FR-4.6
  7. Verify the install transcript does NOT contain `cargo build --release -p sdlc-knowledge`
- **Expected Result:** Windows prebuilt binary downloads in ≤ 60 s with `.exe` suffix
- **Pass Criteria:** AC-4 (windows-x64 in matrix), AC-5 (download succeeds)

### TC-9.2: `windows-latest` runner timeout >15 min — workflow fails, marked unavailable
- **Category:** Install / Budget Violation
- **Mapped UC:** UC-9-E1
- **Mapped FR:** NFR-5
- **Type:** integration
- **Severity:** P3
- **Preconditions:** Sacrificial workflow run on `windows-latest`; matrix step deliberately stalled
- **Steps:**
  1. Inject a `sleep 1000` into the Windows matrix build step
  2. Push a tag; observe workflow run
  3. Verify the workflow times out at the 15 min mark per the workflow's `timeout-minutes:` setting (NFR-5)
  4. Verify the windows-x64 binary asset is NOT uploaded; the four other platforms still upload
- **Expected Result:** Windows job fails clean; other platforms unaffected (per `fail-fast: false` matrix setting)
- **Pass Criteria:** NFR-5 budget enforced

### TC-9.3: Windows path `C:/Users/runneradmin/.claude/...` resolves correctly
- **Category:** Install / Path Resolution
- **Mapped UC:** UC-9-EC1
- **Mapped FR:** FR-3.3
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Windows runner; `$HOME` resolves to `C:/Users/runneradmin` (Git Bash convention)
- **Steps:**
  1. On a Windows runner during the GH Actions workflow run, log `$HOME` and `pwd` from the `Download pdfium dynamic library` step
  2. Verify `$HOME` resolves to `C:/Users/runneradmin` (or equivalent forward-slash form)
  3. Verify the extracted `pdfium.dll` lands at `$HOME/.claude/tools/sdlc-knowledge/pdfium/lib/pdfium.dll`
- **Expected Result:** Windows home-path resolves; DLL lands in the conventional location
- **Pass Criteria:** FR-3.3 home-path requirement satisfied

### TC-9.4: Windows `pdfium.dll` (no `lib` prefix) caught by widened find-glob
- **Category:** Install / Filename Convention
- **Mapped UC:** UC-9-EC2
- **Mapped FR:** FR-3.3
- **Type:** integration / cross-platform
- **Severity:** P0
- **Preconditions:** Windows matrix run; `pdfium-win-x64.tgz` extracted
- **Steps:**
  1. After tar extraction, run `find /tmp/pdfium-staging -maxdepth 3 -type f -name '*.dll'` to confirm `pdfium.dll` is present
  2. Run the workflow's actual find-glob from `sdlc-knowledge-release.yml:115` (post-FR-3.3 widening): `find /tmp/pdfium-staging -maxdepth 3 \( -name 'libpdfium*' -o -name 'pdfium*' \) -type f`
  3. Verify the output contains `/tmp/pdfium-staging/.../pdfium.dll`
  4. Verify the file is copied to `$HOME/.claude/tools/sdlc-knowledge/pdfium/lib/pdfium.dll`
- **Expected Result:** Widened glob matches `pdfium.dll`; file copied
- **Pass Criteria:** FR-3.3 widening exercised; cross-references TC-AAI-3

---

## 7. UC-10 / UC-11: Install Fallback Paths

### TC-10.1: FreeBSD (unsupported platform) — falls back to `cargo_source_build_fallback`
- **Category:** Install / Fallback
- **Mapped UC:** UC-10
- **Mapped FR:** FR-4.4
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P1
- **Preconditions:** `uname -ms` mocked to return `FreeBSD amd64`; `cargo` on PATH; local checkout present
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. Mock `uname -ms` to return `FreeBSD amd64`
  2. Run `bash install.sh --yes`
  3. Verify the install transcript contains `cargo build --release -p sdlc-knowledge`
  4. Verify `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` exit 0
  5. Verify the install summary contains the literal `tools/sdlc-knowledge/sdlc-knowledge (built from source)` per FR-4.6
- **Expected Result:** Fallback to cargo source-build; binary functional
- **Pass Criteria:** AC-6 cargo fallback path

### TC-11.1: GH Releases unreachable (404) — falls back to cargo build
- **Category:** Install / Network Failure
- **Mapped UC:** UC-11
- **Mapped FR:** FR-4.4
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Network reachable but asset URL returns 404 (e.g., `KNOWLEDGE_VERSION=99.99.99`); cargo on PATH
- **Steps:**
  1. Set `KNOWLEDGE_VERSION=99.99.99` (override)
  2. Run `bash install.sh --yes`
  3. Verify the transcript shows the 404 warning AND the `cargo build` invocation
  4. Verify the binary functional
- **Expected Result:** 404 → cargo fallback; functional binary
- **Pass Criteria:** AC-6 (mirrors TC-10.1 but exercises network-failure rather than platform-allowlist failure)

---

## 8. UC-12: REPO_URL Koroqe → codefather-labs

### TC-12.1: REPO_URL fix end-to-end — zero `Koroqe` matches in repo
- **Category:** REPO_URL Fix
- **Mapped UC:** UC-12
- **Mapped FR:** FR-5.1, FR-5.2, FR-5.3, FR-5.5
- **Mapped AC:** AC-9
- **Type:** integration
- **Severity:** P0
- **Preconditions:** iter-3 merged
- **Steps:**
  1. Run `grep -rn 'Koroqe' /Users/aleksandra/Documents/claude-code-sdlc/`
  2. Verify exit code 1 (zero matches per AC-9)
  3. Verify `grep -nF 'codefather-labs' install.sh` returns at minimum line 25 and line 12
  4. Verify the Quick install URL `https://raw.githubusercontent.com/codefather-labs/claude-code-sdlc/main/install.sh` returns HTTP 200 via `curl -sIo /dev/null -w '%{http_code}'`
- **Expected Result:** Zero `Koroqe`; codefather-labs everywhere; Quick install URL resolves
- **Pass Criteria:** AC-9 satisfied

(See TC-INV-8 for the install.sh:25 specific byte-check.)

---

## 9. UC-13: Multilingual Russian-Language CHANGELOG Roundtrip

### TC-13.1: Cyrillic CHANGELOG body round-trips byte-for-byte through tag annotation + GH Release body
- **Category:** Multilingual / UTF-8
- **Mapped UC:** UC-13, UC-CC-2
- **Mapped FR:** FR-2.1, FR-2.2, FR-2.3, NFR-7
- **Mapped AC:** AC-3, AC-12
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** Project with `.claude/rules/auto-release.md` opted-in; CHANGELOG `[Unreleased]` body contains exactly the Cyrillic content `### Добавлено\n- Поддержка автоматического выпуска релизов`
- **Inputs:** `/merge-ready`
- **Steps:**
  1. Capture the bytes of the `[Unreleased]` body before run: `dd if=CHANGELOG.md bs=1 count=<N> skip=<offset>` → file `before.bin`
  2. Compute `sha256sum before.bin` → `H_in`
  3. Run `/merge-ready`; respond `y\n` to Sensitive prompts
  4. Capture `.claude/release-notes-<X.Y.Z>.md` bytes → file `notes.bin`
  5. Compute `sha256sum notes.bin` → `H_notes`; verify `H_in == H_notes`
  6. Capture tag annotation bytes: `git cat-file tag v<X.Y.Z> | tail -n +6` → `annot.bin`
  7. Verify `sha256sum annot.bin` → `H_annot`; verify `H_in == H_annot`
  8. After workflow run, capture GH Release body: `gh release view v<X.Y.Z> --json body --jq .body` → `body.bin`
  9. Verify `sha256sum body.bin == H_in` (modulo GitHub's markdown rendering, the SOURCE bytes are identical)
- **Expected Result:** Four sha256 hashes (CHANGELOG body, release-notes file, tag annotation, GH Release body) all equal
- **Pass Criteria:** AC-12 byte-perfect Cyrillic roundtrip

### TC-13.2: Mixed-language CHANGELOG (Russian + English) byte-preserved
- **Category:** Multilingual / Mixed
- **Mapped UC:** UC-13-E1
- **Mapped FR:** NFR-7
- **Mapped AC:** AC-12
- **Type:** integration
- **Severity:** P1
- **Preconditions:** CHANGELOG body contains BOTH Russian (`### Добавлено\n- Новая функция`) and English (`### Added\n- New feature`) entries
- **Steps:**
  1. Same as TC-13.1, but the body is mixed-language
  2. Verify the four sha256 hashes match
- **Expected Result:** Byte-preservation regardless of language mix
- **Pass Criteria:** AC-12 byte-preservation contract

---

## 10. UC-14 / UC-15: Tier-Based Authority Dispatch

### TC-14.1: Sensitive `git push origin main` halts, prompts, executes on `y`
- **Category:** Tier Dispatch / Sensitive
- **Mapped UC:** UC-14
- **Mapped FR:** FR-1.2 (row 12), FR-1.4, FR-1.5
- **Mapped AC:** AC-11
- **Type:** integration
- **Severity:** P0
- **Preconditions:** Project on `main` branch; opt-in present; CHANGELOG `[Unreleased]` non-empty; interactive TTY (no `AUTO_RELEASE=1`)
- **Steps:**
  1. Run `/merge-ready`
  2. Verify the agent emits the literal 5-line FR-1.5 prompt:
     ```
     [Sensitive — release-engineer] About to execute: git push origin main
       Tier rationale: Direct-to-default-branch push; explicit user approval; refused under headless mode
       Reversibility: non-reversible without remote support
     Approve? [y/N]:
     ```
  3. Respond literal `y\n`
  4. Verify the push executes
  5. Verify the structured summary's Tier breakdown contains `Sensitive (auto-approved): >= 1`
- **Expected Result:** Halt + 5-line prompt + execute on `y`; tier breakdown counts the Sensitive-approved op
- **Pass Criteria:** AC-11 tier dispatch satisfied for `git push origin main`

### TC-14.2: User declines Sensitive operation — preserves local tag, skips push
- **Category:** Tier Dispatch / Decline
- **Mapped UC:** UC-14-E1
- **Mapped FR:** FR-1.4, FR-1.5
- **Mapped AC:** AC-11
- **Type:** integration
- **Severity:** P0
- **Preconditions:** Same as TC-14.1
- **Steps:**
  1. Run `/merge-ready`
  2. Respond literal `n\n` (or empty newline) to the Sensitive prompt
  3. Verify NO `git push` was executed
  4. Verify the local tag DOES exist (preserved per FR-8.2)
  5. Verify the structured summary's Tier breakdown contains `Sensitive (skipped): >= 1`
  6. Verify stderr contains `aborted-sensitive: <operation>` per FR-1.4 deny semantics
- **Expected Result:** Push skipped; local tag preserved; tier breakdown counts the skipped op
- **Pass Criteria:** AC-11 deny semantics

### TC-15.1: Forbidden tier blocks `npm publish`
- **Category:** Tier Dispatch / Forbidden
- **Mapped UC:** UC-15
- **Mapped FR:** FR-1.2 (row 10), FR-1.7
- **Mapped AC:** AC-11
- **Type:** integration / security
- **Severity:** P0
- **Preconditions:** Opt-in present
- **Steps:**
  1. Inject a CHANGELOG `[Unreleased]` entry that would trigger registry publication consideration
  2. Run `/merge-ready`
  3. Verify the agent does NOT prompt for `npm publish`
  4. Verify if the user manually requests `npm publish` from the agent, the agent emits the literal stderr `aborted-forbidden: npm publish never executed` per FR-1.4
  5. Verify the structured summary's Tier breakdown contains `Forbidden (refused): >= 1`
- **Expected Result:** `npm publish` never executed; tier breakdown counts the refusal
- **Pass Criteria:** AC-11 + FR-1.7 NEVER-list shrinkage that retains rows 9-11

### TC-15.2: Forbidden tier blocks `cargo publish`
- **Category:** Tier Dispatch / Forbidden
- **Mapped UC:** UC-15
- **Mapped FR:** FR-1.2 (row 10), FR-1.7
- **Mapped AC:** AC-11
- **Type:** integration / security
- **Severity:** P0
- **Steps:** Same as TC-15.1 but for `cargo publish`. Verify literal stderr `aborted-forbidden: cargo publish never executed`.
- **Expected Result:** `cargo publish` refused
- **Pass Criteria:** AC-11

### TC-15.3: Forbidden tier blocks `gh release create`
- **Category:** Tier Dispatch / Forbidden
- **Mapped UC:** UC-15
- **Mapped FR:** FR-1.2 (row 9), FR-1.7
- **Mapped AC:** AC-11
- **Type:** integration / security
- **Severity:** P0
- **Steps:** Same as TC-15.1 but for `gh release create`. Verify the agent does NOT execute it (the GH Actions workflow is the canonical channel; manual `gh release create` is redundant per FR-1.2 row 9 rationale).
- **Expected Result:** `gh release create` refused
- **Pass Criteria:** AC-11 + FR-1.7

---

## 11. UC-16: Backward Compat — No Sentinel → Suggest-Only Byte-for-Byte

### TC-16.1: No `.claude/rules/auto-release.md` → byte-identical §6 suggest-only output
- **Category:** Backward Compat / Headline
- **Mapped UC:** UC-16, UC-CC-6
- **Mapped FR:** FR-7.3, FR-9.4, NFR-3
- **Mapped AC:** AC-8
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** Two test projects: `proj-baseline` (pre-iter-3 §6 reference) and `proj-iter3` (post-iter-3); both have IDENTICAL `[Unreleased]` content; `proj-iter3` has NO `.claude/rules/auto-release.md`
- **Steps:**
  1. On `proj-baseline`, run `/merge-ready` and capture release-engineer stdout to `baseline.txt` (timestamps redacted)
  2. On `proj-iter3`, run `/merge-ready` and capture release-engineer stdout to `iter3.txt` (timestamps redacted)
  3. Run `diff baseline.txt iter3.txt`
  4. Verify the diff is EMPTY (modulo redacted timestamps)
  5. Verify `iter3.txt` does NOT contain the substring `Bash` in any tool-invocation line
  6. Verify `iter3.txt` does NOT contain `[Sensitive — release-engineer]`
  7. Verify `iter3.txt` does NOT contain `Tier breakdown`
  8. Verify NO `git tag` or `git push` was executed during the `proj-iter3` run
- **Expected Result:** Byte-identical structured summaries; no executing-mode behavior
- **Pass Criteria:** AC-8 headline backward-compat contract satisfied

---

## 12. UC-17: Concurrent `/merge-ready` Tag Collision

### TC-17.1: Two clones compute same `v3.2.1` → second push fails clean
- **Category:** Concurrency / Race
- **Mapped UC:** UC-17
- **Mapped FR:** R-6
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Two clones of the same repo (clone A, clone B); both have identical `[Unreleased]` content
- **Steps:**
  1. On clone A, run `/merge-ready` and approve all prompts; tag `v3.2.1` is pushed
  2. On clone B (in parallel or just after), run `/merge-ready`; the agent computes the SAME `v3.2.1`
  3. Clone B's `git push origin v3.2.1` fails with `! [rejected] (already exists)`
  4. Verify clone B's agent emits a clear error message instructing the user to bump the version-source by one and re-run
  5. Verify clone B's structured summary indicates the failure
- **Expected Result:** Second push rejected; clean recovery path surfaced
- **Pass Criteria:** R-6 race-condition recovery

### TC-17.2: Tag collision after retry — escalate to user
- **Category:** Concurrency / Recovery
- **Mapped UC:** UC-17-E1
- **Mapped FR:** R-6
- **Type:** integration
- **Severity:** P3
- **Steps:**
  1. After TC-17.1, on clone B, the user bumps version to `v3.2.2`
  2. Re-run `/merge-ready` on clone B
  3. Verify the new tag pushes cleanly
- **Expected Result:** Recovery via version-bump succeeds
- **Pass Criteria:** R-6 recovery path satisfied

---

## 13. UC-CC-1, UC-CC-2: Cross-Cutting Tier and Multilingual

### TC-CC-1.1: Tier dispatch matches resource-architect contract verbatim (4 tiers, anchored regex, headless contract, most-restrictive rule)
- **Category:** Cross-Cutting / Tier Dispatch
- **Mapped UC:** UC-CC-1
- **Mapped FR:** FR-1.2, FR-1.3, FR-1.4, NFR-4
- **Mapped AC:** AC-11
- **Type:** integration / static
- **Severity:** P0
- **Steps:**
  1. Read `src/agents/release-engineer.md` and `src/agents/resource-architect.md`
  2. Extract the four tier names from each: must both equal `["Trivial", "Moderate", "Sensitive", "Forbidden"]`
  3. Extract the most-restrictive-applicable rule sentence from each; verify the wording matches byte-for-byte (modulo whitespace) — `resource-architect.md:222` source-of-truth
  4. Extract the headless-contract env-var name from each (`AUTO_INSTALL=1` for resource-architect, `AUTO_RELEASE=1` for release-engineer); verify the dispatch table shape (Trivial / Moderate auto, Sensitive refused with literal stderr, Forbidden refused unconditionally) is byte-identical
  5. Extract the FR-1.2 12-row tier table; verify each row maps to one of the four tiers
  6. Verify the FR-1.3 anchored-regex whitelist contains exactly 8 entries
- **Expected Result:** Tier model verbatim match; whitelist 8 entries
- **Pass Criteria:** NFR-4 contract observed

### TC-CC-2.1: Multilingual roundtrip — UTF-8 preserved through CHANGELOG → release-notes → tag → GH Release body
- **Category:** Cross-Cutting / Multilingual
- **Mapped UC:** UC-CC-2
- **Mapped FR:** FR-2.1, FR-2.2, FR-2.3, NFR-7
- **Mapped AC:** AC-12
- **Type:** integration / E2E
- **Severity:** P0
- **Steps:** Identical to TC-13.1 (TC-CC-2.1 is the cross-cutting umbrella TC; TC-13.1 is the UC-13-specific instantiation)
- **Pass Criteria:** AC-12

### TC-CC-5.1: SDLC core dogfooding — `.claude/rules/changelog.md`, `.claude/rules/auto-release.md`, `CHANGELOG.md` all present
- **Category:** Cross-Cutting / Dogfood
- **Mapped UC:** UC-CC-5
- **Mapped FR:** FR-7.1, FR-7.2, FR-7.4, FR-7.5, FR-12.5, FR-12.8
- **Mapped AC:** AC-10
- **Type:** integration / static
- **Severity:** P0
- **Steps:**
  1. Verify `test -f /Users/aleksandra/Documents/claude-code-sdlc/.claude/rules/changelog.md` exit 0
  2. Verify `diff /Users/aleksandra/Documents/claude-code-sdlc/.claude/rules/changelog.md /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/changelog.md` is EMPTY (FR-7.1 byte-identical)
  3. Verify `test -f /Users/aleksandra/Documents/claude-code-sdlc/.claude/rules/auto-release.md` exit 0
  4. Verify `test -f /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/auto-release.md` exit 0
  5. Verify `diff /Users/aleksandra/Documents/claude-code-sdlc/.claude/rules/auto-release.md /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/auto-release.md` is EMPTY (FR-7.3 byte-identical)
  6. Verify `test -f /Users/aleksandra/Documents/claude-code-sdlc/CHANGELOG.md` exit 0
  7. Verify `grep -F '## [Unreleased]' /Users/aleksandra/Documents/claude-code-sdlc/CHANGELOG.md` returns 1 line
  8. Verify `grep -F '## [3.0.0] - 2026-04-26 — Auto-Release Pipeline' /Users/aleksandra/Documents/claude-code-sdlc/CHANGELOG.md` returns 1 line
- **Expected Result:** All four files present; pairs byte-identical; CHANGELOG dated correctly
- **Pass Criteria:** AC-10 satisfied; FR-12.5 / FR-12.8 explicit relaxations observed

---

## Invariant Test Cases

These TCs verify that iter-3 preserves the canonical SDLC core invariants — the 17 agents / 10 gates / 5 executors / cognitive-self-check / templates / activation-block / NEVER-list set MUST NOT regress.

### TC-INV-1: 17 agents preserved
- **Category:** Invariant / Agent Count
- **Mapped UC:** UC-CC-4
- **Mapped FR:** FR-12.1
- **Mapped AC:** AC-13
- **Type:** unit / static
- **Severity:** P0
- **Steps:**
  1. Run `ls /Users/aleksandra/Documents/claude-code-sdlc/src/agents/*.md | wc -l`
  2. Verify output is exactly `17`
- **Expected Result:** `17`
- **Pass Criteria:** FR-12.1 / AC-13

### TC-INV-2: 6 commands preserved
- **Category:** Invariant / Command Count
- **Mapped UC:** UC-CC-4
- **Mapped FR:** FR-12 (commands UNCHANGED per PRD §13.8 line 3400)
- **Mapped AC:** AC-13
- **Type:** unit / static
- **Severity:** P0
- **Steps:**
  1. Run `ls /Users/aleksandra/Documents/claude-code-sdlc/src/commands/*.md | wc -l`
  2. Verify output is exactly `6`
- **Expected Result:** `6` (preserved from §11 which brought count from 5 → 6)
- **Pass Criteria:** §13 commands invariant

### TC-INV-3: README line 5 tagline byte-unchanged
- **Category:** Invariant / Tagline
- **Mapped UC:** UC-CC-4
- **Mapped FR:** FR-12.4, FR-5.5, FR-7.6
- **Mapped AC:** AC-13
- **Type:** unit / static
- **Severity:** P0
- **Steps:**
  1. Read `/Users/aleksandra/Documents/claude-code-sdlc/README.md` line 5 verbatim
  2. Verify it equals (byte-for-byte) `17 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations.`
  3. Verify `git diff <pre-iter3-merge-commit>..HEAD -- README.md | grep -E '^[+-].*line 5'` is empty
- **Expected Result:** Byte-unchanged
- **Pass Criteria:** FR-12.4 / AC-13

### TC-INV-4: README line 35 `10 quality gates` byte-unchanged
- **Category:** Invariant / Gate Count
- **Mapped UC:** UC-CC-4
- **Mapped FR:** FR-12.2, FR-12.4
- **Mapped AC:** AC-13
- **Type:** unit / static
- **Severity:** P0
- **Steps:**
  1. Run `grep -Fxc '10 quality gates' /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  2. Verify output is `>= 1`
  3. Read README.md line 35 verbatim; verify the literal phrase `10 quality gates` is present
  4. Verify `git diff <pre-iter3-merge-commit>..HEAD -- README.md` does not modify line 35
- **Expected Result:** `10 quality gates` present at line 35; byte-unchanged
- **Pass Criteria:** FR-12.2 / AC-13

### TC-INV-5: 5 executor agents byte-unchanged vs main
- **Category:** Invariant / Executor Bytes
- **Mapped UC:** UC-CC-4
- **Mapped FR:** FR-12.3
- **Mapped AC:** AC-13
- **Type:** unit / static
- **Severity:** P0
- **Steps:**
  1. For each of the 5 executor agents (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`):
     - Run `git diff main..HEAD -- src/agents/<name>.md`
  2. Verify each diff is EMPTY
  3. Compute `sha256sum src/agents/{test-writer,build-runner,e2e-runner,doc-updater,changelog-writer}.md` and verify each hash equals the pre-iter3 baseline (captured at iter-3 branch creation)
- **Expected Result:** All 5 diffs empty; all 5 sha256 hashes match baseline
- **Pass Criteria:** FR-12.3 / AC-13

### TC-INV-6: `src/rules/cognitive-self-check.md` byte-unchanged
- **Category:** Invariant / Cognitive Self-Check
- **Mapped UC:** UC-CC-4
- **Mapped FR:** FR-12.6
- **Mapped AC:** AC-13
- **Type:** unit / static
- **Severity:** P0
- **Steps:**
  1. Run `git diff main..HEAD -- src/rules/cognitive-self-check.md`
  2. Verify the diff is EMPTY
  3. Compute `sha256sum src/rules/cognitive-self-check.md` and verify the hash matches the pre-iter3 baseline
- **Expected Result:** Byte-unchanged
- **Pass Criteria:** FR-12.6 / AC-13

### TC-INV-7: `templates/rules/*` four pre-existing files byte-unchanged; new files are NEW
- **Category:** Invariant / Template Bytes
- **Mapped UC:** UC-CC-4
- **Mapped FR:** FR-12.5 (intentional relaxation), PRD §13.8 line 3397-3398
- **Mapped AC:** AC-13
- **Type:** unit / static
- **Severity:** P0
- **Steps:**
  1. For each of the 4 pre-existing templates (`changelog.md`, `architecture.md`, `security.md`, `testing.md`):
     - Run `git diff main..HEAD -- templates/rules/<name>`
     - Verify the diff is EMPTY
  2. Verify `templates/rules/auto-release.md` is a NEW file:
     - `git log --diff-filter=A --pretty=format:%H -- templates/rules/auto-release.md` returns exactly one commit (the iter-3 commit)
  3. Verify `templates/hooks/pre-push` is a NEW file:
     - `git log --diff-filter=A --pretty=format:%H -- templates/hooks/pre-push` returns exactly one commit
  4. Verify NO existing `templates/rules/*` file has been MODIFIED (`git diff main..HEAD -- templates/rules/ | grep -E '^---'` only shows newly-ADDED files)
- **Expected Result:** 4 pre-existing files byte-unchanged; 2 new files added intentionally per FR-12.5
- **Pass Criteria:** FR-12.5 templates relaxation observed; AC-13

### TC-INV-8: `install.sh:25 REPO_URL` is now `codefather-labs/claude-code-sdlc.git`
- **Category:** Invariant / REPO_URL Fix
- **Mapped UC:** UC-12, UC-CC-4
- **Mapped FR:** FR-5.1
- **Mapped AC:** AC-9
- **Type:** unit / static
- **Severity:** P0
- **Steps:**
  1. Run `grep -nE '^REPO_URL=' /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  2. Verify exactly one match and it equals `REPO_URL="https://github.com/codefather-labs/claude-code-sdlc.git"` (line number not pinned to absorb drift)
  3. Verify `grep -F 'Koroqe' /Users/aleksandra/Documents/claude-code-sdlc/install.sh` returns 0 matches
- **Expected Result:** REPO_URL equals codefather-labs; zero `Koroqe`
- **Pass Criteria:** FR-5.1 / AC-9

### TC-INV-9: 12 thinking-agent activation blocks byte-unchanged
- **Category:** Invariant / Activation Block
- **Mapped UC:** UC-CC-4
- **Mapped FR:** FR-12.7
- **Mapped AC:** AC-13
- **Type:** unit / static
- **Severity:** P0
- **Steps:**
  1. For each of the 12 thinking agents (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer`):
     - Run `awk '/^## Knowledge Base \(when present\)/,/^## /' src/agents/<name>.md > /tmp/<name>_block.txt`
  2. Compute `sha256sum` of each block file
  3. Verify each hash matches the pre-iter3 baseline (captured at iter-3 branch creation)
  4. Note: `release-engineer.md` IS in the 12-thinking list and its activation block MUST also be unchanged even though the rest of the file is rewritten per FR-1
- **Expected Result:** All 12 blocks byte-unchanged
- **Pass Criteria:** FR-12.7 / AC-13

### TC-INV-10: `release-engineer.md ## NEVER List` byte-unchanged for 13 forbidden commands (additivity-only)
- **Category:** Invariant / NEVER List
- **Mapped UC:** UC-CC-4
- **Mapped FR:** FR-1.7
- **Mapped AC:** AC-11
- **Type:** unit / static
- **Severity:** P0
- **Preconditions:** Iter-3 merged; release-engineer.md rewritten per FR-1
- **Steps:**
  1. Read `src/agents/release-engineer.md`; locate the `## NEVER List` section
  2. Extract the 13 forbidden command lines (verbatim from the pre-iter3 baseline): `git push`, `git push origin <anything>`, `git push origin v<anything>`, `git tag`, `git tag -a vX.Y.Z`, `git tag -a vX.Y.Z -F .claude/release-notes-X.Y.Z.md`, `gh release create`, `gh release create vX.Y.Z`, `npm publish`, `cargo publish`, `pypi upload`, `twine upload`, `gem push`, `poetry publish`, `yarn publish`, `pnpm publish`
  3. Note: per FR-1.7 the NEVER List SHRINKS (some commands move to Sensitive-tier). The 13 forbidden command BYTES that REMAIN forbidden (registry publishes, force-pushes, `gh release create` per FR-1.2 rows 9-11) MUST be present byte-unchanged
  4. The expected post-iter-3 NEVER List MUST contain at minimum: `npm publish`, `cargo publish`, `pypi upload`, `twine upload`, `gem push`, `poetry publish`, `yarn publish`, `pnpm publish`, `gh release create`, `gh release create vX.Y.Z`, force-push variants (`git push --force`, `git push -f`, `git push +<ref>`)
  5. Verify the 13 forbidden command lines that REMAIN are byte-identical to their pre-iter-3 form (no semantic change)
  6. Verify NO row was REMOVED from the rows-9-11 Forbidden-tier (additivity-only — the tier dispatch can EXTEND but cannot REMOVE forbidden behavior)
- **Expected Result:** Forbidden-tier rows 9-11 byte-preserved; only suggest-only-but-now-Sensitive commands moved out
- **Pass Criteria:** FR-1.7 shrinkage that preserves rows 9-11

---

## Architect Action Item Test Cases

### TC-AAI-1: Tag-scheme disambiguation logic in `release-engineer.md` (STRUCTURAL)
- **Category:** Architect Action Item / STRUCTURAL
- **Mapped Action Item:** #1 — tag-scheme disambiguation
- **Mapped FR:** FR-11.5
- **Type:** static / unit
- **Severity:** P0
- **Steps:**
  1. Read `src/agents/release-engineer.md`
  2. Locate the section discussing tag-prefix detection (per FR-11.5 PRD line 3221)
  3. Verify the prompt contains explicit decision logic referencing AT LEAST these two paths:
     - `tools/sdlc-knowledge/Cargo.toml` change → tag prefix `sdlc-knowledge-v` → fires `.github/workflows/sdlc-knowledge-release.yml`
     - Root version-source file change (one of `package.json`, `pyproject.toml`, `Cargo.toml` at repo root, `VERSION`) → tag prefix `v` → fires `.github/workflows/sdlc-core-release.yml`
  4. Verify the Sensitive-tier prompt for the tag operation includes a line of the form `tag prefix: <prefix> — will fire <workflow-file>` per FR-11.5
  5. Run `grep -nE 'tag prefix: (sdlc-knowledge-)?v' src/agents/release-engineer.md` and verify >= 1 match
- **Expected Result:** Disambiguation logic explicit; prompt declares which workflow fires
- **Pass Criteria:** Architect [STRUCTURAL] action item #1 satisfied

### TC-AAI-2: FR-12.7 templates scope wording clarified in `.claude/plan.md`
- **Category:** Architect Action Item / STRUCTURAL
- **Mapped Action Item:** #2 — FR-12.7 templates scope
- **Mapped FR:** FR-12.5, FR-12.7, PRD §13.8 line 3397-3398
- **Type:** static
- **Severity:** P1
- **Steps:**
  1. Read `.claude/plan.md`
  2. Verify it contains an explicit clarification block stating that the `templates/rules/*` byte-unchanged invariant scopes to the four pre-existing ship-to-downstream files (`changelog.md`, `architecture.md`, `security.md`, `testing.md`) and NOT to the SDLC core's own runtime `.claude/rules/` directory
  3. Verify it states that NEW files added under `templates/rules/` per FR-12.5 (specifically `templates/rules/auto-release.md`) are NEW additions, not modifications
  4. Run `grep -nE 'templates/rules/(changelog|architecture|security|testing)\.md' .claude/plan.md` and verify each of the 4 file references is present
- **Expected Result:** Plan documents the precise scope of FR-12.7
- **Pass Criteria:** Architect [STRUCTURAL] action item #2 satisfied

### TC-AAI-3: GitHub Actions Windows step uses `find ... \( -name 'libpdfium*' -o -name 'pdfium*' \) -type f`
- **Category:** Architect Action Item / STRUCTURAL
- **Mapped Action Item:** #3 — find-glob `-o` operator widening
- **Mapped FR:** FR-3.3
- **Type:** static / cross-platform
- **Severity:** P0
- **Steps:**
  1. Read `.github/workflows/sdlc-knowledge-release.yml` lines 103-116 (Download pdfium dynamic library step)
  2. Verify the find-glob exact byte-shape contains the substring `\( -name 'libpdfium*' -o -name 'pdfium*' \)` (escaped parens, `-o` operator, both name patterns)
  3. Run `grep -nF "\\( -name 'libpdfium*' -o -name 'pdfium*' \\)" .github/workflows/sdlc-knowledge-release.yml` and verify >= 1 match
  4. Verify the glob does NOT use the Bash-only `[[ ... || ... ]]` form (which is shell-conditional, not find-syntax)
  5. Cross-reference TC-9.4 for the runtime exercise of this glob on a Windows runner
- **Expected Result:** POSIX-portable find-syntax with `-o` operator and escaped parentheses
- **Pass Criteria:** Architect [STRUCTURAL] action item #3 satisfied; correct match on `pdfium.dll` (no `lib` prefix) on Windows

### TC-AAI-4: `release-engineer.md:4 tools:` line already contains "Bash" before iter-3 edits
- **Category:** Architect Action Item / MAJOR (RESOLVED)
- **Mapped Action Item:** #4 — FR-1.1 stale evidence
- **Mapped FR:** FR-1.1
- **Type:** unit / static
- **Severity:** P0
- **Preconditions:** Pre-iter-3 baseline of `src/agents/release-engineer.md` available (e.g., `git show main:src/agents/release-engineer.md`)
- **Steps:**
  1. Run `git show main:src/agents/release-engineer.md | sed -n '4p'`
  2. Verify the output equals (byte-for-byte) `tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]`
  3. Verify `Bash` is the SIXTH element in the array (preceded by `Read`, `Write`, `Edit`, `Glob`, `Grep`)
  4. Run the same check on the post-iter-3 file at HEAD: `sed -n '4p' src/agents/release-engineer.md`
  5. Verify the post-iter-3 line equals the pre-iter-3 line byte-for-byte (BYTE-UNCHANGED through iter-3 — FR-1.1 is documentation accuracy in the prompt body, not frontmatter modification)
- **Expected Result:** Pre-iter-3 line already had `Bash`; post-iter-3 line is byte-identical
- **Pass Criteria:** Architect MAJOR action item #4 RESOLVED — frontmatter unchanged

### TC-AAI-5: KB corpus DevOps gap tracked as iter-4 item (informational only)
- **Category:** Architect Action Item / MINOR (Informational)
- **Mapped Action Item:** #5 — KB corpus is ML, no DevOps reference
- **Type:** documentation / tracking
- **Severity:** P3
- **Steps:**
  1. Read this file's `## Facts → ### Open questions` block
  2. Verify the block contains a documented negative-result entry for the 4 English KB queries (`"release engineering test cases"`, `"GitHub Actions workflow security"`, `"bash command whitelist allowlist regex"`, `"release notes changelog automation"`) returning ZERO hits
  3. Verify the block contains a suggested iter-4 corpus enrichment list (e.g., `git-tag(1)` manpage, GitHub Actions release-management docs, Keep a Changelog spec, Semantic Versioning 2.0.0 spec)
  4. Verify there is NO test action this iter (TC-AAI-5 is informational only)
- **Expected Result:** Open-questions block documents the gap; iter-4 path identified
- **Pass Criteria:** Architect MINOR action item #5 acknowledged

---

## Cross-Platform Matrix

UC-CC-3 mandates 5-platform install matrix coverage. Each TC below exercises `bash install.sh --yes` on a host of the specified platform, asserts the prebuilt binary downloads in ≤ 60 s per AC-5 / NFR-2, and asserts the install summary matches FR-4.6.

### TC-CP-1: darwin-arm64 install (Apple Silicon)
- **Category:** Cross-Platform / Install Matrix
- **Mapped UC:** UC-5, UC-CC-3
- **Mapped FR:** FR-3.1, FR-4.1, FR-4.2, FR-4.6
- **Mapped AC:** AC-4, AC-5
- **Type:** integration / cross-platform
- **Severity:** P0
- **Preconditions:** Host = `Darwin arm64` (`uname -ms`); iter-3 shipped (TC-1.1 succeeded); REPO_URL fix in place
- **Steps:**
  1. `T0 = date +%s`
  2. `bash install.sh --yes`
  3. `T1 = date +%s`; verify `T1 - T0 <= 60`
  4. Verify `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` exit 0; stdout matches `^sdlc-knowledge 0\.2\.0\b`
  5. Verify install summary contains `tools/sdlc-knowledge/sdlc-knowledge (darwin-arm64 — sdlc-knowledge-v0.2.0 prebuilt)`
- **Expected Result:** Prebuilt path; ≤ 60 s; binary functional
- **Pass Criteria:** AC-5 satisfied for darwin-arm64

### TC-CP-2: darwin-x64 install (Intel macOS)
- **Category:** Cross-Platform / Install Matrix
- **Mapped UC:** UC-8, UC-CC-3
- **Mapped FR:** FR-3.1, FR-4.1, FR-4.2, FR-4.6
- **Mapped AC:** AC-4, AC-5
- **Type:** integration / cross-platform
- **Severity:** P0
- **Preconditions:** Host = `Darwin x86_64`
- **Steps:** Identical to TC-CP-1 but assert install summary contains `darwin-x64`
- **Expected Result:** Prebuilt path; ≤ 60 s
- **Pass Criteria:** AC-5 satisfied for darwin-x64

### TC-CP-3: linux-x64 install (Ubuntu/Debian/Alpine glibc)
- **Category:** Cross-Platform / Install Matrix
- **Mapped UC:** UC-6, UC-CC-3
- **Mapped FR:** FR-3.1, FR-4.1, FR-4.2, FR-4.6
- **Mapped AC:** AC-4, AC-5
- **Type:** integration / cross-platform
- **Severity:** P0
- **Preconditions:** Host = `Linux x86_64`
- **Steps:** Identical to TC-CP-1 but assert install summary contains `linux-x64`
- **Expected Result:** Prebuilt path; ≤ 60 s
- **Pass Criteria:** AC-5 satisfied for linux-x64

### TC-CP-4: linux-arm64 install (ARM Linux)
- **Category:** Cross-Platform / Install Matrix
- **Mapped UC:** UC-7, UC-CC-3
- **Mapped FR:** FR-3.1, FR-4.1, FR-4.2, FR-4.6
- **Mapped AC:** AC-4, AC-5
- **Type:** integration / cross-platform
- **Severity:** P0
- **Preconditions:** Host = `Linux aarch64`
- **Steps:** Identical to TC-CP-1 but assert install summary contains `linux-arm64`
- **Expected Result:** Prebuilt path; ≤ 60 s
- **Pass Criteria:** AC-5 satisfied for linux-arm64

### TC-CP-5: windows-x64 install (NEW iter-3 platform)
- **Category:** Cross-Platform / Install Matrix / NEW
- **Mapped UC:** UC-9, UC-CC-3
- **Mapped FR:** FR-3.1, FR-3.5, FR-3.6, FR-4.1, FR-4.3, FR-4.6
- **Mapped AC:** AC-4, AC-5
- **Type:** integration / cross-platform
- **Severity:** P0
- **Preconditions:** Host = Windows-x64 with Git for Windows / Git Bash; `uname -ms` returns string matching `MINGW64_NT-* x86_64`
- **Steps:**
  1. Verify `uname -ms` matches the regex `MINGW64_NT-[^ ]+ x86_64`
  2. `T0 = date +%s`
  3. `bash install.sh --yes`
  4. `T1 = date +%s`; verify `T1 - T0 <= 60`
  5. Verify `~/.claude/tools/sdlc-knowledge/sdlc-knowledge.exe --version` exit 0 (note `.exe` per FR-4.3)
  6. Verify stdout matches `^sdlc-knowledge 0\.2\.0\b`
  7. Verify install summary contains `tools/sdlc-knowledge/sdlc-knowledge (windows-x64 — sdlc-knowledge-v0.2.0 prebuilt)`
  8. Verify the binary file size ≤ 12 MB per NFR-6 (Windows budget loosened from 10 MB)
- **Expected Result:** Prebuilt `.exe` path; ≤ 60 s; ≤ 12 MB
- **Pass Criteria:** AC-4 (5th platform), AC-5, NFR-6 satisfied

---

## Security Pre-Review Test Groups

These four test groups are flagged for `security-auditor` pre-review (per the 4-slice security-pre-review list in the user task). Each group emits ≥ 3 TCs covering the security-load-bearing surface.

### TC-SEC-1.x: Release-Engineer Executing-Mode + Bash Whitelist

#### TC-SEC-1.1: Anchored-regex whitelist correctness — exactly 8 entries, each `^...$` anchored
- **Category:** Security / Whitelist
- **Mapped FR:** FR-1.3
- **Type:** unit / static / security
- **Severity:** P0
- **Steps:**
  1. Read `src/agents/release-engineer.md`; locate the FR-1.3 anchored-regex whitelist section
  2. Extract each regex (8 expected — labeled (a) through (h) per PRD line 3055)
  3. Verify each regex starts with `^` and ends with `$` (no unanchored fragments)
  4. Verify each regex matches exactly one of:
     - (a) `^git add CHANGELOG\.md( \.claude/release-notes-[0-9]+\.[0-9]+\.[0-9]+\.md)?$`
     - (b) `^git commit -m "chore\(release\): [0-9]+\.[0-9]+\.[0-9]+"$`
     - (c) `^git tag -a (sdlc-knowledge-)?v[0-9]+\.[0-9]+\.[0-9]+ -F \.claude/release-notes-[0-9]+\.[0-9]+\.[0-9]+\.md$`
     - (d) `^git push origin (sdlc-knowledge-)?v[0-9]+\.[0-9]+\.[0-9]+$`
     - (e) `^git push origin (feat|fix|chore)/[a-z0-9-]+$`
     - (f) `^npm version (patch|minor|major)$`
     - (g) `^cargo set-version [0-9]+\.[0-9]+\.[0-9]+$`
     - (h) `^poetry version (patch|minor|major|[0-9]+\.[0-9]+\.[0-9]+)$`
  5. Verify there is NO default-allow path (the whitelist is exhaustive; non-match = REFUSE)
- **Expected Result:** 8 anchored regexes; no defaults; verbatim match
- **Pass Criteria:** FR-1.3 anchored-regex correctness

#### TC-SEC-1.2: Shell metacharacter rejection — `;`, `&&`, `||`, `|`, `` ` ``, `$(`, `>`, `<` REFUSED
- **Category:** Security / Metacharacter Rejection
- **Mapped FR:** FR-1.3
- **Type:** integration / security
- **Severity:** P0
- **Steps:**
  1. For each metacharacter in the set `; && || | ` `` ` `` `$(` `>` `<`:
     - Construct a candidate command containing that metacharacter (e.g., `git push origin v1.2.3; rm -rf /`)
     - Invoke the agent's whitelist gate with this candidate
  2. Verify EACH candidate is REFUSED with the literal stderr `error: command not in release-engineer whitelist: <command>`
  3. Verify NO candidate executes
- **Expected Result:** All 8 metacharacter classes rejected
- **Pass Criteria:** FR-1.3 metacharacter rejection unconditional

#### TC-SEC-1.3: Tier table coverage — every FR-1.2 row has a tier label, no row defaults to a tier-less state
- **Category:** Security / Tier Coverage
- **Mapped FR:** FR-1.2
- **Type:** unit / static / security
- **Severity:** P0
- **Steps:**
  1. Read the FR-1.2 12-row tier table
  2. For each row, extract the Tier column value
  3. Verify each value is exactly one of `Trivial`, `Moderate`, `Sensitive`, `Forbidden` (no typos, no empty strings)
  4. Verify no row has a tier-less state
  5. Verify the most-restrictive-applicable rule is documented near the table
- **Expected Result:** All 12 rows tagged with a valid tier
- **Pass Criteria:** FR-1.2 coverage

#### TC-SEC-1.4: No default-allow path in dispatch — every command not matching whitelist + tier must REFUSE
- **Category:** Security / Default-Deny
- **Mapped FR:** FR-1.3, FR-1.4
- **Type:** integration / security
- **Severity:** P0
- **Steps:**
  1. Construct an unrecognized command not in the FR-1.3 whitelist (e.g., `git fetch origin`)
  2. Invoke the agent dispatch
  3. Verify the agent REFUSES with literal stderr `error: command not in release-engineer whitelist: git fetch origin`
  4. Verify no execution path reaches `Bash`
- **Expected Result:** Default deny; no fall-through
- **Pass Criteria:** FR-1.3 default-deny

### TC-SEC-2.x: install.sh download_release_binary Windows

#### TC-SEC-2.1: Windows asset URL hardcoded — no shell injection via `uname -ms` output
- **Category:** Security / URL Construction
- **Mapped FR:** FR-4.1, FR-4.3
- **Type:** unit / static / security
- **Severity:** P0
- **Steps:**
  1. Read `install.sh:354-368`; locate the Windows case branch (FR-4.1 `"MINGW64_NT-* x86_64") platform="windows-x64" ;;`)
  2. Verify the `platform` variable assignment uses a static string literal `windows-x64`, not interpolated from `uname` output
  3. Verify the asset URL composition uses bash-quoted variable expansion (`"$platform"`, `"$KNOWLEDGE_VERSION"`) — no `eval`, no command-substitution from external input
  4. Construct an attacker-controlled `uname` output (e.g., `MINGW64_NT-10.0; rm -rf /`) and verify the case-pattern only matches the prefix glob `MINGW64_NT-*` and the rest is a literal pattern, not eval'd
- **Expected Result:** Static string mapping; no injection surface
- **Pass Criteria:** FR-4.1 / FR-4.3 hardening

#### TC-SEC-2.2: TLS-only download — `curl --proto '=https' --tlsv1.2`
- **Category:** Security / TLS
- **Mapped FR:** FR-4.4 (precedent shape from `install.sh:489-613` per PRD line 3412)
- **Type:** unit / static / security
- **Severity:** P0
- **Steps:**
  1. Read the new `download_release_binary` function in install.sh
  2. Verify it uses `curl` with `--proto '=https'` (forces HTTPS; rejects plain HTTP redirects)
  3. Verify it uses `--tlsv1.2` (or higher) to refuse downgrade
  4. Verify it uses `-fsSL` (silent, fail-on-HTTP-error, follow-redirects-with-bound)
- **Expected Result:** TLS-only; downgrade-resistant
- **Pass Criteria:** Inherits §11/§12 precedent

#### TC-SEC-2.3: Redirect/timeout bounds — `--max-redirs 5 --max-time 120`
- **Category:** Security / Bounded Network
- **Mapped FR:** FR-4.4 (inherits §12 PDFium precedent at install.sh:489-613)
- **Type:** unit / static / security
- **Severity:** P1
- **Steps:**
  1. Read the new `download_release_binary` function
  2. Verify `--max-redirs 5` is present (bounds redirect chain to mitigate redirect-loop DoS)
  3. Verify `--max-time 120` is present (caps total connection time)
- **Expected Result:** Bounded network call
- **Pass Criteria:** §12 precedent inherited

#### TC-SEC-2.4: No shell injection via `uname -ms` output in case match
- **Category:** Security / Injection
- **Mapped FR:** FR-4.1
- **Type:** integration / security
- **Severity:** P0
- **Steps:**
  1. Mock `uname` to return `Darwin arm64; touch /tmp/pwn`
  2. Run `bash install.sh --yes`
  3. Verify `test -f /tmp/pwn` exits non-zero (no command substitution from `uname` output)
  4. Verify the case statement uses pattern matching (`case "$(uname -ms)" in`), not eval
- **Expected Result:** No injection
- **Pass Criteria:** FR-4.1 hardening

### TC-SEC-3.x: bootstrap_first_release One-Shot

#### TC-SEC-3.1: `--bootstrap-release` flag is opt-in — never invoked on a normal install
- **Category:** Security / Opt-In
- **Mapped FR:** FR-6.1
- **Type:** integration / security
- **Severity:** P0
- **Steps:**
  1. Run `bash install.sh --yes` (without `--bootstrap-release`)
  2. Verify NO `git tag -a sdlc-knowledge-v*` command is executed
  3. Verify NO `git push origin sdlc-knowledge-v*` is executed
  4. Verify the `bootstrap_first_release` function is NOT called (transcript grep)
- **Expected Result:** Normal install never tags/pushes
- **Pass Criteria:** FR-6.1 opt-in flag

#### TC-SEC-3.2: Push gated behind FR-6.5 prompt — only `y\n` approves
- **Category:** Security / User Approval
- **Mapped FR:** FR-6.5
- **Type:** integration / security
- **Severity:** P0
- **Steps:**
  1. For each non-`y` response (`Y`, `yes`, ` y`, ``, `n`, `N`, `<EOF>`):
     - Run `bash install.sh --bootstrap-release 0.2.0` and respond with that input
     - Verify NO `git push` is executed
  2. Run with literal `y\n` and verify `git push` IS executed
- **Expected Result:** Only literal lowercase `y\n` approves
- **Pass Criteria:** FR-6.5 strict approval

#### TC-SEC-3.3: Pre-conditions enforced (clean tree, version match, repo heuristic)
- **Category:** Security / Pre-conditions
- **Mapped FR:** FR-6.2
- **Type:** integration / security
- **Severity:** P0
- **Steps:**
  1. Cover all three failure modes:
     - (a) Wrong CWD (no `tools/sdlc-knowledge/Cargo.toml` or no `.git` at root) → exit 1
     - (b) Dirty working tree (`git status --porcelain` non-empty) → exit 1
     - (c) Version mismatch between flag and Cargo.toml → exit 1
  2. Verify each failure mode produces a clear stderr message and NO state mutation
- **Expected Result:** All three preconditions enforced; exit 1; no mutation
- **Pass Criteria:** FR-6.2 hardening

#### TC-SEC-3.4: `[BOOTSTRAP]` warning emitted on stderr before any mutation
- **Category:** Security / Audit Trail
- **Mapped FR:** FR-6.4
- **Type:** integration / security
- **Severity:** P1
- **Steps:**
  1. Run `bash install.sh --bootstrap-release 0.2.0` (clean preconditions); respond `n\n` to skip push
  2. Capture stderr; verify the literal `[BOOTSTRAP]` warning per FR-6.4 is present BEFORE any `git tag` line
- **Expected Result:** `[BOOTSTRAP]` warning is the first auditable signal
- **Pass Criteria:** FR-6.4 audit-trail

### TC-SEC-4.x: sdlc-core-release.yml Workflow

#### TC-SEC-4.1: Tag pattern disjoint from `sdlc-knowledge-v*`
- **Category:** Security / Tag-Filter Disjointness
- **Mapped FR:** FR-11.4
- **Type:** unit / static / security
- **Severity:** P0
- **Steps:**
  1. Read `.github/workflows/sdlc-core-release.yml`; verify trigger declares `on: push: tags: 'v*'`
  2. Read `.github/workflows/sdlc-knowledge-release.yml`; verify trigger declares `on: push: tags: 'sdlc-knowledge-v*'`
  3. Verify `v*` does NOT match strings starting with `sdlc-knowledge-` (literal-prefix glob semantics)
  4. Verify `sdlc-knowledge-v*` does NOT match strings starting with `v` and not `sdlc-knowledge-`
  5. Construct two test tags `v3.0.0` and `sdlc-knowledge-v0.2.0`; verify each matches exactly one workflow's trigger
- **Expected Result:** Disjoint tag-filter glob
- **Pass Criteria:** FR-11.4 disjointness

#### TC-SEC-4.2: `permissions: contents: write` scoped to release job only
- **Category:** Security / Permissions Scope
- **Mapped FR:** FR-11.2
- **Type:** unit / static / security
- **Severity:** P0
- **Steps:**
  1. Read `.github/workflows/sdlc-core-release.yml`
  2. Verify the workflow does NOT declare `permissions: contents: write` at the top level (workflow-wide scope)
  3. Verify the release job (the one running `softprops/action-gh-release@v2`) declares `permissions: contents: write` at the JOB level
  4. Verify other jobs (actionlint, archive) do NOT have `contents: write` (least-privilege)
- **Expected Result:** Permission scoped to single job
- **Pass Criteria:** Least-privilege

#### TC-SEC-4.3: actionlint self-check passes on the new workflow
- **Category:** Security / Workflow Lint
- **Mapped FR:** FR-11.2 (actionlint job)
- **Type:** unit / static / security
- **Severity:** P0
- **Steps:**
  1. Run `actionlint .github/workflows/sdlc-core-release.yml`
  2. Verify exit code 0
  3. Verify the workflow file's actionlint job at runtime exit-codes 0 too (read post-tag-push run via `gh run view`)
- **Expected Result:** Zero actionlint findings
- **Pass Criteria:** FR-11.2 actionlint contract

#### TC-SEC-4.4: `softprops/action-gh-release` pinned by `@v2` major-version
- **Category:** Security / Action Pinning
- **Mapped FR:** FR-11.2, R-10
- **Type:** unit / static / security
- **Severity:** P1
- **Steps:**
  1. Read `.github/workflows/sdlc-core-release.yml`
  2. Verify the action is pinned by `@v2` (not floating `@latest`)
  3. Verify the same pin shape as `sdlc-knowledge-release.yml:202`
- **Expected Result:** Major-version pin consistent across both workflows
- **Pass Criteria:** R-10 mitigation; iter-4 will pin by SHA per PRD §13.6 R-10

---

End of test cases — total 80 TCs covering 17 primary UCs, 11 alternative flows, 13 error flows, 12 edge cases, 6 cross-cutting UCs, 13 ACs, 5 architect action items, 5 cross-platform matrix entries, and 4 security-pre-review groups (15 TCs across them).
