# Feature request: Stripe webhook payout events

Handle the `payout.paid` Stripe webhook event and update the internal ledger.

## Intended slice breakdown (for the planner to refine, not a mandate)

1. Add a `payout.paid` handler branch in `src/webhooks/stripe.ts`.
2. Update the internal ledger record when a payout is confirmed.
3. Add tests covering both a valid and a tampered webhook payload.
