# Fixture: five-null-checks

Control for TC-7.3 (UC-7-A2, AC-10) — consolidation (FR-6.4). Five files, each gaining a newly-added
`options` parameter that is dereferenced (`options.userId`) with no null/undefined check anywhere in
the function. The pattern is structurally identical across all five files: same shape, same root
cause (a caller could invoke each of these with `options` omitted and hit a `TypeError`).

## Setup

`diff.patch` touches all five files under `src/`:
- `src/orderService.js`
- `src/invoiceService.js`
- `src/shipmentService.js`
- `src/refundService.js`
- `src/notificationService.js`

Each adds a function taking `(id, options)` and immediately reads `options.userId` without checking
`options` is present first.

## Expected result

Invoke `code-reviewer` against `diff.patch`. The Issues list MUST contain **exactly one**
consolidated finding for "missing null check on `options` parameter," listing all five affected
`file:line` locations — not five separate entries. Splitting this into five entries is a FAIL of
FR-6.4.
