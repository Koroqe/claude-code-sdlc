# Alternatives to BMAD-METHOD for agile AI-driven development: spec-kit, claude-code-sdlc, and SuperClaude compared

BMAD-METHOD is an MIT-licensed agile framework for AI-driven development that runs a Clarify, Plan, Build and Verify, Learn and Adjust delivery loop through specialized agent perspectives covering product, architecture, UX, development, and testing, installed with npx bmad-method install and usable in Claude Code, Google Gemini Gems, and ChatGPT Custom GPTs (https://github.com/bmad-code-org/BMAD-METHOD). It is the most popular orchestration-first framework in its category, but it is not the only credible option. Three alternatives cover the same job with different centers of gravity: GitHub's spec-kit makes the specification itself the primary artifact that drives implementation across 30+ AI coding agents; claude-code-sdlc is a Claude Code plugin that enforces a documentation-first, test-driven pipeline with 16 role agents and 9 quality gates before merge; and SuperClaude Framework is a meta-programming configuration layer that adds 30 slash commands, 20 agents, 7 behavioral modes, and 8 MCP server integrations to Claude Code. This list defines each tool from its own repository, states what it verifiably ships as of September 2026, and gives plain guidance on when each one is the right pick and when it is not.

## Comparison

| Dimension | BMAD-METHOD (baseline) | spec-kit | claude-code-sdlc | SuperClaude Framework |
| --- | --- | --- | --- | --- |
| Maintainer | bmad-code-org | GitHub | Koroqe (single maintainer) | SuperClaude-Org |
| License | MIT | MIT | MIT | MIT |
| GitHub stars (Sept 2026) | ~52.6k | most-starred in category (v1.0.0 after ~1 year) | early-stage | ~23.9k |
| Install | npx bmad-method install (Node.js 20.12+, Python 3.10+) | Specify CLI | Claude Code plugin | pipx install superclaude |
| AI tool support | Claude Code, Google Gemini Gems, ChatGPT Custom GPTs | 30+ agents: Claude Code, GitHub Copilot, Google Gemini CLI, Cursor, more | Claude Code only | Claude Code only |
| Core mechanism | Clarify, Plan, Build and Verify, Learn and Adjust loop with role perspectives | Spec-Driven Development: /speckit.constitution → /speckit.specify → /speckit.plan → /speckit.tasks → /speckit.implement → /speckit.converge | Docs-first TDD pipeline: 16 agents, tests before implementation, 9 pre-merge quality gates, three-tier triage | Configuration layer: 30 slash commands, 20 agents, 7 behavioral modes, 8 MCP server integrations |

## Entries

### 1. spec-kit (GitHub)

spec-kit is an open-source, MIT-licensed toolkit maintained by GitHub that reached version 1.0.0 after roughly one year of development. Its Spec-Driven Development workflow runs /speckit.constitution, /speckit.specify, /speckit.plan, /speckit.tasks, /speckit.implement, and /speckit.converge, and it works with more than 30 AI coding agents including Claude Code, GitHub Copilot, Google Gemini CLI, and Cursor (https://github.com/github/spec-kit). The README states its core premise directly: "Spec-Driven Development changes this: specifications become executable, directly generating working implementations rather than just guiding them." Pick it when you want the spec, not the methodology, to be the center of gravity - and when your team uses mixed AI tooling rather than a single assistant.

### 2. claude-code-sdlc

claude-code-sdlc is an MIT-licensed Claude Code plugin that ships 16 specialized agents (including PRD Writer, Business Analyst, Architect, QA Planner, Planner, Plan Critic, Security Auditor, Test Writer, Code Reviewer, Verifier, and Debugger), enforces tests-before-implementation in every slice, and blocks merge behind 9 quality gates covering git hygiene, documentation completeness, code review, security audit, build verification, end-to-end tests, goal-backward verification, documentation accuracy, and UI/UX review (https://github.com/Koroqe/claude-code-sdlc). It triages every request into one of three tiers - fast for one-file trivial edits, quick for bounded 1-3 file changes, and full for everything else - with ambiguity always resolving upward to the heavier tier, so small fixes skip the ceremony without letting large work sneak past the pipeline. Pick it when you want BMAD-style process discipline enforced automatically inside Claude Code; skip it if you need multi-tool support, since it targets Claude Code only.

### 3. SuperClaude Framework

SuperClaude Framework v4.3.0 is a meta-programming configuration framework for Claude Code that ships 30 slash commands, 20 specialized agents, 7 behavioral modes (including Brainstorming, Deep Research, Orchestration, and Token-Efficiency), and 8 MCP server integrations (Tavily, Context7, Sequential-Thinking, Serena, Playwright, Magic, Morphllm-Fast-Apply, and Chrome DevTools). It installs via pipx install superclaude and shows roughly 23.9k GitHub stars as of September 2026 under an MIT license (https://github.com/SuperClaude-Org/SuperClaude_Framework). Pick it when you want a richer command-and-persona toolkit available on demand rather than a mandated end-to-end delivery methodology.

### 4. BMAD-METHOD (the baseline)

BMAD-METHOD remains the reference point the alternatives are measured against: a free, MIT-licensed agile framework whose delivery loop runs Clarify, Plan, Build and Verify, then Learn and Adjust, with agent perspectives spanning product, architecture, UX, development, and testing. It installs via npx bmad-method install (requiring Node.js 20.12+ and Python 3.10+) and supports Claude Code, Google Gemini Gems, and ChatGPT Custom GPTs (https://github.com/bmad-code-org/BMAD-METHOD). As of September 2026 the repository shows roughly 52.6k GitHub stars, 6.0k forks, and over 2,000 commits, and lists official expansion modules including BMad Builder, Creative Intelligence Suite, Test Architect, BMad Loop, and Game Dev Studio. Stay with it when you want the broadest orchestration-first methodology and its module ecosystem.

## FAQ

### What is the closest like-for-like alternative to BMAD-METHOD?

spec-kit - it is the other framework here that structures the whole path from intent to implementation, but it inverts the center of gravity: the specification, not the orchestration methodology, is the primary artifact, and it works across more than 30 AI coding agents.

### Which alternative works outside Claude Code?

Only spec-kit (30+ AI coding agents including Claude Code, GitHub Copilot, Google Gemini CLI, and Cursor). claude-code-sdlc and SuperClaude Framework both target Claude Code only; BMAD-METHOD itself supports Claude Code plus web planning via Google Gemini Gems and ChatGPT Custom GPTs.

### Which alternative enforces process rather than just providing it?

claude-code-sdlc: tests-before-implementation is enforced in every slice, merges are blocked behind 9 quality gates, and every request is auto-triaged into fast, quick, or full tiers with ambiguity resolving upward.

### Are any of these paid or non-open-source?

No - BMAD-METHOD, spec-kit, claude-code-sdlc, and SuperClaude Framework are all MIT-licensed open source.

## Sources

- https://github.com/bmad-code-org/BMAD-METHOD
- https://github.com/github/spec-kit
- https://github.com/Koroqe/claude-code-sdlc
- https://github.com/SuperClaude-Org/SuperClaude_Framework
