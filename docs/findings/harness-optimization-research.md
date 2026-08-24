# What the best agentic harnesses do — researched, and what we changed because of it

Researched 2026-08-24 across the primary literature and the source of production harnesses
(SWE-agent, Agentless, Aider, Cline, OpenHands, Cursor, Windsurf/Devin, MetaGPT, ChatDev, CrewAI,
LangGraph, Codex CLI, Amp). Claims below are tagged **[M]** measured with numbers in a primary
source, or **[A]** asserted without measurement. Where a widely-repeated number turned out not to
exist in its cited source, that is stated.

The house rule applies to research as much as to code: **a claim with no measurement behind it is a
lead, not a finding.**

---

## 1. The one finding that reorganised everything else

> **Every measured win came from a deterministic external oracle placed in the loop. Every negative
> result came from a model judging itself.**

- Linter guard on every edit, revert-on-fail: **18.0% vs 15.0%** resolved, SWE-bench Lite **[M]**
  (SWE-agent, NeurIPS 2024, Table 3). The only ablation in the literature isolating a single harness
  feature with a clean delta.
- Execution feedback against the repo's real tests: **28.5% → 43.9%** SR@1 **[M]** (SWE-Dev).
- Test-based candidate selection: random **45.8%** → actual **57.4%** → oracle **69.8%** **[M]**
  (CodeMonkeys, SWE-bench Verified). Selection, not generation, holds the headroom.
- Against these: intrinsic self-correction without external feedback "does not improve, and often
  degrades" code and reasoning performance **[M]** (TACL survey); merely asking "are you sure?"
  reliably *drops* accuracy **[M]** (FlipFlop).

**What we did:** built the oracle we did not have — `scripts/eval/run-evals.js` plus `evals/cases/`,
a deterministic behavioural eval. See §6.

---

## 2. The closest architectural analogue to this harness was benchmarked into the ground

MetaGPT is a fixed multi-role SOP waterfall — Product Manager → Architect → Project Manager →
Engineer → QA — which is very nearly our own agent lineup.

- **E2EDev** (46 real projects, 244 requirements, 703 BDD scenarios): MetaGPT scored **0.00%**
  requirement accuracy / 0.18% test accuracy, against **46.23% / 61.96% for calling the raw model
  once with no framework at all** **[M]**.
- **44%** of its failures were code-consistency (missing files, syntax errors); **43% of those** were
  the programmer agent **ignoring the architect's declared file structure** **[M]**.
- Its own maintainers abandoned the fixed SOP (issue #1498) as too rigid for incremental work; the
  successor paper (AFlow, ICLR 2025 oral) names hand-built workflows as *the problem* and searches
  for them instead — scoring **94.7% HumanEval** against the hand-coded SOP's 85.9% **[M]**.
- ChatDev, the other waterfall: **33.33%** correctness on ProgramDev under independent measurement
  **[M]** (MAST), against its own paper's 88% "executability" — which an independent team notes is
  "just a coarse-grained check to ensure the code runs without crashing" **[M]**.
- CrewAI's own decision matrix routes **every** use case requiring reproducibility away from
  autonomous crews into deterministic Flows **[A]**, and its hierarchical manager has a
  two-and-a-half-year run of the same defect — 268 issues mentioning `allow_delegation`, including
  one where hierarchical mode silently degrades into sequential **[M]** (issue counts queried).

**The honest reading.** The waterfall is not what distinguishes a working harness from a failing one.
MetaGPT is a waterfall *with no deterministic oracle* — its "done" signal is one agent's opinion of
another agent's artifact. Ours is a waterfall *with* 16 validators, 22 test suites, 12 guards and a
goal-backward verifier that reads YAML frontmatter rather than prose claims. That is a real
difference, but it was an **untested belief** until this research forced it into the open — which is
precisely why the eval got built before anything else.

Two concrete defences we already had, now known to be load-bearing rather than incidental:
`plan-critic` verifying every file path against the filesystem, and step 1a checking that a
subagent's `files_written` falls inside its declared `Files:` — the exact failure that accounts for
43% of MetaGPT's consistency failures.

---

## 3. What the evidence says to STOP doing

- **Forcing agents to author tests does ~nothing for task resolution.** Claude-opus-4.5 writes tests
  in ~83% of tasks → 74.4% resolved; GPT-5.2 writes them in ~0.6% → 71.8% — a 2.6pp gap. Forcing
  GPT-5.2 to write tests across ~500 tasks produced **zero net change**; forcing Gemini-3-pro produced
  **five fewer successes** **[M]**. Agent-written "tests" are mostly print statements; relational
  assertions appear in 3–8% of them.
  *Scope caveat, and it matters here:* that measures **resolving the task in front of you**, in repos
  that already have strong test suites. Our slices write tests into repos where they become the
  durable regression suite — a different payoff the study does not measure. Recorded as a genuine
  tension, not adopted as a mandate to stop.
- **"Tests pass" is not a done-condition.** 31% of trajectories pass local tests without resolving the
  issue; **23.8% of patches carry no bug-discriminating evidence at all**; UTBoost found **345**
  wrongly-passed patches in SWE-bench itself **[M]**. The criterion that survives is a test that
  **fails before the change and passes after**.
- **Multi-agent debate for generation degrades output**: **−1.6 to −15.5pp** across four models, while
  improving *detection* by **+27.4pp F1**, at 4–6× the cost **[M]**. Our split — read-only critics for
  detection, one agent per slice for generation — is on the right side of this; the finding is now a
  documented anti-pattern so nobody "improves" the generation path by adding debate.
- **Full-file context (−5.3pp) and full history (−3.0pp)**, and **raw iterative search is worse than
  having no search at all** (12.0 vs 15.7) **[M]**.
- **Repository overviews in instruction files are dead weight.** The strongest study (438 tasks, four
  agent/model combos, three arms) found context files "do not generally improve task success rates,
  while increasing inference cost by over 20%" — but that *imperative instructions* are followed
  reliably (a named tool used 1.6× per instance vs <0.01× when unmentioned) **[M]**. Anthropic's own
  docs land in the same place independently.

## 4. What the evidence says to consider doing (not yet built)

- **Stall detection.** MAST's largest single failure mode is **step repetition at 17.14%** **[M]**.
  OpenHands ships five heuristics with exact thresholds — 4 identical action/observation pairs, 3
  identical actions + 3 errors, 3 identical agent messages with no observation between, a 6-step
  ping-pong, ≥10 consecutive condensations **[A]** — and the craft is `_eq_no_pid`: **normalise before
  comparing** (drop PIDs and timestamps, compare edits on their first 3 lines) or a real loop is never
  detected. Cost here: we are at **12/12 hook ids**, so this requires retiring one.
- **A confidence signal gating autonomy.** Devin publishes 🟢/🟡/🔴 at plan time and asks clarifying
  questions below green; 🟢 correlates with **twice the merged-PR likelihood** of 🔴 **[M]**. Our
  pipeline has no way to express uncertainty short of a Rule 4 escalation.
- **Turn/cost tripwire → replan, not more retries.** Unresolved runs cost ~2× and take ~1.75× the
  turns of resolved ones **[M]**. Our debugger-at-2/3 is already this shape.
- **`maxTurns` on agent frontmatter.** Supported, we set it nowhere; a direct bound on runaway.
- **Progressive disclosure.** Claude Code deleted >80% of its own system prompt with no measured eval
  loss **[M]**, and skills are built for it (~450 tokens for name+description; body on invocation).
  **But no measurement anywhere covers relocating *mandatory gating rules*** — and Triage Steps 1–7
  are exactly that: the rule must fire *before* the first Edit, so the demand signal is the thing
  being gated. Not attempted until the eval can prove compliance survives.

## 5. Measured baseline of this harness (2026-08-24)

Instrument: `claude plugin details` (reports projected token cost) — note `claude plugin eval` exists
on the CLI but is **gated to early access on this account** (measured: prints "currently in early
access"), which is why the eval below is homegrown.

| Metric | Measured |
|---|---|
| Plugin always-on context | ~1,155 tok/session |
| Memory layer always-on | 40,164 bytes ≈ ~11k tok/session, every project |
| merge-ready on-invoke | ~14.7k tok |
| develop-feature on-invoke | ~11.5k tok |
| implement-slice on-invoke | ~7.7k tok **× every slice** |
| Skill text alone, one 8-slice feature | ≈ **93k tok** before any agent thinking |
| Hook test sweep | 91 s (validators 1 s) |
| Wave-record corpus | 62 records; **21/62 (34%)** succeeded *with* nonzero errored tool results |

That last row is the empirical basis for the calibrated errored-results rule shipped in 4.6.0 — an
absolute "must be 0" would have flagged a third of healthy runs.

## 6. What was built, and what it measured

`scripts/eval/run-evals.js` + `evals/cases/` + `tests/hooks/test-eval-graders.js` (30 checks, 8 of
them seeded-broken). Design and its two hard-won traps are documented in `evals/README.md`.

**First real baseline: 4/4 Triage cases pass** — including the case where `install.sh` is a sensitive
path and must force `full` despite looking like a trivial one-line literal.

**The result that matters most is the one that was wrong first.** The suite initially reported
`0/4`, then `2/4`. Neither was real:

1. `0/4` — a sandboxed `HOME` stripped the CLI's credentials, so no session ran at all. Every case
   "failed" in ~1 s.
2. `2/4` — `maxTurns: 2` cut two runs off before they stated a tier. The graders were right that no
   tier was stated; the reason was starvation, not misclassification. At `maxTurns: 6`, 4/4.

Both failures pointed at the *product* while the *instrument* was broken, and both did so in the
direction that looks like a genuine finding. A less sceptical pass would have filed two defects
against Triage that do not exist. This is the strongest practical argument in this document for the
discipline the repo already claims: **empty or surprising output is not evidence until you have
confirmed the command actually ran.**

## 7. Where our design was independently converged on

Recorded because they were beliefs before, and are evidence now:

- **Read-only reviewer agents in separate contexts** — Amp's "Oracle" subagent is the same pattern;
  the self-correction literature says intrinsic critique fails while external critique works **[M]**.
- **Orchestrator-owns-the-write** — Cognition's Principle 1 (share full traces) and Anthropic's own
  architecture (parallel reads, single-threaded synthesis) both land here **[A]/[M]**.
- **Deterministic seeded-broken fixtures** — Cline built exactly this for its highest-risk mechanism
  and attributed a **>10% average diff-edit gain** to what it found **[M]**.
- **Bounded retry with a named ceiling** — Aider's `max_reflections = 3`, one shared budget across
  causes, matches `error-recovery.md`'s 3-retry rule **[M]**.

## 8. Deliberately not adopted

- **A custom edit format** (`apply_patch`/V4A). OpenAI publishes **no** measured advantage over
  SEARCH/REPLACE and concedes both it and pseudo-XML "had high success rates"; its stated reason is
  training-distribution match. The widely-cited "52.9%/92.4%" figures **do not appear** in the cited
  source. For a Claude-based harness this argues for the native Edit tool.
- **A repo map** (Aider's tree-sitter → PageRank). Real infrastructure, and **Aider itself publishes
  no ablation showing it helps**.
- **Condensation as tombstones over an append-only log** (OpenHands). Excellent design, but presumes
  you own the history; Claude Code owns compaction here. Also worth knowing before anyone sells it as
  a quality win: measured at **200 vs 203** resolved and **+$40** — it buys bounded latency and
  per-turn cost, not accuracy **[M]**.
