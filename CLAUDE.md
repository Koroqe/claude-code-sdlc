# claude-code-sdlc

The harness itself. It dogfoods its own pipeline, so everything the agents enforce applies here too.

## Commands

This repository has no `package.json`, no build step and no runtime dependencies — it ships markdown
and zero-dependency Node scripts. Its equivalent of a typecheck is the validator sweep:

```bash
for v in scripts/ci/validate-*.js; do node "$v" || exit 1; done
for t in tests/hooks/test-*.js; do node "$t" || exit 1; done
```

Those check **structure** and **hook logic**. They do not check that the instructions this harness
ships actually steer a real session — that is what the behavioural eval is for:

```bash
node scripts/eval/run-evals.js --dry-run   # free: show the plan
node scripts/eval/run-evals.js             # COSTS MONEY: real headless sessions, graded
```

It sits outside the sweep because it spends real tokens; its grading logic is unit-tested for free
inside the sweep (`tests/hooks/test-eval-graders.js`, 30 checks, 8 seeded-broken). **Read
`evals/README.md` before believing a failure** — two separate instrument bugs produced confident
false results the first two times it ran, both pointing at the product while the eval itself was
broken.

## Release

**Read this before publishing anything. The ordering below is the whole point.**

What ships to an installed user is the version advertised in `.claude-plugin/marketplace.json`.
`claude plugin update` compares that number against the installed one and **never looks at the
commit**. A merge that does not move it delivers nothing while reporting success — measured on
Claude Code 2.1.9, ten commits sat undelivered behind an unmoved `4.0.0`.

Two consequences that are easy to get backwards:

- **A git tag does not ship anything.** The marketplace tracks `main`, not tags. Tagging a stale
  version produces a repository that looks released and an install base that receives nothing.
- **Scopes update independently.** A user-scope update leaves every project-scope install on the old
  version until each one runs `--scope project`.

### Procedure

1. **Bump the version in all four sources** — they must agree:
   - `.claude-plugin/marketplace.json` → `plugins[0].version` ← *this is the one that ships*
   - `.claude-plugin/plugin.json` → `version`
   - `install.sh` → `VERSION="..."`
   - `README.md` → the version badge

2. **Verify the bump:**
   ```bash
   node scripts/ci/validate-version-consistency.js
   node scripts/ci/validate-release-readiness.js
   ```

3. **Commit and push to `main`.** This is the step that actually delivers, because the marketplace
   tracks `main`.

4. **Cut the GitHub release** — documentation and discovery, using notes derived from the
   `CHANGELOG.md` entry:
   ```bash
   gh release create v<version> --target main --title "v<version> — <headline>" --notes-file <file>
   ```

5. **Sync the outward-facing surfaces that live outside the repository:**
   ```bash
   ./scripts/release/sync-repo-metadata.sh
   ```
   GitHub's About panel, topics and homepage are not files, so no grep, validator or review can
   see them drift — the description sat at "13 AI agents" through two major versions for exactly
   that reason. The script derives them from `.claude-plugin/plugin.json` so there is no second
   copy to fall out of date. It is idempotent; run it every release.

6. **Confirm delivery rather than assuming it:**
   ```bash
   claude plugin marketplace update claude-code-sdlc
   claude plugin update claude-code-sdlc@claude-code-sdlc
   claude plugin list          # expect the new version
   ```

### Version choice

Patch for a fix, minor for new capability, major for a change to how consumers install, invoke or
configure the harness. Never reuse a published number.

## Working Rules

- **Budgets are hard caps.** ≤16 agents, ≤10 skills, ≤12 hook **ids**. Current: 15 / 7 / **12** —
  hooks are AT the ceiling with no slot left, so a thirteenth requires retiring one. Ids, not
  registrations: `pre:edit:read-guard` listens on two events and is one hook.
- **Every validator must fail on a seeded broken fixture**, pinned to an exact problem count. A check
  that only ever passes is not evidence.
- **Measure Claude Code's behaviour; do not read it off the docs.** Several documented claims have
  turned out false here. Findings from real measurement live in `docs/findings/`.
- **Hooks fail open.** A hook may block only by deciding to; a malfunctioning one exits 0.
