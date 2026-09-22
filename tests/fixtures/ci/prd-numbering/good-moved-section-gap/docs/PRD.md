# Product Requirements — seeded fixture

This is NOT the real PRD. It seeds the LEGAL end state of a rename/move:
section 7 ("Legacy Import") was renamed and its content folded into section 4,
so no `## 7.` heading remains. The number 7 is vacated forever — allocation is
`max(existing) + 1`, never "next available gap" — so the next section added to
this file must be numbered 10, not 7.

## 1. Accounts

Users can register, sign in, and manage their profile.

## 2. Projects

Users can create, share, and archive projects.

## 3. Reporting Exports

Users can export reports as CSV.

## 4. Data Import

Users can import data from uploads. (Absorbed the former section 7, "Legacy
Import", whose number is now vacated.)

## 5. Notifications

Users receive email notifications for project events.

## 6. Billing

Users can manage their subscription and invoices.

## 8. Audit Log

Administrators can review a log of account actions.

## 9. API Tokens

Users can issue and revoke personal API tokens.
