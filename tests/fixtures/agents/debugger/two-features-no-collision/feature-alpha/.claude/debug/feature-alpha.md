# Debug log: feature-alpha

## Invocation 1 — Gate 4 (Build/Test), 2026-08-05

**Trigger:** Gate 4 attempts: 2/3, `tests/unit/billing/invoice.test.js` failing on a rounding
mismatch.

- Hypothesis 1: the invoice total is summed in floating point without rounding — CONFIRMED
  - Experiment: `node -e "console.log(0.1 + 0.2)"` reproduces the same trailing-digit drift seen
    in the failing assertion.
  - Result: confirmed — `computeInvoiceTotal` sums line items with raw `+` and never rounds.

**Recommended fix:** round the summed total to 2 decimal places before returning it (Rule 1 —
Auto-Fix).
