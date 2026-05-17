# Command: Release

Cut a release from the project's `CHANGELOG.md` `[Unreleased]` section. This
command is **user-invoked, on-demand** — the SDLC pipeline does NOT run it
automatically. Use it when you have decided that the current state of `main`
(or a feature branch) is ready to be packaged as a published release.

## Action

Delegate to the `release-engineer` agent with no arguments beyond the
project CWD. The agent runs its full 7-step packaging procedure:

1. **Self-check** — read `CHANGELOG.md` `[Unreleased]`. If empty across all
   six Keep a Changelog categories (Added / Changed / Deprecated / Removed /
   Fixed / Security), return `no-op: no unreleased changes` and STOP.
2. **Version source detection** — resolve the project's current version per
   the FR-3.1 priority chain: `package.json` → `pyproject.toml` →
   `Cargo.toml` → `VERSION` → latest `v*.*.*` git tag → fallback `0.1.0`.
   Honors the optional `Version source:` override in `./CLAUDE.md` or
   `.claude/CLAUDE.md`.
3. **Semver bump** — compute the next version from `[Unreleased]` content
   per FR-4.1: `Removed` non-empty OR non-negated `breaking` keyword →
   major; `Added` non-empty → minor; otherwise → patch. Pre-1.0 override
   demotes major to minor (FR-4.2).
4. **CHANGELOG rewrite** — rename `## [Unreleased]` to
   `## [X.Y.Z] - YYYY-MM-DD`, insert a fresh empty `[Unreleased]` heading
   above. All prior versioned sections preserved byte-for-byte.
5. **Release-notes file** — write the renamed section's BODY (no heading)
   to `.claude/release-notes-X.Y.Z.md`.
6. **CI/CD provisioning** — multi-pattern (P1 tag trigger + P2 body_path +
   P3 inline extraction) detection of an existing release workflow under
   `.github/workflows/`. When ABSENT, generate `.github/workflows/release.yml`
   with the canonical `softprops/action-gh-release@v2` template.
7. **Structured 10-section summary** — emit a labeled markdown block with
   detected version source, current version, bump type, new version,
   path to renamed CHANGELOG section, path to release-notes file, CI/CD
   status, fenced `Commands to run` block (the exact `git add` /
   `git commit` / `git push` / `git tag -a` / `git push origin v<X.Y.Z>`
   commands the developer runs themselves), warnings, and bump
   computation explanation.

## Modes

**Suggest-only (default).** The agent emits the structured summary and
the developer runs every command in the `Commands to run` block themselves.
This is the safe default for projects without explicit opt-in.

**Executing mode (opt-in).** When `<project>/.claude/rules/auto-release.md`
exists, after Steps 1–7 produce the structured summary the agent enters
its §7 4-tier authority dispatch:

- **Trivial** (auto-execute) — `git add`, `git commit -m`,
  `git merge-base`, `git diff --name-only`, `git ls-remote`
- **Moderate** (auto-execute, audited) — `git tag -a v<X.Y.Z> -F <file>`
  for SDLC core OR `git tag -a sdlc-knowledge-v<X.Y.Z> -F <file>` for the
  embedded sdlc-knowledge tool. Tag-scheme disambiguation runs on the
  files changed since the merge base.
- **Sensitive** (default-deny prompt; auto-confirm with `AUTO_RELEASE=1`)
  — `git push origin v<X.Y.Z>`. Prompt is exactly
  `Push tag <tag> to origin? [y/N] `.
- **Forbidden** (refuse always, regardless of `AUTO_RELEASE=1`) —
  `npm publish`, `cargo publish`, `pypi upload`, `gh release create`,
  any `--force` / `--force-with-lease` flag.

See `~/.claude/agents/release-engineer.md` §7 for the full anchored-regex
whitelist, metacharacter pre-rejection, headless contract, audit trail,
rollback semantics, and idempotency.

## When to invoke

- After `/merge-ready` reports MERGE READY and the relevant changes have
  landed on the canonical release branch (typically `main`).
- After `git pull` brings in fresh `[Unreleased]` entries from upstream
  that you want to package.
- When you want to inspect what the next release would look like —
  `release-engineer` is idempotent on no-op `[Unreleased]`, so you can
  safely run it as a dry-look.

## When NOT to invoke

- During active development of a feature (the `[Unreleased]` section will
  still be populated by the next merge — there's nothing to cut yet).
- On a feature branch with un-merged work — the tag would point at the
  wrong commit. Run `/release` after merge to `main`.
- When `[Unreleased]` is empty — the agent's self-check returns
  `no-op: no unreleased changes` and stops without side effects.

## Relationship to `/merge-ready`

`/merge-ready` runs the 9 quality gates (git hygiene, docs, code review,
security, build, E2E, goal-backward verification, doc accuracy, UI/UX).
It does NOT cut a release — that is `/release`'s exclusive responsibility.
The two commands are orthogonal: a feature can pass all `/merge-ready`
gates without being released, and `/release` can run without a fresh
`/merge-ready` run (e.g., for a doc-only patch release).

The pre-flight `changelog-writer` sync at the top of `/merge-ready`
maintains `[Unreleased]` content as a quality-of-life hygiene step, but
it does NOT trigger `/release` — promoting `[Unreleased]` to a versioned
section is always an explicit user decision.

## Output

`release-engineer`'s structured 10-section summary is the agent's stdout
artifact. Per the cognitive-self-check rule, the `## Facts` block goes at
the END of the release-notes file written at Step 5 — not in the
structured summary itself.

When the self-check (Step 1) returns `no-op: no unreleased changes`,
NONE of the ten sections are emitted. The output is a single line of
exactly that string.
