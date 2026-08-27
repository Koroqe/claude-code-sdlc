---
description: Generate a project's .claude/rules/design.md design declaration — ground in the product's subject, derive a compact token system, self-check every choice against the generic default, then write the declaration the review and implementation sides both read.
argument-hint: "[focus]"
arguments: [focus]
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion
---

# Command: Design Foundation

Generate `.claude/rules/design.md` — the project's design declaration. The harness ships the frame; this skill derives the project's own taste from its subject and writes it down, so every later UI slice extends one declared system instead of improvising a new one.

## Arguments

`$focus` (also available as `$ARGUMENTS`) optionally names a surface, route, or area to prioritize during grounding. When absent, ground the whole product.

## Invocation Context (determine FIRST)

Two paths reach this skill, and they differ in exactly one behavior:

- **Standalone / interactive** — the developer invoked `/design-foundation` directly. `AskUserQuestion` is available for grounding gaps.
- **Unattended — triggered from `/bootstrap-feature`** — the pipeline reached this skill mid-run with nobody watching. **Never call `AskUserQuestion` here, and never stall waiting for an answer.** Degrade to best-effort inference from the repository, and for anything that cannot be inferred write an explicitly labeled placeholder into the generated file — e.g. `TODO(design-foundation): confirm the primary audience`. An unattended run always completes.

If the invocation path cannot be positively determined, treat the run as unattended — ambiguity resolves to the path that cannot stall.

## Process

### 1. Subject Grounding

Read the repository before asking anyone anything:

- the package/app manifest and README — what the product is and claims to do
- routes, page/screen files, navigation — the key surfaces
- user-facing copy — who the audience is and what register the product speaks in

From these, state: the concrete product, its audience, and, for each key surface, the single job that surface does. The subject's own world — its materials, instruments, vernacular — is where distinctive design choices come from; a generic template is where they go to die.

Ask via `AskUserQuestion` ONLY what cannot be inferred from the repository, and ONLY on the standalone path (see Invocation Context). Never ask a question the repository already answers.

### 2. Token Derivation

Derive a compact system, every token named and justified by the grounding:

- **Colors:** 4-6 named colors. A dominant color plus one sharp accent beats a timid, evenly-spread palette.
- **Typography:** at least 2 font roles (e.g. heading/body, or sans/mono), each with a real fallback stack ending in a generic family — never a bare single font name.
- **Motion:** duration and easing tokens — a small named scale, not ad hoc per-animation values.
- **Spacing:** one spacing basis (a base unit or scale) that layouts multiply.
- **Signature:** one signature element — the single recognizable move that belongs to this product and no other.

**Existing tokens are the source of truth.** When the project already declares tokens — a `globals.css`, a Tailwind theme/config, a design-tokens file — document THOSE as the system and extend only where a genuine gap exists; inventing a parallel system beside them is a defect, not a contribution. Where existing UI is generic, record that as a finding in the report; do not touch application code — the only file this skill writes is `.claude/rules/design.md`.

### 3. Self-Check Pass

For every derived choice, ask: **would this choice fit any similar product equally well?** If yes, it is a default, not a decision — revise it until it could only belong to this subject, and state in the report what this pass changed and why. This is a judgment test, not a ban-list: no specific color or font is forbidden; interchangeability is the defect.

### 4. Write the Declaration

Write `.claude/rules/design.md` respecting the template's section shape (mirrored from the harness's `templates/rules/design.md`): Design System Source of Truth, Component Library, Typography, Motion Tokens, Aesthetic Direction, the optional project-authored Ban-List, Preview, and the optional AI Interface Patterns section (pattern vocabulary only, never code). Fill what grounding and derivation produced; leave what only the project can supply — the `## Preview` launch command above all — as a labeled `TODO` scaffold rather than a guess.

**Re-run on an existing `design.md`:** read the existing file first, then write the complete revised file — carrying forward every retained section — and report the delta: what was added, what changed, what was kept. Never silently overwrite an existing declaration.

Close with a short report: the grounding (product, audience, surface jobs), the derived tokens with one-line justifications, what the self-check changed, and any findings (generic existing UI, gaps left as `TODO`).

## Rules

- Every example in the generated file is generic or invented — never name a real product, brand, or company as a reference.
- Everything derives from the repository and, on the interactive path, the developer's answers; fetch nothing from any external service.
- The single write target is `.claude/rules/design.md`. Application code, docs, and configs are read, never modified.
