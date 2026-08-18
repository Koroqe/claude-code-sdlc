Delegate to `code-reviewer`.

Review this change:

```diff
--- a/src/lib/format.ts
+++ b/src/lib/format.ts
@@ -12,7 +12,7 @@ export function formatExpiry(minutes: number): string {
-  return `${minutes} minutes`;
+  return minutes >= 60 ? `${minutes / 60} hour(s)` : `${minutes} minutes`;
 }
```
