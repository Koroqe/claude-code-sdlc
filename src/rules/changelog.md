# Changelog Rules

This is the single authoritative spec for the project changelog. Every other instruction file that mentions the changelog defers to this document.

## Purpose

Every completed unit of work appends an entry to a project-root `CHANGELOG.md`. The changelog is written for **non-technical readers** so that anyone — not just engineers — can track what changed in the project over time. Keep the language plain and the structure predictable.

## Entry Fields (all four required)

Every changelog entry MUST contain these four fields:

- **Date + time** — in **UTC**, formatted `HH:MM UTC` (24-hour clock). The time MUST be retrieved for real (see the Writer Procedure below). NEVER invent, guess, or estimate it.
- **Name** — the name of the feature or fix (e.g. `Add CSV export`, `Fix login redirect loop`).
- **Summary** — a simple, non-technical one-liner that a layperson can understand.
- **Details** — a fuller description, **≤ 500 characters** (hard cap; trim if longer).

## Technical Details (optional — write at CTO level)

Some projects add a `**Technical details:**` line to each entry for engineering leadership (CTO/CDO). This field is **optional** — include it only where a project asks for it. When present, write it at a **high product/system level**, never at the file or function level. Cover only what applies:

- New or changed **user-facing screens / pages**
- New or changed **API endpoints** (purpose and access level — not implementation)
- **Services or major components** affected
- Any **architecture, infrastructure, or deployment** change (e.g. VPS, workers, new processes)
- **Impact / risk**: display-only vs. data/schema change; whether a database migration, route change, or deployment is involved

Do NOT include file paths or names, function/component/symbol names, library or validation mechanics (unless they carry product-level meaning), slice counts, or other low-level minutiae. Keep it to a few sentences.

**Avoid (too low-level):** "New `GET /api/.../pipeline` (`hasMinRole`-gated, `groupBy` aggregation, shared `foldFunnel`). New `PipelineTable` on `/admin/...`; centralized `feature-labels.ts`; 5 slices."

**Prefer (CTO level):** "Adds one role-gated admin API endpoint powering a new pipeline dashboard, with a single aggregated query so the snapshot matches the detail views. Front end: a new tabbed admin screen. Display-only — no database, schema, or deployment changes."

## File Structure

The file is grouped by UTC day, **newest first**, with the newest entry first within each day. Use exactly this shape:

```
# Changelog

All notable changes to this project, newest first. Entries are grouped by UTC date.

## 2026-06-02

### Add CSV export — 14:30 UTC
**Summary:** Users can now download their report as a spreadsheet file.
**Details:** Adds a GET /api/reports/:id/export endpoint that streams report rows as CSV. Auth-protected, validates ownership, paginates large datasets.

### Fix login redirect loop — 11:05 UTC
**Summary:** Logging in no longer gets stuck reloading the page.
**Details:** ...
```

Structure rules:

- A fixed header block at the top: the `# Changelog` title followed by the one-line description.
- Day heading: `## YYYY-MM-DD` — a zero-padded ISO date (e.g. `2026-06-02`). The newest **day** appears at the top, immediately under the header block; older days follow below.
- Within a day, the newest **entry** appears first.
- Entry heading: `### <name> — <HH:MM> UTC`, followed by a `**Summary:**` line and a `**Details:**` line.

## Writer Procedure

When a trigger that owns the changelog (see Trigger Ownership) finalizes a completed unit of work, write the entry as follows:

1. **Get the real timestamp.** Run `date -u +'%Y-%m-%d %H:%M'` via Bash to obtain today's UTC date and the current UTC time. **NEVER invent, guess, or estimate the date/time.** If `date` is unavailable or fails, do NOT write a hallucinated timestamp — skip writing the entry and report that the timestamp could not be retrieved.
2. **Ensure the file exists.** If `CHANGELOG.md` is absent at the project root, create it with the `# Changelog` header block shown above before inserting any entry.
3. **Apply the idempotency guard FIRST** (see below). Before inserting anything, check whether an entry with the same name already exists under today's date. If it does, UPDATE that entry in place and STOP — do not proceed to insertion. Only continue to step 4 if no matching entry exists for today.
4. **Enforce the Details cap.** Trim the Details field to **≤ 500 characters**. If longer, hard-truncate at 500 characters (counted as characters, not bytes).
5. **Place the new entry by day.** If a `## <today's date>` heading already exists, insert the new `### ...` entry as the FIRST entry directly under that day heading. Otherwise, insert a new `## <today's date>` block immediately after the header block (so today sits above all older days).

## Idempotency Guard

Before writing, check whether an entry with the same feature/fix **name** already exists under today's `## YYYY-MM-DD` heading. The comparison is **case-insensitive and trimmed** of surrounding whitespace.

- If a matching entry exists for today, **UPDATE that entry in place** (refresh Summary, Details, and time) rather than appending a duplicate.
- If no matching entry exists for today, insert a new entry per the Writer Procedure.

This guard makes double-writes impossible even if the trigger-ownership heuristics misfire.

## Trigger Ownership — write exactly once per completed unit

Each completed unit of work must produce **exactly one** changelog entry. Ownership of the write is assigned as follows. *(The commands named below are plugin skills, resolvable in full as `/claude-code-sdlc:<name>`; the bare form used throughout this document works automatically unless another installed plugin defines a same-named skill.)*

- **`/merge-ready`** writes one entry as its finalization step, after all quality gates PASS. This covers any feature or fix taken through the quality gates.
- **A standalone `/implement-slice`** — invoked directly by the user, NOT driven by `/develop-feature`, and NOT running as a parallel-wave subagent — writes one entry for standalone fixes.
- **`/develop-feature`** passes a **`no-changelog`** suppression flag to every `/implement-slice` it drives. This applies to BOTH the single-slice-wave direct path AND parallel-wave subagents, so a driven slice NEVER writes the changelog — `/merge-ready` owns the write for the whole feature.
- **Parallel-wave subagents MUST NOT write to `CHANGELOG.md`** under any circumstances.

### Why ownership is not keyed on "wave context" alone

It is tempting to suppress the slice write whenever a slice runs "inside a wave." That is insufficient: `/develop-feature` runs single-slice waves **directly, with no wave context**, so a wave-context check alone would let those slices write and collide with the `/merge-ready` write. Instead, ownership relies on two explicit mechanisms working together:

1. The explicit **`no-changelog`** flag that `/develop-feature` passes down every path it drives, and
2. The **idempotency guard**, which collapses any accidental second write into an in-place update.

Together these guarantee exactly one entry per completed unit regardless of how the slice was invoked.
