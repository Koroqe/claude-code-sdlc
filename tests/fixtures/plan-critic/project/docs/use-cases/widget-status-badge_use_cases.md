# Use Cases — Widget Status Badge

A minimal fixture use-case document backing the `plan-critic` agent's committed test fixtures. It
exists only so those fixtures' Deliverables Checklist entries name a real file instead of a phantom
path.

## UC-1.1: View widget status via the API

**Actor:** authenticated API client

**Primary flow:**
1. Client calls `GET /api/widgets` with a valid session.
2. Server returns each widget with its `status` field.

## UC-1.2: View widget status badge on the widget list page

**Actor:** authenticated user

**Primary flow:**
1. User opens the widget list page.
2. Each widget row shows a colored badge matching its `status`.

## UC-1.3: Unauthenticated access is rejected

**Actor:** unauthenticated client

**Primary flow:**
1. Client calls `GET /api/widgets` without credentials.
2. Server returns `401`.
