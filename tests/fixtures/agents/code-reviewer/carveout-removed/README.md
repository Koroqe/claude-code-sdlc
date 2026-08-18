# Fixture: code-reviewer / carveout-removed  (TC-5.7)

Identical to `carveout-present/` — same diff, same absent `docs/qa/*` — with the carve-out sentence
**removed**.

This is the negative control that makes TC-5.5 meaningful. If the reviewer stays silent about the
missing QA file here too, then TC-5.5 proved nothing: the silence was never attributable to the
carve-out. Expected: without the carve-out, the absent QA document IS reportable.
