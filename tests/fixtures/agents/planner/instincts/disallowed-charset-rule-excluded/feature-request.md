# Feature request: admin permissions management screen

Add a screen for admins to view and edit other users' roles.

## Intended slice breakdown (for the planner to refine, not a mandate)

1. Add `GET /api/admin/users/:id/permissions` and `PUT /api/admin/users/:id/permissions` in
   `src/admin/permissions.ts`.
2. Add the admin permissions screen UI.
3. Add tests covering the endpoints' access control and the screen's role-editing flow.
