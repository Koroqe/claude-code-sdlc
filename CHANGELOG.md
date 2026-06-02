# Changelog

All notable changes to this project, newest first. Entries are grouped by UTC date.

## 2026-06-02

### Changelog Automation — 19:44 UTC
**Summary:** The toolkit now keeps an automatic, plain-language changelog so anyone can see what changed in a project and when.
**Details:** Added a canonical changelog rule (src/rules/changelog.md) and wired it into the pipeline: /merge-ready writes one entry per feature after all gates pass, and a standalone /implement-slice logs standalone fixes. Entries are grouped by UTC day (newest first) with a real date -u timestamp, feature name, non-technical summary, and ≤500-char details. /develop-feature passes a no-changelog flag to driven slices and an idempotency guard prevents duplicates. Installed to ~/.claude.
