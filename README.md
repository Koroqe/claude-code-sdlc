# Claude Code SDLC

**Turn Claude Code into a full software development team.**

12 specialized AI agents. Documentation-first pipeline. TDD enforcement. Quality gates before every merge. Hardened against Claude Code's known internal limitations.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.1.0-green.svg)]()

---

## The Problem

Claude Code is powerful, but out of the box it has habits that burn you on real projects:

- **Writes code before understanding requirements** — jumps straight to implementation
- **Skips tests** — or writes them after the fact as an afterthought
- **Ignores architecture** — puts business logic in route handlers, breaks module boundaries
- **Reports success when the code doesn't compile** — its internal success metric is "did bytes hit disk?", not "does this build?"
- **Silently loses context** — after ~167K tokens, auto-compaction wipes file reads and reasoning chains, then edits against stale memory
- **Misses references during renames** — grep is text matching, not an AST; dynamic imports, re-exports, and barrel files get missed
- **Truncates results without warning** — file reads cap at 2,000 lines, search results cap at ~50K characters, and the agent doesn't know it's working with incomplete data

## The Solution

This project fixes all of that. One install, and Claude Code becomes a **12-agent development team** with a structured pipeline, mandatory documentation phases, TDD enforcement, quality gates, and built-in defenses against its own mechanical limitations.

---

## What's New: Post-Source-Code-Analysis Hardening (April 2025)

Following the public analysis of Claude Code's leaked source code, we reviewed the internal mechanics and added targeted overrides for every documented failure mode:

| Problem | What Claude Code Does Internally | Our Fix |
|---------|----------------------------------|---------|
| **False success reports** | File write success = bytes hit disk, nothing more | Mandatory typecheck verification after edits; mid-slice typecheck every 3 files for large slices |
| **Context death spiral** | Auto-compaction at ~167K tokens destroys file reads and reasoning | Mandatory re-read-before-edit rule; context budget awareness; scratchpad archiving at 100+ lines |
| **Silent file truncation** | Read tool caps at 2,000 lines — agent doesn't know it missed content | Rule requiring chunked reads for files >500 LOC with offset/limit |
| **Search result truncation** | Results >50K chars replaced with 2K preview — agent thinks that's everything | Rule to narrow scope and re-run when results look suspiciously small |
| **Grep misses references** | Text pattern matching, not semantic — misses dynamic imports, re-exports, barrel files | 7-step rename safety protocol: whole-word grep, barrel files, dynamic imports, test files, config files, typecheck verify, fix missed |
| **Simplicity bias blocks fixes** | System prompt says "try simplest approach", "don't refactor beyond what was asked" | Architect `[STRUCTURAL]` action items explicitly authorize implementing agents to make structural fixes |
| **No pre-refactor cleanup** | Dirty code (dead imports, unused exports) wastes tokens and accelerates compaction | Step 0 cleanup: remove dead code first, commit separately, establish clean baseline before refactoring |

These aren't prompt hacks or adversarial overrides. They're structured rules integrated into the agent pipeline — each one scoped to the specific failure mode it addresses.

---

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/Koroqe/claude-code-sdlc/main/install.sh | bash
```

Or clone and install locally:

```bash
git clone https://github.com/Koroqe/claude-code-sdlc.git
cd claude-code-sdlc
bash install.sh --yes
```

To also scaffold a new project:

```bash
bash install.sh --init-project
```

---

## How It Works

Every feature flows through a structured pipeline:

```
  Feature Request
       |
       v
  +-----------+
  | PLAN MODE |  Explore codebase -> Design approach -> Plan Critic review
  +-----------+
       |
       v  (user approves)
  +---------------------+
  | /bootstrap-feature  |
  +---------------------+
       |
       +---> PRD Writer .............. documents requirements
       +---> Business Analyst ........ writes use cases
       +---> Architect ............... reviews design
       +---> QA Lead ................. documents test cases
       +---> Tech Lead ............... creates implementation plan
       |
       v
  +---------------------+
  | /implement-slice    |  (loops for each slice)
  +---------------------+
       |
       +---> Re-read files from disk (never trust stale context)
       +---> Write tests first (TDD)
       +---> Implement to pass tests
       +---> Mid-slice typecheck (if 4+ files)
       +---> Verify: typecheck + tests + build
       +---> Commit
       |
       v
  +---------------------+
  | /merge-ready        |
  +---------------------+
       |
       +---> Code Review
       +---> Security Audit
       +---> Build Verification
       +---> E2E Tests
       +---> Documentation Check
       |
       v
  MERGE READY
```

### The Pipeline In Detail

| Phase | What Happens | Who Does It |
|-------|-------------|-------------|
| **Plan** | Explore codebase, design approach, write plan, critic review | You + Claude |
| **Bootstrap** | PRD, use cases, architecture review, QA test cases, implementation plan | 5 agents |
| **Implement** | TDD slices: tests first, implement, verify, commit | 2 agents per slice |
| **Quality Gates** | Code review, security audit, build, E2E tests, docs check | 5 agents |

---

## The Agency

12 specialized agents, each with a clear role:

| Role | Agent | What It Does |
|------|-------|-------------|
| Product Manager | `prd-writer` | Documents feature requirements in `docs/PRD.md` |
| Business Analyst | `ba-analyst` | Analyzes use cases and scenarios in `docs/use-cases/` |
| Software Architect | `architect` | Reviews architecture, validates boundaries, issues `[STRUCTURAL]` fix authorizations |
| QA Lead | `qa-planner` | Documents test cases in `docs/qa/` before any code |
| Tech Lead | `planner` | Breaks features into 5-9 testable implementation slices |
| Security Engineer | `security-auditor` | Audits for vulnerabilities, checks auth boundaries |
| Developer | `test-writer` | Writes tests following TDD — tests before implementation |
| QA Engineer | `e2e-runner` | Creates and runs end-to-end tests from use cases |
| Code Reviewer | `code-reviewer` | Reviews for quality, security, and architecture compliance |
| DevOps | `build-runner` | Runs typecheck, tests, and build verification |
| Tech Writer | `doc-updater` | Keeps documentation accurate after changes |
| Senior Developer | `refactor-cleaner` | Post-implementation cleanup with rename safety and Step 0 protocol |

---

## Pipeline Commands

| Command | Description |
|---------|-------------|
| `/develop-feature` | Full autonomous pipeline — from request to merge-ready |
| `/bootstrap-feature` | Documentation phases only — PRD, use cases, architecture, QA, plan |
| `/implement-slice` | Implement the next TDD slice — tests first, then code |
| `/merge-ready` | Run all quality gates — code review, security, build, E2E, docs |
| `/context-refresh` | Rebuild session context from scratchpad (for long sessions) |

### Usage

Just start Claude Code and describe what you want:

```
> Add user authentication with Google OAuth

Claude will automatically:
1. Enter plan mode -> explore codebase -> design approach -> critic review
2. Run /bootstrap-feature -> PRD -> use cases -> architecture -> QA -> plan
3. Loop /implement-slice -> TDD for each slice
4. Run /merge-ready -> all quality gates pass
```

Or use commands directly:

```
> /develop-feature Add a notification system for low balance alerts
```

---

## Built-In Safeguards

These rules run automatically on every session — no manual configuration needed.

### Context Integrity
- **Re-read before edit**: Every file is re-read from disk before modification — never trusts in-memory content that may have been destroyed by auto-compaction
- **Context budget**: Agents read only relevant sections of large files using offset/limit, not entire files
- **Scratchpad archiving**: When the scratchpad exceeds 100 lines, completed work is moved to an Archive section to prevent the persistence mechanism itself from consuming context

### Edit Safety
- **Mid-slice typecheck**: When a slice edits 4+ files, typecheck runs after every 3 edits to catch cascading errors early
- **End-of-slice verification**: Every slice runs typecheck + tests + build before commit — the agent cannot report success without passing verification
- **Error recovery**: Autonomous fix-and-retry up to 3 times before escalating to the user

### Refactor Safety
- **Step 0 cleanup**: Before any refactor touching 5+ files, dead code is removed and committed separately to establish a clean baseline
- **Rename safety protocol**: 7-step checklist covering whole-word grep, barrel files, dynamic imports, test files, config files, typecheck verification
- **Architect authority**: When the architect flags structural violations, implementing agents are authorized to make fixes beyond minimal-diff defaults

### Tool Limitation Awareness
- **File read cap**: Files over 500 LOC are read in chunks — the 2,000-line Read tool limit is never hit silently
- **Search truncation**: When grep or bash results look suspiciously small, agents re-run with narrower scope
- **Grep is not an AST**: Renames and refactors use a multi-pass search strategy, not a single grep

---

## Project Setup

When starting a new project, scaffold the SDLC structure:

```bash
cd your-project
bash install.sh --init-project
```

This creates:

```
.claude/
  CLAUDE.md              # Your project's tech stack, structure, commands (fill in TODOs)
  scratchpad.md          # Session state persistence
  settings.json          # Permissions config
  rules/
    architecture.md      # Module boundaries and constraints
    security.md          # Security requirements
    testing.md           # Test setup and commands

docs/
  PRD.md                 # Product requirements document
  qa/                    # QA test case directory
  use-cases/             # Use case document directory
```

**Fill in the TODOs** in `.claude/CLAUDE.md` with your project's actual tech stack, commands, and architecture. The more context you provide, the better the agents perform.

---

## What Gets Installed

The installer adds files to `~/.claude/` (user-level, applies to all projects):

```
~/.claude/
  claude.md              # Main workflow instructions
  agents/                # 12 agent prompt files
    architect.md
    ba-analyst.md
    build-runner.md
    code-reviewer.md
    doc-updater.md
    e2e-runner.md
    planner.md
    prd-writer.md
    qa-planner.md
    refactor-cleaner.md
    security-auditor.md
    test-writer.md
  commands/              # 5 pipeline commands
    bootstrap-feature.md
    context-refresh.md
    develop-feature.md
    implement-slice.md
    merge-ready.md
  rules/                 # 4 process rules
    error-recovery.md
    git.md
    scratchpad.md
    tool-limitations.md
```

---

## Customization

### Modify Agent Prompts

Each agent is a standalone markdown file. Edit them directly:

```bash
# Example: make the architect more strict about module boundaries
vim ~/.claude/agents/architect.md
```

Or fork this repo, edit in `src/agents/`, and reinstall:

```bash
bash install.sh --local --yes
```

### Add New Agents

Create a new `.md` file in `src/agents/` (or `~/.claude/agents/`):

```markdown
---
name: your-agent
description: What it does
tools: ["Read", "Glob", "Grep"]
model: sonnet
---

# Agent Title

Instructions for the agent...
```

### Change Models

Each agent specifies its model in the frontmatter. Change `model: sonnet` to `opus` or `haiku` based on your needs and budget.

---

## Key Concepts

### Documentation-First
Every feature starts with documentation — PRD, use cases, test cases — before any code is written. This ensures Claude understands the full scope before implementing.

### TDD Enforcement
Tests are written before implementation. The `test-writer` agent creates failing tests, then code is written to make them pass.

### Plan Critic
After writing a plan, an adversarial "critic" agent reviews it for missing dependencies, vague requirements, wrong file paths, and oversized slices. This catches issues before implementation starts.

### Scratchpad Persistence
The `.claude/scratchpad.md` file survives context compaction during long sessions. Progress, current slice, and blockers are always available — with automatic archiving to prevent the scratchpad itself from bloating context.

### Use Case-Driven
The Business Analyst creates comprehensive use-case documents that drive both QA test cases and E2E tests. Every test traces back to a documented scenario.

### Tool Limitation Awareness
Rules that account for Claude Code's internal constraints — file read caps, search truncation, text-only grep — so agents never silently work with incomplete data.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to improve agent prompts, add new agents, and submit changes.

## License

[MIT](LICENSE)
