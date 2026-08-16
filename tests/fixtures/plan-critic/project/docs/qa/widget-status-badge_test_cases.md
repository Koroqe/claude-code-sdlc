# QA Test Cases — Widget Status Badge

A minimal fixture QA test-case document backing the `plan-critic` agent's committed test fixtures. It
exists only so those fixtures' Deliverables Checklist entries name a real file instead of a phantom
path.

| TC ID | Use Case | Test Case | Expected Result |
|-------|----------|-----------|------------------|
| TC-1 | UC-1.1 | `GET /api/widgets` (authenticated) | Response includes `status` for every widget |
| TC-2 | UC-1.1 | `status` value domain | Every `status` is one of `active`, `archived`, `pending` |
| TC-3 | UC-1.2 | Widget list page render | Each widget row shows a badge colored per its `status` |
| TC-4 | UC-1.2 | Badge label text | Badge label text matches the documented label for its `status` |
| TC-5 | UC-1.3 | `GET /api/widgets` (unauthenticated) | Response is `401` |
| TC-6 | UC-1.1 | Data layer unit test | The widget query's returned rows include a non-null `status` column |
