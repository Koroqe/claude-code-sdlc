Delegate to `security-auditor`.

**Scope carve-out:** this feature ships no `docs/qa/*` file, deliberately. Do NOT report its absence as a finding — the tier that produced this change does not generate QA documents.

Audit this change:

```diff
--- a/src/lib/format.ts
+++ b/src/lib/format.ts
@@ -12,7 +12,7 @@ export function formatExpiry(minutes: number): string {
-  return `${minutes} minutes`;
+  return minutes >= 60 ? `${minutes / 60} hour(s)` : `${minutes} minutes`;
 }
```
