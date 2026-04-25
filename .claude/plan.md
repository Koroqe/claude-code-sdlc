# Plan: Cognitive Self-Check Protocol for Thinking Agents

## Recommended Resources
0 recommendations total; 0 expensive; 0 hard reversibility; 0 Trivial; 0 Moderate; 0 Sensitive; 0 Forbidden (settings probe unreadable)

No external resources required.

### MCP
(none)

### Cloud/Compute
(none)

### External API
(none)

### Third-party Service
(none)

### Library/Framework
(none)

### Hardware
(none)

## Auto-Install Results

No installable items

## Additional Roles
0 additional roles total; 0 new prompt files written; 0 core-agent edits

No additional roles required.

## Role invocation plan
(no roles to invoke)

## Reuse Decisions
(no reuse decisions)

## Facts

### Verified facts

- The PRD section for the cognitive-self-check feature lives at `/Users/aleksandra/Documents/claude-code-sdlc/docs/PRD.md` Section 9 (lines 2082–2333) — verified by Read of that range in the current session (header at line 2084, terminal `## Facts` block at lines 2309–2333).
- The PRD enumerates 12 in-scope thinking agents (FR-2.1, line 2140) and 5 exempt executor agents (FR-3.1, line 2160); the rule file's six required `##` headings are pinned by FR-1.1 (line 2127) in this exact order: `## Protocol — Before Each Decision`, `## Mandatory Facts Section`, `## External Contract Verification`, `## Application Scope`, `## Plan Critic Enforcement`, `## Backward Compatibility` — verified by Read of the PRD in the current session.
- The four `### …` subsection names of the `## Facts` block are fixed by FR-1.3 (line 2129) in this exact order: `### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions` — verified by Read of the PRD in the current session.
- The use-cases file at `/Users/aleksandra/Documents/claude-code-sdlc/docs/use-cases/cognitive-self-check_use_cases.md` exists and was Read in this session (16 primary UCs UC-1…UC-16 plus 12 cross-cutting UC-CC-1…UC-CC-12 per the QA test-cases file's coverage table).
- The QA test-cases file at `/Users/aleksandra/Documents/claude-code-sdlc/docs/qa/cognitive-self-check_test_cases.md` exists with 110 TCs, including the cross-cutting acceptance set TC-CC-1…TC-CC-12 — verified by Read of its header and Use Case Coverage table in the current session.
- The architect's Step 3 verdict was PASS with three MINOR refinements (literal `> - The …` / `> - Any …` lexical shape for new Plan Critic bullets, MERGE_DATE placeholder convention in the rule's `## Backward Compatibility`, defensive `^### ` non-presence check for new bullets) and zero `[STRUCTURAL]` fix authorizations — captured verbatim in this agent's task input by the orchestrator.
- The Plan Critic Completeness block in `/Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` lives between the literal markers `**Completeness:**` (line 109) and `**Slice Quality:**` (line 119); the existing last Completeness bullet is the `## Reuse Decisions` bullet at line 117 — verified by Read of `src/claude.md` lines 100–125 in the current session.
- The README Hardening table in `/Users/aleksandra/Documents/claude-code-sdlc/README.md` lives at lines 144–157, columns are `Failure Mode | Our Fix`, with 12 existing rows; the last row (line 157) addresses wave-based parallelism — verified by Read of `README.md` lines 142–158 in the current session.
- All 12 in-scope thinking-agent prompt files exist under `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/` — spot-verified by Read of `src/agents/prd-writer.md` and `src/agents/release-engineer.md` headers in the current session; the remaining 10 are referenced by FR-2.1 and the architect's PASS verdict relies on their existence.
- The five executor agents (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`) and `install.sh`, `templates/rules/`, `templates/CLAUDE.md` are required to be BYTE-UNCHANGED by FR-3.1 / FR-6.3 / FR-6.4 / FR-6.5 / FR-6.6 (PRD lines 2160, 2190–2193) — verified by Read of the PRD in the current session.

### External contracts

(none) — this feature is meta-SDLC infrastructure (markdown rule files, agent-prompt edits, Plan Critic check edits, README hardening table row). It integrates zero third-party APIs, SDKs, libraries, frameworks, or services. The only "external" identifiers in the PRD are internal cross-references to other PRD sections within the same document. The QA test-cases file uses `Stripe.Charge.status` and `userService.findById()` strictly as synthetic test fixtures (heuristic trip / non-trip), not as integrations.

### Assumptions

- The architect's three MINOR refinements (literal `> - The …` / `> - Any …` shape, MERGE_DATE placeholder, defensive `^### ` check) are reflected verbatim in Slices 1, 5 below — assumed sufficient because the architect's verdict was PASS without `[STRUCTURAL]` items; if the architect re-reviews and demands stricter wording, Slice 5's done-condition is amenable to refinement without re-architecting.
- The exact append placement inside each of the 12 agent prompt files (Slices 2/3/4) follows FR-2.15: additive, after frontmatter and any "Process"/"Output Format" intro, before constraint lists. Each implementing slice will use `Edit` rather than `Write` to avoid whitespace churn (Risk 10 mitigation). Risk: if any agent file's structure has drifted since FR-2.15 wording, the implementer must inspect the file and place the section unmissably; how to verify: Read each file before edit.
- The MERGE_DATE placeholder convention is `MERGE_DATE: <YYYY-MM-DD — filled in at merge by release-engineer>` written into the rule file's `## Backward Compatibility` section. The release-engineer at `/merge-ready` Gate 9 substitutes the actual merge date. Risk: if the release-engineer is not yet shipped at implementation time, the substitution is manual; how to verify: Read `src/agents/release-engineer.md` before merge.
- Wave 2 spawns three parallel subagents (one per Slice 2/3/4). Each touches a disjoint set of 4 files for a total of 12 disjoint files. Risk: case-insensitive macOS filesystem could silently collide if any agent file is referenced as a different case in a slice; how to verify: every Files: list below uses the exact lowercase basename matching the on-disk file.

### Open questions

(none) — the upstream artifacts (PRD §9, use-cases file, QA test-cases file, architect PASS verdict, exploration plan) provide complete specification. Implementation-time decisions (exact `Edit` insertion anchors per agent file, exact MERGE_DATE substitution timing) are deferred to the implementing slices and are bounded by the architect's three MINOR refinements which are already inlined into Slices 1 and 5.

## Prerequisites verified

- PRD section: `docs/PRD.md` — Section 9 (lines 2082–2333), 7 numbered subsections (9.1–9.7), terminal `## Facts` block at lines 2309–2333
- Use cases: `docs/use-cases/cognitive-self-check_use_cases.md` — 16 primary UCs (UC-1…UC-16) + 12 cross-cutting UCs (UC-CC-1…UC-CC-12) + alternative/error/edge variants
- QA test cases: `docs/qa/cognitive-self-check_test_cases.md` — 110 TCs (TC-1.1 … TC-CC-12 spanning per-UC, cross-cutting acceptance, and architect re-review categories)
- Architecture review: PASS (3 MINOR refinements addressed inline in Slices 1, 5; zero `[STRUCTURAL]` fix authorizations; zero security pre-review slices required)
- Resource handoff: `.claude/resources-pending.md` inlined above (zero recommendations)
- Role handoff: `.claude/roles-pending.md` inlined above (zero additional roles)

## Slices

### Wave 1 — produce the rule (sequential)

#### Slice 1: Create `src/rules/cognitive-self-check.md`
- **Wave:** 1
- **UC-coverage:** UC-1 through UC-16, UC-CC-1 through UC-CC-6 (the rule file underpins every behavior every UC describes)
- **TC-coverage:** TC-CC-1 (rule file existence, six `##` headings, four `###` subsection names, in/out scope agent enumeration, "I remember from a similar API / from training data" literal phrase, MERGE_DATE placeholder, bilingual 4-question protocol, executor exemption rationales)
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/rules/cognitive-self-check.md` `[new]`
- **Changes:**
  - Write a NEW file with EXACTLY six `##` headings in this order:
    1. `## Protocol — Before Each Decision` — bilingual 4-question protocol verbatim per FR-1.2: "На чём основано / What is this claim based on?" (with the literal annotation: `"I remember from a similar API / from training data" is NOT a valid source`), "Проверил ли я это в текущей сессии / Did I verify against current state this session?", "Что я предполагаю без доказательств / What am I assuming without proof?", "Если предположение — помечено ли оно / If it's an assumption, is it labelled?".
    2. `## Mandatory Facts Section` — schema spec: every in-scope artifact MUST contain a `## Facts` block with the four `### …` subsections in the exact order `### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions`. Empty subsections MUST use the literal placeholder `(none)`. Cognitive-load constraint verbatim per FR-1.3: `list only facts that load-bear on the decision being made — not every file the agent read`.
    3. `## External Contract Verification` — every API/SDK/library identifier (method name, status enum, field on a request/response schema, library export) MUST be cited in `### External contracts` with the verification source. The literal phrase `"I remember from a similar API / from training data"` MUST appear verbatim in this section as an example of a source that is NOT valid (per FR-1.4 and AC-5).
    4. `## Application Scope` — list the 12 in-scope thinking agents (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer`) and the 5 exempt executor agents (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`) by their registered slugs. Each exempt agent gets a one-line rationale.
    5. `## Plan Critic Enforcement` — document the FILE-vs-STDOUT split per FR-1.6 / FR-4.6: file-based artifacts (PRD sections, use-case files, plan files, `.claude/resources-pending.md`, `.claude/roles-pending.md`, release-notes file) are mechanically enforced by the Plan Critic; stdout-only artifacts (architect, security-auditor, code-reviewer, verifier, refactor-cleaner) are enforced by each agent's own prompt section. State explicitly: "Cognitive self-check enforcement covers file-based artifacts only. Stdout artifacts (architect, security-auditor, code-reviewer, verifier, refactor-cleaner) are enforced by each emitting agent's own prompt."
    6. `## Backward Compatibility` — pre-existing PRD sections (`Date:` predates merge), pre-existing use-case files, pre-existing plan files NOT being re-edited are EXEMPT. Missing/malformed `Date:` falls back to "fail closed" (treat as post-merge) per Risk 7. Include the explicit MERGE_DATE placeholder convention (architect refinement #2): `MERGE_DATE: <YYYY-MM-DD — filled in at merge by release-engineer>`.
- **Verify:**
  ```
  test -f src/rules/cognitive-self-check.md
  grep -Fxc -e "## Protocol — Before Each Decision" \
            -e "## Mandatory Facts Section" \
            -e "## External Contract Verification" \
            -e "## Application Scope" \
            -e "## Plan Critic Enforcement" \
            -e "## Backward Compatibility" \
            src/rules/cognitive-self-check.md
  # expect 6
  awk '/^## /{print; n++} END{exit (n==6?0:1)}' src/rules/cognitive-self-check.md
  # exit 0 — exactly 6 ## headings total
  grep -Fxc -e "### Verified facts" -e "### External contracts" -e "### Assumptions" -e "### Open questions" src/rules/cognitive-self-check.md
  # expect ≥ 4
  for slug in prd-writer ba-analyst architect qa-planner planner security-auditor code-reviewer verifier refactor-cleaner resource-architect role-planner release-engineer; do
    grep -Fq "\`$slug\`" src/rules/cognitive-self-check.md || { echo "missing in-scope: $slug"; exit 1; }
  done
  for slug in test-writer build-runner e2e-runner doc-updater changelog-writer; do
    grep -Fq "\`$slug\`" src/rules/cognitive-self-check.md || { echo "missing exempt: $slug"; exit 1; }
  done
  grep -Fc "I remember from a similar API / from training data" src/rules/cognitive-self-check.md   # expect ≥ 2
  grep -Fc "На чём основано" src/rules/cognitive-self-check.md   # expect ≥ 1
  grep -Fc "MERGE_DATE" src/rules/cognitive-self-check.md   # expect ≥ 1
  grep -Fc "list only facts that load-bear on the decision being made" src/rules/cognitive-self-check.md   # expect ≥ 1
  ```
- **Done when:** all eight grep/awk checks above return their expected counts.
- **Pre-review:** none

---

### Wave 2 — agent-prompt updates (parallel; disjoint files)

#### Slice 2: Doc-writing thinking agents — append `## Cognitive Self-Check (MANDATORY)`
- **Wave:** 2
- **UC-coverage:** UC-2 (planner), UC-3 (prd-writer), UC-9 (ba-analyst), UC-10 (qa-planner)
- **TC-coverage:** TC-2.x (planner); TC-3.x (prd-writer); TC-9.x (ba-analyst); TC-10.x (qa-planner); TC-CC-2 (12-file presence count)
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/prd-writer.md`
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/ba-analyst.md`
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/qa-planner.md`
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md`
- **Changes:** ADDITIVE only (Edit, never Write — Risk 10). For each of the four files, insert a new `## Cognitive Self-Check (MANDATORY)` section per FR-2.15 placement. Each section MUST: (a) reference the rule path `~/.claude/rules/cognitive-self-check.md`, (b) state that the agent runs the 4-question protocol BEFORE writing output, (c) specify the per-agent `## Facts` location:
  - `prd-writer` → `## Facts` at the END of the new PRD section, AFTER the section's terminal subsection per FR-2.3.
  - `ba-analyst` → `## Facts` at the END of `docs/use-cases/<feature>_use_cases.md`, AFTER the last use-case scenario per FR-2.4.
  - `qa-planner` → `## Facts` at the END of `docs/qa/<feature>_test_cases.md`, AFTER the last test case per FR-2.6.
  - `planner` → `## Facts` at the END of `.claude/plan.md`, AFTER `## Review Notes` per FR-2.7.
- **Verify:**
  ```
  for f in src/agents/prd-writer.md src/agents/ba-analyst.md src/agents/qa-planner.md src/agents/planner.md; do
    grep -Fxc "## Cognitive Self-Check (MANDATORY)" "$f"   # expect 1
    grep -Fc "~/.claude/rules/cognitive-self-check.md" "$f"  # expect ≥ 1
    grep -Fc "## Facts" "$f"   # expect ≥ 1
  done
  ```
- **Done when:** all 12 grep checks return ≥ 1.
- **Pre-review:** none

#### Slice 3: Stdout-emitting reviewer agents — append `## Cognitive Self-Check (MANDATORY)`
- **Wave:** 2
- **UC-coverage:** UC-1 (architect), UC-12 (security-auditor), UC-13 (code-reviewer), UC-14 (verifier)
- **TC-coverage:** TC-1.x; TC-12.x; TC-13.x; TC-14.x; TC-CC-2; TC-CC-3 (stdout-only enforcement split)
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/architect.md`
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/security-auditor.md`
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/code-reviewer.md`
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/verifier.md`
- **Changes:** ADDITIVE only. Insert `## Cognitive Self-Check (MANDATORY)` section per FR-2.15. Each section MUST contain the EXACT literal instruction line `Emit a \`## Facts\` block to stdout BEFORE your verdict.` (architect, security-auditor, code-reviewer) or `… BEFORE your PASS/FAIL report.` (verifier). Reference rule path. Instruct running 4-question protocol BEFORE emitting any review prose.
- **Verify:**
  ```
  for f in src/agents/architect.md src/agents/security-auditor.md src/agents/code-reviewer.md src/agents/verifier.md; do
    grep -Fxc "## Cognitive Self-Check (MANDATORY)" "$f"   # expect 1
    grep -Fc "~/.claude/rules/cognitive-self-check.md" "$f"   # expect ≥ 1
    grep -Fc "Emit a \`## Facts\` block to stdout BEFORE your" "$f"   # expect ≥ 1
  done
  ```
- **Done when:** all 12 grep checks return ≥ 1.
- **Pre-review:** none

#### Slice 4: Specialized agents + refactor-cleaner — append `## Cognitive Self-Check (MANDATORY)`
- **Wave:** 2
- **UC-coverage:** UC-6 (resource-architect), UC-7 (role-planner), UC-15 (release-engineer), UC-11 (refactor-cleaner)
- **TC-coverage:** TC-6.x; TC-7.x; TC-15.x; TC-11.x; TC-CC-2; TC-CC-4 (file-based handoff Facts placement)
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/refactor-cleaner.md`
- **Changes:** ADDITIVE only. Insert `## Cognitive Self-Check (MANDATORY)` section per FR-2.15. Per-agent `## Facts` location:
  - `resource-architect` → `## Facts` block in `.claude/resources-pending.md` AFTER `## Auto-Install Results` per FR-2.12.
  - `role-planner` → `## Facts` block in `.claude/roles-pending.md` AFTER `## Reuse Decisions` per FR-2.13.
  - `release-engineer` → `## Facts` block at the END of the release-notes file per FR-2.14.
  - `refactor-cleaner` → `## Facts` block at the END of stdout cleanup report per FR-2.11. Same `Emit a \`## Facts\` block to stdout BEFORE your` instruction shape as Slice 3 reviewers.
- **Verify:**
  ```
  for f in src/agents/resource-architect.md src/agents/role-planner.md src/agents/release-engineer.md src/agents/refactor-cleaner.md; do
    grep -Fxc "## Cognitive Self-Check (MANDATORY)" "$f"   # expect 1
    grep -Fc "~/.claude/rules/cognitive-self-check.md" "$f"   # expect ≥ 1
  done
  grep -Fc ".claude/resources-pending.md" src/agents/resource-architect.md   # expect ≥ 1
  grep -Fc ".claude/roles-pending.md" src/agents/role-planner.md   # expect ≥ 1
  grep -Fc "release-notes" src/agents/release-engineer.md   # expect ≥ 1
  grep -Fc "Emit a \`## Facts\` block to stdout BEFORE your" src/agents/refactor-cleaner.md   # expect ≥ 1
  ```
- **Done when:** all 12 grep checks return ≥ 1.
- **Pre-review:** none

---

### Wave 3 — orchestration & docs (parallel; disjoint files)

#### Slice 5: Plan Critic enforcement — TWO new Completeness bullets in `src/claude.md`
- **Wave:** 3
- **UC-coverage:** UC-4 (Plan Critic detects missing `## Facts`), UC-5 (Plan Critic detects external API without citation), UC-6 (empty subsection without `(none)`), UC-CC-3 (file-vs-stdout split preamble), UC-CC-5 (heuristic external-identifier detection)
- **TC-coverage:** TC-4.x; TC-5.x; TC-6.x; TC-CC-3; TC-CC-5; TC-CC-6
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
- **Changes:** ADDITIVE only. Insert TWO new `> -` bullets INSIDE the embedded Plan Critic blockquote, AFTER the existing last Completeness bullet (`## Reuse Decisions` at line 117) and BEFORE the `**Slice Quality:**` marker (line 119). Both bullets MUST start with literal prefix `> - `. Architect refinement #1: bullet 1 begins `> - The` and bullet 2 begins `> - Any`.
  - **Bullet 1 (Mandatory Facts Section presence):** "The `## Facts` section MUST be present in any current-cycle file-based artifact (PRD section whose `Date:` is on or after MERGE_DATE, current use-cases file, current QA test-cases file, `.claude/plan.md`, `.claude/resources-pending.md`, `.claude/roles-pending.md`, current release-notes file). Missing block = **MAJOR**. Empty subsection lacking the literal `(none)` placeholder = **MINOR**. Pre-existing artifacts EXEMPT per FR-7."
  - **Bullet 2 (External contract identifier without citation):** "Any plan slice, PRD requirement, use case, or test case that mentions a specific external API/SDK/library identifier (dotted method names, quoted enum/status strings, capitalized class/type names matching `^[A-Z][A-Za-z0-9]+$` in code-formatting backticks) MUST have a matching entry in the artifact's `### External contracts` subsection citing the source. Missing citation = **MAJOR**. Citation present but vague = **MINOR**."
  - Additionally, insert one preamble sentence above `**Completeness:**`, prefixed with `> ` per FR-4.6 / AC-10: `> Cognitive self-check enforcement covers file-based artifacts only. Stdout artifacts (architect, security-auditor, code-reviewer, verifier, refactor-cleaner) are enforced by each emitting agent's own prompt.`
  - Architect refinement #3: both new bullets MUST be `> - ` prefixed and MUST NOT contain `^### ` headings.
- **Verify:**
  ```
  # (a) Two new bullets between Completeness and Slice Quality, blockquote-prefixed, reference right tokens.
  awk '/^\*\*Completeness:\*\*/{f=1;next} /^\*\*Slice Quality:\*\*/{f=0} f' src/claude.md \
    | grep -E "^> - (The|Any)" | grep -E "(## Facts|External contracts)" | wc -l
  # expect ≥ 2

  # (b) New bullets explicitly state both severity tags.
  awk '/^\*\*Completeness:\*\*/{f=1;next} /^\*\*Slice Quality:\*\*/{f=0} f' src/claude.md \
    | grep -Ec "(MAJOR|MINOR)"
  # expect ≥ 4

  # (c) Defensive — neither new bullet is a subsection header.
  awk '/^\*\*Completeness:\*\*/{f=1;next} /^\*\*Slice Quality:\*\*/{f=0} f' src/claude.md \
    | grep -Ec "^### "
  # expect 0

  # (d) File-vs-stdout preamble sentence present.
  grep -Fc "> Cognitive self-check enforcement covers file-based artifacts only." src/claude.md
  # expect ≥ 1

  # (e) Sanity counts.
  grep -c "## Facts" src/claude.md   # expect ≥ 2
  grep -c "External contracts" src/claude.md   # expect ≥ 2
  ```
- **Done when:** check (a) ≥ 2; check (b) ≥ 4; check (c) = 0; check (d) ≥ 1; check (e) ≥ 2 for both substrings. Agency Roles table at lines 11–29 byte-unchanged.
- **Pre-review:** architect (sanity check refinements landed verbatim — non-blocking)

#### Slice 6: README.md Hardening table row + new section explaining the rule
- **Wave:** 3
- **UC-coverage:** UC-CC-7 (README documentation surface), UC-CC-12 (user-discoverability)
- **TC-coverage:** TC-CC-7, TC-CC-12
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/README.md`
- **Changes:** ADDITIVE only. Add ONE new row at the END of the existing Hardening table (after line 157, before closing `---` at line 159):
  - `| Decisions built on memory or conjecture, not verified state | Cognitive self-check rule + mandatory \`## Facts\` block (verified facts / external contracts / assumptions / open questions); Plan Critic flags missing or hallucinated entries on file-based artifacts |`
  Also add a new top-level `## Cognitive self-check at authoring time` section after `## Customization` (after line 264, before `## Contributing`), 1–3 paragraphs explaining: (a) 4-question protocol, (b) 12 in-scope + 5 exempt agents, (c) file-vs-stdout enforcement split, (d) Backward Compatibility scope. MUST mention `src/rules/cognitive-self-check.md` path.
  - INVARIANT: tagline `17 specialized AI agents` at line 5 BYTE-UNCHANGED. INVARIANT: `10 quality gates` at line 35 BYTE-UNCHANGED.
- **Verify:**
  ```
  awk '/^## Hardening Against Claude Code Internals/{f=1} f && /^---$/{f=0} f' README.md \
    | grep -Ec "Decisions built on memory or conjecture"   # expect 1
  grep -Fxc "## Cognitive self-check at authoring time" README.md   # expect 1
  grep -Fc "src/rules/cognitive-self-check.md" README.md   # expect ≥ 1
  grep -Fxc "17 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations." README.md   # expect 1
  grep -Fc "10 quality gates" README.md   # expect ≥ 1
  ```
- **Done when:** all five checks return expected counts. `git diff README.md` shows zero hunks at lines 5 and 35.
- **Pre-review:** none

---

## Wave summary

| Wave | Slices | Files (count) | Rationale |
|------|--------|---------------|-----------|
| 1 | 1 | 1 (new rule file) | Sequential — produces the rule file. |
| 2 | 2, 3, 4 | 12 (4+4+4 disjoint agent-prompt files) | Parallel — disjoint sets of agent files. Logical dep on Wave 1. |
| 3 | 5, 6 | 2 (`src/claude.md`, `README.md` — disjoint) | Parallel — different files. Logical dep on Wave 1. |

Total: 6 slices, 3 waves, 15 files affected (1 new + 14 modified).

## Risk assessment

1. **Prompt bloat in already-large agents** — `resource-architect.md` (≈585 LOC), `role-planner.md` (≈467), `release-engineer.md` (≈408). ≈20-line section is 3–5% growth — within NFR-5 tolerance. Mitigation: rule body lives in rule file; per-agent prompts only reference + specify location.
2. **Stdout `## Facts` is agent-self-enforced, not Plan-Critic-enforced** — Plan Critic cannot read transcript. Resolution: file-vs-stdout split documented at three layers (rule file, Plan Critic preamble, per-agent prompts).
3. **Backward-compat scope creep** — pre-existing PRD sections lack `## Facts`. Mitigation: MERGE_DATE placeholder + Plan Critic date-comparison guard; missing/malformed `Date:` fails closed.
4. **`## Facts` format drift** — rule file specifies literal heading and exact subsection names; Plan Critic uses literal-string grep.
5. **Refactor-cleaner emits prose summary, not file** — same as Risk 2. Mitigation: file-vs-stdout scoping.
6. **install.sh re-distribution and version bump** — additive feature, semver minor bump v3.1.0 → v3.2.0. release-engineer at Gate 9 computes actual bump. install.sh BYTE-UNCHANGED.
7. **External-contract identifier detection — false positives** — heuristic intentionally low-recall; agent's own prompt is primary defense, Plan Critic is backstop.
8. **Cognitive load on the agent itself** — rule states "list only facts that load-bear on the decision being made" verbatim per FR-1.3.

## Dependencies

- No new agents (count REMAINS 17 per FR-6.1 / NFR-3 / AC-12)
- No new gates (count REMAINS 10 per FR-6.2 / NFR-4 / AC-13)
- No new commands
- No changes to `install.sh`, `templates/`, or PRD ToC structure
- No new external resources
- No new on-demand roles
- Architect's Step 3 PASS verdict incorporated; three MINOR refinements inlined into Slices 1 and 5

## Review Notes

### Critic Findings
- **Total**: 0 findings (planner pass — exploration plan was already critic-cleaned with 10 findings resolved; this final plan inlines those resolutions plus the architect's three MINOR refinements verbatim into Slices 1 and 5).
- **All CRITICAL/MAJOR addressed**: Yes (zero CRITICAL/MAJOR open).

### Changes Made (vs preliminary exploration plan at `~/.claude/plans/sleepy-exploring-tome.md`)
- Refined every slice into the executable format with `Wave:`, `UC-coverage:`, `TC-coverage:`, `Files:`, `Changes:`, `Verify:`, `Done when:`, `Pre-review:` fields.
- Inlined the architect's three MINOR refinements: (1) literal `> - The` / `> - Any` lexical shape for new Plan Critic bullets in Slice 5; (2) MERGE_DATE placeholder convention in Slice 1's `## Backward Compatibility` with grep verification; (3) defensive `^### ` non-presence check is part of Slice 5's Verify check (c).
- Added explicit cross-wave dependency narrative: Wave 1 → Wave 2 (rule path references), Wave 1 → Wave 3 (rule path references); Wave 2 ↔ Wave 3 are file-disjoint but ordered for narrative coherence.
- Within-wave file disjointness verified by hand and stated in the wave summary table.
- `## Facts` block authored at the top of the plan per FR-2.7 (planner dogfoods the rule); 4 subsections in literal order; External contracts `(none)`.

### Acknowledged Minor Issues
- None. The architect's three MINOR refinements were resolved inline rather than acknowledged.
