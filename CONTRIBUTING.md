# Contributing to Claude Code SDLC

Thanks for your interest in improving the autonomous SDLC pipeline! This project is community-driven — every agent prompt, command, and rule is open for improvement.

## What You Can Contribute

### Improve Agent Prompts
Each agent lives in its own file under `agents/` (the plugin's agent directory). The prompts are the core of this project — better prompts mean better results.

- `agents/architect.md` — Architecture review logic
- `agents/ba-analyst.md` — Use case analysis
- `agents/planner.md` — Implementation planning
- `agents/test-writer.md` — Test generation
- ... and 8 more

**How to improve a prompt:**
1. Fork the repo
2. Edit the agent file in `agents/`
3. Test locally: `bash install.sh --local --yes` to install your changes
4. Open a PR with a clear description of what changed and why

### Add New Agents
Want to add a new specialized role? Create a new `.md` file in `agents/` following the existing format:

```markdown
---
name: your-agent-name
description: One-line description of what this agent does
tools: ["Read", "Glob", "Grep"]  # Only the tools it needs
model: sonnet                     # sonnet, opus, or haiku
---

# Agent Title

Description of what this agent does.

## Process
1. Step one
2. Step two

## Constraints
- What the agent must/must not do
```

**Choosing the model tier:** Default to `sonnet` for new agents. Use `opus` only if the agent's output cascades through multiple downstream agents AND a wrong decision cannot be caught by automated verification (typecheck, test, build). See `docs/PRD.md` Section 3 for the full rationale.

### Improve Skills (formerly "Commands")
Pipeline commands ship as Claude Code plugin skills at `skills/<name>/SKILL.md` (e.g. `skills/bootstrap-feature/SKILL.md`, `skills/implement-slice/SKILL.md`). They resolve as `/claude-code-sdlc:<name>`; the bare form (e.g. `/bootstrap-feature`, `/implement-slice`) works automatically as long as no other installed plugin defines a same-named skill.

### Improve Rules
Process rules live in `src/rules/`. These enforce conventions like git workflow, error recovery, and scratchpad usage.

### Improve Templates
Project scaffold templates live in `templates/`. These are what users get when they run `--init-project`.

## Testing Your Changes

```bash
# Install from your local checkout
bash install.sh --local --yes

# Verify files were installed (commands no longer copy to ~/.claude/commands/ —
# they ship only as the plugin's skills, validated separately below)
ls ~/.claude/agents/
ls ~/.claude/rules/
cat ~/.claude/claude.md

# Verify the plugin's agents and skills
claude plugin validate .

# Test in a real project
cd your-project
claude  # Start Claude Code and try the pipeline
```

## Pull Request Guidelines

- **One change per PR** — don't bundle unrelated changes
- **Explain the "why"** — what problem does this solve? What improvement does it make?
- **Test locally** — verify your changes work with `install.sh --local`
- **Keep prompts concise** — agents work better with clear, focused instructions
- **No breaking changes** — existing workflows should continue to work

## Code of Conduct

Be respectful and constructive. We're all here to make Claude Code better.

## Questions?

Open an issue on GitHub. We're happy to help.
