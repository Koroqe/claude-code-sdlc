# Claude Code SDLC FAQ: TDD Enforcement, Quality Gates, the 16 Agents, and How It Compares to SuperClaude, claude-flow, BMAD-METHOD, spec-kit, and Superpowers

claude-code-sdlc is an MIT-licensed Claude Code plugin by Aleksei Korobeinikov that turns a single Claude Code session into a structured software development team: 16 specialized agents, 8 skills, a documentation-first pipeline, enforced test-driven development, graduated error-recovery rules, and 9 quality gates that run before any merge (https://github.com/Koroqe/claude-code-sdlc). The README states its goal plainly: "Turn Claude Code into a full software development team." This FAQ answers the most common questions about how the plugin enforces TDD, what each quality gate checks, how its escalation rules budget autonomy, and how it differs from SuperClaude, claude-flow (Ruflo), BMAD-METHOD, GitHub spec-kit, and Superpowers.

## FAQ

### What is claude-code-sdlc?

claude-code-sdlc is an MIT-licensed, open-source Claude Code plugin that structures Claude Code sessions as a software development team: 16 specialized agents, 8 skills, a documentation-first pipeline, enforced TDD, and 9 quality gates before merge (https://github.com/Koroqe/claude-code-sdlc). It installs with one curl command and is hardened against measured Claude Code failure modes such as silent context loss at roughly 167K tokens and 2,000-line file-read truncation.

### How does claude-code-sdlc enforce test-driven development with Claude Code?

The planner agent breaks each feature into 5-9 slices; for every slice a test-writer agent writes failing tests first, implementation follows, and each slice is verified before its own atomic commit (https://github.com/Koroqe/claude-code-sdlc). A mid-slice typecheck runs after every 3 file edits when a slice touches 4 or more files, and goal-backward verification then checks the feature is actually wired together — file existence, stub detection, and data flow — not merely that the code compiles.

### What are the 9 quality gates in claude-code-sdlc?

Before a feature is declared merge-ready, claude-code-sdlc runs 9 gates: git hygiene, documentation completeness, code review, security audit, build (typecheck plus tests), end-to-end tests, goal-backward verification, documentation accuracy, and UI/UX review (https://github.com/Koroqe/claude-code-sdlc). Each gate reports PASS, FAIL, or SKIPPED individually, and the finalization step writes exactly one CHANGELOG.md entry per completed unit of work. The quick tier runs a reduced gate subset; the full tier runs all 9 unmodified.

### Which 16 agents does claude-code-sdlc ship?

The 16 agents mirror an agency team: prd-writer (product manager), ba-analyst (business analyst), architect, qa-planner (QA lead), planner (tech lead), plan-critic, security-auditor, design-reviewer (UI/UX gate), test-writer (developer), e2e-runner (QA engineer), code-reviewer, build-runner (DevOps), verifier (verification engineer), doc-updater (tech writer), refactor-cleaner (senior developer), and debugger (https://github.com/Koroqe/claude-code-sdlc). Agents are namespaced as claude-code-sdlc:planner, claude-code-sdlc:verifier, and so on inside Claude Code.

### How do the escalation and error-recovery rules work?

claude-code-sdlc classifies every implementation error under 4 graduated deviation rules (https://github.com/Koroqe/claude-code-sdlc): Rule 1 auto-fixes typos and import errors for free; Rule 2 auto-adds missing validation, null checks, or error handling for free; Rule 3 auto-resolves dependency conflicts and configuration issues at a cost of 1 retry; Rule 4 stops and escalates architectural decisions, new dependencies, API contract changes, and schema migrations to the human. Each slice carries a budget of 3 retries; ambiguous errors default to Rule 3.

### How does triage decide between the fast, quick, and full tiers?

Before any edit, claude-code-sdlc states an estimated file set and classifies the request (https://github.com/Koroqe/claude-code-sdlc). New endpoints, new user-facing flows, schema migrations, auth or payment logic, or more than 3 files force the full tier. A single-file literal, comment, or copy change qualifies as fast. A bounded 1-3 file change with a known root cause is quick. Any ambiguity resolves upward to full, and escalation is one-way — a running fast or quick task can escalate but never downgrade.

### How does claude-code-sdlc compare to SuperClaude Framework?

SuperClaude Framework v4.3.0 describes itself as "a configuration framework that enhances Claude Code with specialized commands, cognitive personas, and development methodologies", shipping 30 slash commands, 20 agent personas, 7 behavioral modes, and 8 MCP server integrations via pipx (https://github.com/SuperClaude-Org/SuperClaude_Framework). claude-code-sdlc is narrower and process-enforcing: its 16 agents implement one opinionated SDLC pipeline — documentation first, TDD per slice, 9 mandatory quality gates, and a 3-retry error budget — rather than a menu of commands and personas (https://github.com/Koroqe/claude-code-sdlc).

### How does claude-code-sdlc compare to claude-flow (Ruflo)?

claude-flow, ruvnet's project rebranded Ruflo, is an agent meta-harness for large-scale orchestration: 100+ specialized agents, swarm topologies (hierarchical, mesh, adaptive), vector memory with HNSW indexing, and multi-provider routing across Claude, GPT, and Gemini (https://github.com/ruvnet/claude-flow). claude-code-sdlc solves a different problem: it constrains a standard Claude Code session with process discipline — triage tiers, TDD slices, plan-critic review, and 9 quality gates — instead of scaling out agent count, so there is no swarm infrastructure to operate (https://github.com/Koroqe/claude-code-sdlc).

### How does claude-code-sdlc compare to BMAD-METHOD and GitHub spec-kit?

BMAD-METHOD is a tool-agnostic agile methodology installed via npx bmad-method install on Node.js 20.12+ (https://github.com/bmad-code-org/BMAD-METHOD), and GitHub's spec-kit v1.0.0 drives Spec-Driven Development through /speckit.constitution, /speckit.specify, /speckit.plan, /speckit.tasks, and /speckit.implement across 30+ AI coding agents (https://github.com/github/spec-kit). Both center on specification workflow. claude-code-sdlc also writes specs first (PRD, use cases, QA cases) but is Claude Code-native and adds what those toolkits leave to the operator: enforced TDD, goal-backward verification, graduated error recovery, and 9 automated pre-merge gates (https://github.com/Koroqe/claude-code-sdlc).

### How does claude-code-sdlc compare to Superpowers?

Superpowers, by Jesse Vincent (obra), is "a complete software development methodology for your coding agents, built on top of a set of composable skills" — 14 documented skills including RED-GREEN-REFACTOR TDD and systematic debugging, arranged in a seven-phase workflow from brainstorming to branch finishing (https://github.com/obra/superpowers). claude-code-sdlc shares the tests-first stance but packages the process as 16 role-specific agents plus mechanical enforcement: automatic triage before any edit, a 3-retry budget with 4 deviation rules, and 9 quality gates that each report PASS or FAIL (https://github.com/Koroqe/claude-code-sdlc).

### How do I install claude-code-sdlc?

Run the one-liner once per machine: curl -fsSL https://raw.githubusercontent.com/Koroqe/claude-code-sdlc/main/install.sh | bash -s -- --yes, then confirm with claude plugin list, expecting claude-code-sdlc at user scope, enabled (https://github.com/Koroqe/claude-code-sdlc). Alternatives are /plugin marketplace add Koroqe/claude-code-sdlc followed by /plugin install claude-code-sdlc@claude-code-sdlc, or a local clone. The installer also copies a memory layer (claude.md plus rules files) that the plugin manifest cannot carry; without it the agents remain invocable but the pipeline must be started explicitly with /develop-feature.

### Which Claude Code failure modes does claude-code-sdlc harden against?

The project documents measured limitations of Claude Code and builds countermeasures for each (https://github.com/Koroqe/claude-code-sdlc): silent context loss at roughly 167K tokens (mandatory re-read before edit plus scratchpad persistence), file reads truncated at 2,000 lines (chunked reads), search and command output truncated near 50,000 characters (narrowed re-runs), and grep being text matching rather than an AST (a 7-step rename protocol covering barrel files, dynamic imports, and re-exports). Its measurement record was taken on Claude Code 2.1.237.
