# Changelog

All notable changes to this project, newest first. Entries are grouped by UTC date.

## 2026-06-02

### Changelog: CTO-level Technical details — 23:35 UTC
**Summary:** Changelog entries can now carry a short, leadership-friendly "technical details" note that stays high-level instead of listing code internals.
**Details:** Adds an optional Technical details field to the changelog standard, written for engineering leadership: it describes screens, endpoints, components, and any architecture or deployment changes, and explicitly excludes file names, function names, and other low-level detail. The standard ships in the toolkit and is installed locally so every project can use it.
**Technical details:** Extends the shared changelog rule with an optional CTO-level "Technical details" guideline (with avoid/prefer examples) and documents it in the toolkit's README and product requirements. Documentation/standard only — no application, data, or deployment changes.

### Changelog Automation — 19:44 UTC
**Summary:** The toolkit now keeps an automatic, plain-language changelog so anyone can see what changed in a project and when.
**Details:** Added a canonical changelog rule (src/rules/changelog.md) and wired it into the pipeline: /merge-ready writes one entry per feature after all gates pass, and a standalone /implement-slice logs standalone fixes. Entries are grouped by UTC day (newest first) with a real date -u timestamp, feature name, non-technical summary, and ≤500-char details. /develop-feature passes a no-changelog flag to driven slices and an idempotency guard prevents duplicates. Installed to ~/.claude.
