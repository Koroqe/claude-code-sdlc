# Fixture: doc-updater / digest-append  (TC-16.1)

`docs/digest-index.md` holds rows for Sections 9 and 10 and **no row for Section 11**. Gate 7's
delegation supplies the finalized PRD section, use-cases file and QA file for Section 11.

Expected: exactly **one** new row is appended for Section 11, within the 300-character summary cap.
Existing rows are left byte-identical — a doc-updater that reflows or rewrites neighbouring rows makes
every Gate 7 run produce a noisy diff, which is how genuine changes stop being noticed.
