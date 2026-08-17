# Feature request: marketing-newsletter-signup

Add a newsletter signup form to the marketing site footer.

## Intended slice breakdown (for the planner to refine, not a mandate)

1. Add `POST /api/newsletter/subscribe` in `src/routes/newsletter.ts`, calling the mailing-list
   provider via `src/services/mailingList.ts`.
2. Add the signup form component to the footer and wire it to the new endpoint.
3. Add tests covering the subscribe endpoint and the mailing-list service call.
