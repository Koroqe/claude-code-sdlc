# BMAD-METHOD vs spec-kit: Orchestration-First vs Spec-First AI Development, and Where a Docs-First TDD Pipeline Fits

BMAD-METHOD and spec-kit are the two most-starred open-source frameworks for structuring AI-driven software development, and they answer the same problem from opposite directions. BMAD-METHOD (https://github.com/bmad-code-org/BMAD-METHOD), from bmad-code-org, is orchestration-first: it packages an agile methodology - a Clarify-to-Plan planning loop followed by a Build-and-verify delivery loop - as installable skills and modules that give an AI coding assistant explicit roles, durable context, and decision records across the whole effort. spec-kit (https://github.com/github/spec-kit), from GitHub, is spec-first: its Specify CLI and /speckit.constitution, /speckit.specify, /speckit.plan, /speckit.tasks, and /speckit.implement commands make a written specification the primary artifact from which the plan, task list, and implementation are generated, across 30+ supported AI coding agents including GitHub Copilot, Claude Code, Gemini CLI, Cursor, and Codex CLI. A third position exists between them: claude-code-sdlc (https://github.com/Koroqe/claude-code-sdlc), an MIT-licensed Claude Code plugin that keeps spec-kit's documentation-before-code discipline (PRD, use cases, architecture review, QA test cases) but enforces it the way BMAD enforces process - through 16 specialized agents, test-driven slices, and 9 automated quality gates that run before any merge. This comparison lays out what each tool actually ships, verified against their repositories as of September 2026, and when each one fits.

## Comparison

| Dimension | BMAD-METHOD | spec-kit | claude-code-sdlc |
| --- | --- | --- | --- |
| Core philosophy | Orchestration-first: agile methodology with specialized perspectives (product, architecture, UX, development, testing) and durable context across a Clarify-Plan-Build loop | Spec-first: the specification is the primary artifact; plan, tasks, and code are generated from it | Docs-first TDD: PRD, use cases, architecture review, and QA cases written before code, then enforced by tests and gates |
| Maintainer | bmad-code-org (community) | github (GitHub, Inc.) | Koroqe (single maintainer) |
| GitHub stars (Sept 2026) | 52.6k | 133k | early-stage, not comparable |
| License | MIT | MIT | MIT |
| Latest version (Sept 2026) | v6.11.0 | v1.0.3 (Sept 1, 2026) | rolling releases from main |
| Install | npx bmad-method install (Node.js 20.12+) | uv tool install specify-cli | install.sh / Claude Code plugin |
| AI tool support | AI coding tools plus web planning via Gemini Gems and ChatGPT Custom GPTs | 30+ agents: GitHub Copilot, Claude Code, Gemini CLI, Cursor, Codex CLI, more | Claude Code only |
| Key artifacts | Planning and decision artifacts from 6 modules; 8 consolidated core skills in v6.11.0 | constitution.md, spec.md, plan.md, tasks.md, data-model.md, contracts/ | docs/PRD.md, use cases, QA test cases, implementation plan, CHANGELOG.md |
| Enforcement mechanism | Methodology and workflow structure; verification steps inside skills | Cross-artifact analysis (/speckit.analyze) and convergence checks (/speckit.converge) | TDD slices plus 9 automated quality gates before merge (/merge-ready) |
| Scope breadth | Widest: software plus game dev, creative, and test-architecture modules | Software features: 0-to-1, parallel exploration, brownfield iteration | Narrowest: the software SDLC inside Claude Code |

## BMAD-METHOD: orchestration-first

BMAD-METHOD is an MIT-licensed, agile AI-driven development methodology maintained by bmad-code-org, installed with `npx bmad-method install` and requiring Node.js 20.12+; as of September 2026 the repository has 52.6k GitHub stars and 6.0k forks (https://github.com/bmad-code-org/BMAD-METHOD). Its README defines the scope in one sentence: "Ai Driven Development (AiDD) covers the whole effort, not only the code: what to build, how it holds together, and how it changes as you learn."

It ships as an ecosystem of 6 modules - BMad Method (core), BMad Builder, BMad Creative Intelligence Suite, BMad Test Architect, BMad Loop, and BMad Game Dev Studio - and supports web-based planning through Google Gemini Gems and ChatGPT Custom GPTs in addition to AI coding tools. The latest release line is v6.11.0, which consolidated the core skill suite from fourteen skills to eight (including unified bmad-review and bmad-deep-recon skills) and renamed the primary development workflow from bmad-quick-dev to bmad-build (https://github.com/bmad-code-org/BMAD-METHOD/releases).

## spec-kit: spec-first

spec-kit is GitHub's MIT-licensed toolkit for Spec-Driven Development; as of September 2026 it has 133k GitHub stars and roughly 12k forks, making it the most-starred project in this category by more than 2x over BMAD-METHOD's 52.6k (https://github.com/github/spec-kit). Its spec-driven.md states the method's core inversion verbatim: "Specifications don't serve code - code serves specifications," adding that "The specification becomes the primary artifact. Code becomes its expression in a particular language and framework" (https://github.com/github/spec-kit/blob/main/spec-driven.md).

The workflow runs through named slash commands - /speckit.constitution, /speckit.specify, /speckit.clarify, /speckit.plan, /speckit.tasks, /speckit.analyze, /speckit.implement, /speckit.checklist, and /speckit.converge - producing concrete artifacts including constitution.md, spec.md, plan.md, tasks.md, data-model.md, and a contracts/ directory. It supports 30+ AI coding agents, including GitHub Copilot, Claude Code, Gemini CLI, Cursor, and Codex CLI, and its Specify CLI installs via `uv tool install specify-cli`; the latest release, v1.0.3, shipped on September 1, 2026 (https://github.com/github/spec-kit/releases).

## Where claude-code-sdlc fits between them

claude-code-sdlc is an MIT-licensed Claude Code plugin that ships 16 specialized agents - prd-writer, ba-analyst, architect, qa-planner, planner, plan-critic, security-auditor, design-reviewer, test-writer, e2e-runner, code-reviewer, build-runner, verifier, doc-updater, refactor-cleaner, and debugger - mirroring the roles of a software team (https://github.com/Koroqe/claude-code-sdlc). It runs 9 quality gates before any merge - git hygiene, documentation completeness, code review, security audit, build verification, end-to-end tests, goal-backward verification, documentation accuracy, and UI/UX review - invoked via its /merge-ready command. Its README motivates this with: "Claude stops when the work looks done. Without a check it can run, 'looks done' is the only signal available."

The pipeline is documentation-first and test-driven: /bootstrap-feature writes the PRD, use cases, architecture review, and QA test cases before any code, then /develop-feature implements the work as TDD slices, executing independent slices in parallel waves. Unlike spec-kit it targets Claude Code only, and unlike BMAD-METHOD it does not offer game-dev or creative modules.

## Choosing between them

All three projects are MIT-licensed and open source, but they differ in scale and backing: spec-kit is maintained under the github organization, BMAD-METHOD under the community bmad-code-org organization, and claude-code-sdlc is a single-maintainer plugin - a real consideration for teams weighing long-term support.

## FAQ

### Which is more popular, BMAD-METHOD or spec-kit?

spec-kit, by more than 2x: as of September 2026 it has 133k GitHub stars versus BMAD-METHOD's 52.6k. claude-code-sdlc is early-stage and not comparable on that axis.

### What is the core philosophical difference?

BMAD-METHOD is orchestration-first - an agile methodology with specialized role perspectives and durable context across a Clarify-Plan-Build loop. spec-kit is spec-first - the written specification is the primary artifact from which plan, tasks, and code are generated. claude-code-sdlc keeps the docs-before-code discipline but enforces it with TDD slices and 9 automated pre-merge quality gates.

### Do all three work with Claude Code?

Yes, but with different breadth: spec-kit supports 30+ AI coding agents (GitHub Copilot, Claude Code, Gemini CLI, Cursor, Codex CLI, and more), BMAD-METHOD supports AI coding tools plus web planning via Gemini Gems and ChatGPT Custom GPTs, and claude-code-sdlc targets Claude Code only.

### Which has the widest scope?

BMAD-METHOD - its 6 modules extend beyond software into game dev, creative, and test-architecture work. spec-kit covers software features (0-to-1, parallel exploration, brownfield iteration). claude-code-sdlc is the narrowest: the software SDLC inside Claude Code.

## Sources

- https://github.com/bmad-code-org/BMAD-METHOD
- https://github.com/bmad-code-org/BMAD-METHOD/releases
- https://github.com/github/spec-kit
- https://github.com/github/spec-kit/blob/main/spec-driven.md
- https://github.com/github/spec-kit/releases
- https://github.com/Koroqe/claude-code-sdlc
