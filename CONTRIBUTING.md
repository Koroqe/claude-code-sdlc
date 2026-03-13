# Contributing to Claude Code SDLC

Thanks for your interest in improving the autonomous SDLC pipeline! This project is community-driven — every agent prompt, command, and rule is open for improvement.

## What You Can Contribute

### Improve Agent Prompts
Each agent lives in its own file under `src/agents/`. The prompts are the core of this project — better prompts mean better results.

- `src/agents/architect.md` — Architecture review logic
- `src/agents/ba-analyst.md` — Use case analysis
- `src/agents/planner.md` — Implementation planning
- `src/agents/test-writer.md` — Test generation
- ... and 8 more

**How to improve a prompt:**
1. Fork the repo
2. Edit the agent file in `src/agents/`
3. Test locally: `bash install.sh --local --yes` to install your changes
4. Open a PR with a clear description of what changed and why

### Add New Agents
Want to add a new specialized role? Create a new `.md` file in `src/agents/` following the existing format:

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

### Improve Commands
Pipeline commands live in `src/commands/`. These define the workflow steps like `/bootstrap-feature` and `/implement-slice`.

### Improve Rules
Process rules live in `src/rules/`. These enforce conventions like git workflow, error recovery, and scratchpad usage.

### Improve Templates
Project scaffold templates live in `templates/`. These are what users get when they run `--init-project`.

## Testing Your Changes

```bash
# Install from your local checkout
bash install.sh --local --yes

# Verify files were installed
ls ~/.claude/agents/
ls ~/.claude/commands/
ls ~/.claude/rules/
cat ~/.claude/claude.md

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
