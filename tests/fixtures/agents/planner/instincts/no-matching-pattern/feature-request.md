# Feature request: notification email templates

Add a new transactional-email template for the "your export is ready" notification.

## Intended slice breakdown (for the planner to refine, not a mandate)

1. Add the new template to `src/notifications/templates.ts`.
2. Wire the export-completion event to send the new template via
   `src/notifications/email.ts`.
3. Add tests covering the template's rendered output and the send-wiring.
