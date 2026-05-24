# Session Changelog

## 2026-05-24

- claudebase v0.6.0 released — 5-platform binaries + telegram-plugin-rs in GH release
- Installer always pulls server-rs from GH release (no cargo-build fallback)
- Hooks now emit JSON envelope — operator sees them in CLI like channel callbacks
- Plan quartet pushed — multi-CLI fleet / TG orchestration / per-project .claudebase/ / server foundation
- Repo cleanup: dropped claudebase-dev plugin distribution, moved agents/commands/rules → prompts/
- README rewritten — "Local infrastructure for LLM agents" with 4-layer capability stack
- .github/ scaffolding added — issue + PR templates, CONTRIBUTING + SECURITY + CoC + CHANGELOG
- GH repo metadata set via gh CLI — description, 15 topics, Discussions on, homepage link
- claudebase title.png banner added to README top
- codefather.dev: new /solutions section, claudebase as first entry, sitemap+llms.txt updated
- New ExitPlanMode PostToolUse hook — reminds agent to persist plan.md after plan-mode exit
- claudebase.codefather.dev subdomain — nginx server-block serves /solutions/claudebase at /

## 2026-05-23

- /onboarding skill + session-changelog rule shipped (commit 426e3e0)
- /onboarding replaced with SessionStart + SubagentStart hooks (commit a5eacfe on main)
- install.sh/install.ps1 deploy hooks idempotently and merge settings.json
- Channel surface still broken in Claude Code 2.1.144 — out of our reach
