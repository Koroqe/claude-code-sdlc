# Changelog

All notable changes to this project, newest first. Entries are grouped by UTC date.

## 2026-08-14

### Plugin Repackaging and Harness CI — 23:15 UTC
**Summary:** The toolkit now installs as a Claude Code plugin, and it cleans up the older files that would otherwise quietly override it. Your own personal files are never touched.
**Details:** The agents and pipeline commands now ship as a plugin, while a small installer keeps the always-on instructions in place — both are needed, and the setup guide explains why. Upgrading removes older files that would have silently overridden the new ones, so an upgrade genuinely takes effect. Removal follows an explicit list, never a wildcard, and takes a backup first. New preview, undo and restore options let you reverse any change. Automated checks now guard the toolkit's own files.
**Technical details:** Repackages the harness as a Claude Code plugin with a marketplace manifest; agents and skills are now distributed through it, while a slimmed installer retains only the user-memory layer, because that channel has no plugin equivalent. Upgrades remove superseded v3.x agent and command copies that would otherwise take precedence over their plugin replacements and make future updates ineffective. Installer gains manifest-scoped removal, an install receipt, atomic backup, and preview/uninstall/restore modes, all guarded against writing or deleting outside its own directory. Adds a CI suite that validates the harness's own assets and proves each check fails on a seeded defect. No runtime service, data or deployment changes.

## 2026-06-02

### Changelog: CTO-level Technical details — 23:35 UTC
**Summary:** Changelog entries can now carry a short, leadership-friendly "technical details" note that stays high-level instead of listing code internals.
**Details:** Adds an optional Technical details field to the changelog standard, written for engineering leadership: it describes screens, endpoints, components, and any architecture or deployment changes, and explicitly excludes file names, function names, and other low-level detail. The standard ships in the toolkit and is installed locally so every project can use it.
**Technical details:** Extends the shared changelog rule with an optional CTO-level "Technical details" guideline (with avoid/prefer examples) and documents it in the toolkit's README and product requirements. Documentation/standard only — no application, data, or deployment changes.

### Changelog Automation — 19:44 UTC
**Summary:** The toolkit now keeps an automatic, plain-language changelog so anyone can see what changed in a project and when.
**Details:** Added a canonical changelog rule (src/rules/changelog.md) and wired it into the pipeline: /merge-ready writes one entry per feature after all gates pass, and a standalone /implement-slice logs standalone fixes. Entries are grouped by UTC day (newest first) with a real date -u timestamp, feature name, non-technical summary, and ≤500-char details. /develop-feature passes a no-changelog flag to driven slices and an idempotency guard prevents duplicates. Installed to ~/.claude.
