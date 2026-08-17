# Feature request: user avatar upload

Let a user upload and crop a profile avatar image.

## Intended slice breakdown (for the planner to refine, not a mandate)

1. Add `POST /api/users/:id/avatar` accepting an image upload, with size/type validation.
2. Add client-side crop UI before submit.
3. Add tests covering the upload endpoint's validation and the crop UI's output payload.
