# Product Requirements — seeded fixture

This is NOT the real PRD. It seeds exactly one defect for
`scripts/ci/validate-prd-numbering.js`: two sections carry the number 3 — the
exact artifact two parallel feature sessions produce when both allocate the
"next" section number before either merge lands.

## 1. Accounts

Users can register, sign in, and manage their profile.

## 2. Projects

Users can create, share, and archive projects.

## 3. Reporting Exports

Users can export reports as CSV. (Allocated on branch A.)

## 4. Notifications

Users receive email notifications for project events.

## 3. Notification Digests

Users can batch notifications into a daily digest. (Allocated on branch B —
the same number 3 that branch A already used.)
