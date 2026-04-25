# Migration Guide

Migrating between major versions of `claude-code-sdlc`. Each section
documents what changed, what you need to do, and how to roll back if
something goes wrong.

## v2.x → v3.0.0

The 3.0.0 release introduces **auto-release executing mode** for
`/merge-ready` Gate 9 plus the cross-platform binary release pipeline.
The behavioral defaults remain backward-compatible — projects without
the new opt-in sentinel see no behavior change.

### What changed

- **`release-engineer` Gate 9** is now two-mode. The default
  (suggest-only) is byte-identical to v2.x: Gate 9 emits the structured
  10-section summary with the fenced `Commands to run` block and the
  developer runs every command themselves. The new opt-in **executing
  mode** activates when `<project>/.claude/rules/auto-release.md` exists;
  in that mode Gate 9 runs whitelisted git commands itself with 4-tier
  authority (Trivial / Moderate / Sensitive / Forbidden — see
  `templates/rules/auto-release.md` for the full table).
- **`install.sh` REPO_URL** is now `github.com/codefather-labs/claude-code-sdlc.git`
  (the canonical remote). v2.x had a typo (`Koroqe`) that broke the
  one-line `curl ... | bash` install. If you bookmarked the old URL,
  update it.
- **`install.sh` VERSION** is now `3.0.0`. The bump is intentional — it
  signals the new executing-mode option even though the default is
  unchanged.
- **Cross-platform prebuilt binaries** for `sdlc-knowledge` now include
  Windows-x64 alongside darwin-arm64, darwin-x64, linux-x64, linux-arm64.
  Windows users running Git Bash, MSYS2, or Cygwin get a prebuilt binary
  (with `.exe` suffix) instead of the cargo source-build fallback.
- **SDLC core release pipeline** is new. Bare `v*.*.*` tag pushes
  produce a GitHub Release with source tarball + release-notes body,
  triggered by `.github/workflows/sdlc-core-release.yml`.
- **`.gitattributes`** is added at repo root with `export-ignore` entries
  for `.claude/`, `docs/qa/`, `docs/use-cases/`, `books/`. Source
  tarballs from both release pipelines strip these tracked-but-internal
  paths.
- **`templates/hooks/pre-push`** and **`templates/rules/auto-release.md`**
  are added. Downstream projects scaffolded via `bash install.sh
  --init-project` get both — the rule in `.claude/rules/`, the hook in
  `.git/hooks/pre-push` (only when `.git/hooks` exists and no
  pre-existing pre-push hook).
- **SDLC core itself opts in** via `.claude/rules/auto-release.md` and
  `.claude/rules/changelog.md` at repo root. v3.0.0 onward, the SDLC
  repo dogfoods its own automated changelog and release packaging.

### What you need to do

If you are an end user (developer using the SDLC pipeline on your own
projects):

1. **Re-run `bash install.sh --yes`** to update `~/.claude/agents/release-engineer.md`
   to the v3 prompt. The prompt body is byte-stable in suggest-only mode;
   the new §7 executing-mode section is a strict superset that no-ops
   when the sentinel is absent.
2. **Update bookmarks** that referenced `Koroqe/claude-code-sdlc` —
   those URLs now 404 or redirect inconsistently. The canonical remote
   is `github.com/codefather-labs/claude-code-sdlc`.
3. **(Optional)** opt in to auto-release for your project:
   ```bash
   cp ~/.claude/templates/rules/auto-release.md .claude/rules/auto-release.md
   ```
   (or copy from your local checkout's `templates/rules/auto-release.md`).
   The sentinel's mere presence activates §7. Gate 9 will create and push
   release tags during `/merge-ready` runs from that point on.
4. **(Optional)** opt in to AUTO_RELEASE=1 (no prompts):
   ```bash
   export AUTO_RELEASE=1
   ```
   in your shell rc OR set inline before `/merge-ready`. Sensitive-tier
   `git push origin <tag>` becomes auto-confirmed without user
   interaction. Forbidden tier (`npm publish`, `cargo publish`,
   `gh release create`, any `--force`) is NEVER bypassed by
   AUTO_RELEASE=1.

If you are a **maintainer** of the SDLC repo itself:

- Cut the FIRST `sdlc-knowledge-v0.2.0` tag via the new
  `bash install.sh --bootstrap-release 0.2.0` flow before merging this
  release to main. The flag runs a 7-part pre-condition gate (clean
  tree, on main, codefather-labs origin, Cargo.toml version match, no
  existing tag local/remote, gh CLI authenticated, `.claude/release-notes-0.2.0.md`
  non-empty), prompts default-deny `[y/N]`, pushes with rollback-on-failure,
  never uses `--force`.
- After the v0.2.0 binary release publishes, the next `bash install.sh`
  on a fresh machine downloads the prebuilt binary instead of building
  from source.
- For SDLC core's own `v3.0.0` tag, run `/merge-ready` on a clean main
  checkout — Gate 9 in executing mode (the SDLC core sentinel is now
  present at `.claude/rules/auto-release.md`) creates and pushes the
  tag, triggering `.github/workflows/sdlc-core-release.yml` which
  publishes the GitHub Release with source tarball + release-notes body.

### How to roll back

If executing mode causes problems:

1. **Opt out by removing the sentinel.** `rm <project>/.claude/rules/auto-release.md`.
   Gate 9 immediately reverts to suggest-only mode — byte-identical to
   v2.x behavior. No log line, no warning, silent no-op for §7. This
   is the canonical opt-out path.
2. **Pin to v2.x** by checking out the v2.1.0 tag of the SDLC repo and
   re-running `bash install.sh --yes --local` from that checkout. Note:
   v2.1.0 had the broken `Koroqe` REPO_URL — the piped `curl ... | bash`
   install does NOT work against v2.x; you must clone manually.
3. **If a Sensitive-tier prompt fired and you said `n`**: nothing
   happened. Gate 9 emits a Warnings entry in Section 9 of the
   structured summary; the developer's `Commands to run` block remains
   the canonical fallback path.
4. **If a tag push failed mid-way**: §7's atomic rollback already ran
   `git tag -d <tag>` to restore prior local state. Re-running
   `/merge-ready` produces a SKIPPED Gate 9 (because the prior run's
   CHANGELOG rewrite emptied `[Unreleased]`). To retry, restore
   `[Unreleased]` content (e.g. via `git revert` of the rewrite commit),
   investigate the push failure (auth, network, branch protection),
   then re-run `/merge-ready`.

### Compatibility matrix

| You are                     | Default behavior    | After opt-in (sentinel present) |
| --------------------------- | ------------------- | ------------------------------- |
| Existing v2.x project       | Suggest-only (no change) | Executing mode |
| New v3.0.0 project (`--init-project`) | Executing mode (sentinel copied by default) | Same — already opted in |
| Maintainer of SDLC repo     | Executing mode (`.claude/rules/auto-release.md` is committed) | Same |

To opt OUT in a freshly-scaffolded v3 project: `rm .claude/rules/auto-release.md`.

### Known issues

- **Windows binary build may fail on the cargo step** because
  `tools/sdlc-knowledge/src/pdf.rs` uses `std::os::unix::fs::PermissionsExt`
  unconditionally. The matrix entry exists but the build is expected to
  fail on Windows until iter-3.1 gates the unix-only imports behind
  `cfg(unix)`. The release workflow has `fail-fast: false` so other
  platforms succeed independently.
- **Tag-scheme disambiguation prompt is interactive** even with
  `AUTO_RELEASE=1` when both `tools/sdlc-knowledge/` AND non-tools paths
  changed in the release. Headless mode auto-aborts in this case rather
  than silently picking a scheme — this is intentional security behavior.
- **`gh` CLI** is required for `--bootstrap-release` (pre-condition #6).
  If you do not have the GitHub CLI installed and authenticated, the
  flow fails the gate before any git mutation. Install via your package
  manager (`brew install gh`, `apt install gh`, etc.) and run
  `gh auth login` once.
