# Fixture: design-foundation / grounded-existing-tokens

A small but fully groundable subject repository for exercising the
`design-foundation` skill: **Stallledger**, a farmers'-market inventory tracker
for small vendors. It has a real product description (`PRODUCT.md`), two route
components with product-flavored copy, and — the point of this fixture — an
**existing design-token system** in `src/styles/globals.css` (five CSS custom
properties for color).

## What a correct run produces

A correct `design-foundation` run against this fixture must **discover**
`src/styles/globals.css` and produce a declaration that names
`src/styles/globals.css` as the source of truth for color tokens — extending or
referencing those custom properties rather than inventing a parallel palette or
a second token file. A run that fabricates new color primitives while this file
exists has failed the grounding requirement this fixture exists to observe.

## Invariant — keep this fixture greenfield

Never commit a `.claude/rules/design.md` into this fixture. The fixture's value
is that it is a *greenfield* subject with no prior design declaration; a
committed declaration destroys that precondition and every test built on it. If
a run under test writes one here, it must be discarded, never committed.
