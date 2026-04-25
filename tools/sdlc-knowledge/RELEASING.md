# Releasing `sdlc-knowledge`

This document describes how to cut a release of the `sdlc-knowledge` CLI binary.
It is owned by the maintainers of `claude-code-sdlc` and is **independent** of
the SDLC repo's own release process.

> **Important — Gate 9 invariance:** the SDLC repo's `release-engineer` Gate 9
> (in `/merge-ready`) is **UNCHANGED** by this pipeline. **Gate 9 is UNCHANGED**
> in iter-1 per FR-12.4 and PRD §11.7 item 5. The `sdlc-knowledge` binary
> follows its own tag scheme, its own GitHub Actions workflow, and its own
> versioning cadence. Do not couple them.

---

## 1. Tag scheme

Tags use the form:

```
sdlc-knowledge-v<MAJOR>.<MINOR>.<PATCH>
```

For example: `sdlc-knowledge-v0.1.0`, `sdlc-knowledge-v0.2.0`,
`sdlc-knowledge-v1.0.0`.

This is **independent** from the SDLC release tags (which the SDLC repo
publishes for its install-script / agent-set releases). The two tag namespaces
do not overlap and are not synchronized.

The release workflow is triggered automatically when any tag matching
`sdlc-knowledge-v*` is pushed to the repository (see
`.github/workflows/sdlc-knowledge-release.yml`).

---

## 2. Maintainer-only one-time bootstrap

Before the SDLC release that introduces the local-knowledge-base feature
merges to `main`, a maintainer **must** cut the very first
`sdlc-knowledge-v0.1.0` tag manually. This is required so that subsequent
users of `install.sh` (which downloads the prebuilt binary) find a published
release to download — per FR-11.3 / AC-13.

This step is performed exactly **once** in the lifetime of the project. After
the first tag is published, every subsequent release is just step 3 below.

### One-time bootstrap procedure

From a clean checkout of `main` at the commit that introduces this feature:

1. Verify `tools/sdlc-knowledge/Cargo.toml` declares `version = "0.1.0"`.
2. Verify the workflow file exists at `.github/workflows/sdlc-knowledge-release.yml`.
3. Cut and push the first tag:
   ```bash
   git tag sdlc-knowledge-v0.1.0
   git push origin sdlc-knowledge-v0.1.0
   ```
4. Open the **Actions** tab on GitHub and watch the
   `sdlc-knowledge release` workflow complete. You should see:
   - the `actionlint` job pass,
   - 4 parallel `build (<platform>)` jobs pass,
   - the `release` job create the GitHub Release.
5. Open the **Releases** page and verify all 4 artifacts are attached:
   - `sdlc-knowledge-darwin-arm64`
   - `sdlc-knowledge-darwin-x64`
   - `sdlc-knowledge-linux-x64`
   - `sdlc-knowledge-linux-arm64`
6. (Optional but recommended) On a host matching one of the four platforms,
   download the corresponding artifact, mark it executable, and run
   `./sdlc-knowledge --version` to confirm it starts.

Only after these steps complete is it safe to merge the SDLC release that
references the binary from `install.sh`.

---

## 3. Version-bump rules (semver)

`sdlc-knowledge` follows [Semantic Versioning](https://semver.org/).

| Change                                              | Bump  |
| --------------------------------------------------- | ----- |
| Backward-incompatible CLI / on-disk format change   | MAJOR |
| Additive feature (new subcommand, new flag, etc.)   | MINOR |
| Bug fix or internal refactor with no surface change | PATCH |

Concretely, when releasing:

1. Update `version` in `tools/sdlc-knowledge/Cargo.toml`.
2. Run `cargo build --release -p sdlc-knowledge --manifest-path tools/sdlc-knowledge/Cargo.toml`
   locally to regenerate `Cargo.lock` and verify the build is clean.
3. Commit the version bump with a `chore(core): bump sdlc-knowledge to vX.Y.Z`
   commit (or equivalent under the project's conventional-commit scopes).
4. Cut and push the tag:
   ```bash
   git tag sdlc-knowledge-vX.Y.Z
   git push origin sdlc-knowledge-vX.Y.Z
   ```
5. The release workflow will run automatically.

---

## 4. Artifact verification

Each release attaches one binary per supported platform. Verification covers:

### Size budget (≤ 10 MB) — NFR-1.1

The release workflow asserts `size <= 10485760` (10 MiB) as a hard gate per
NFR-1.1. A build that exceeds the budget fails the workflow and no release is
cut. If you hit the limit:

- inspect what crates expanded (e.g., `cargo bloat --release` locally),
- confirm `Cargo.toml`'s release profile still has `strip = true`, `lto = true`,
  `codegen-units = 1`,
- consider feature-gating heavy dependencies.

### Smoke test (`--version`)

Each matrix job runs the freshly-built binary with `--version` and requires
exit code 0. This catches dynamic-linker mismatches, missing transitive
runtime symbols, or accidental panics on startup that a unit test wouldn't
catch.

### sha256 sidecar — **deferred to iter-2**

Publishing per-artifact `*.sha256` sidecar files for users to verify download
integrity is on the iter-2 follow-up list (see §6 below). For iter-1, users
rely on GitHub's TLS-served release URLs and the size assertion baked into
the workflow.

---

## 5. Per-release checklist

Once the bootstrap (§2) is done, every subsequent release is:

- [ ] `Cargo.toml` `version` bumped per §3.
- [ ] `Cargo.lock` regenerated and committed.
- [ ] Tag pushed: `git push origin sdlc-knowledge-vX.Y.Z`.
- [ ] GitHub Actions `sdlc-knowledge release` workflow completes green.
- [ ] All 4 binary artifacts visible on the Releases page.
- [ ] At least one platform's binary spot-checked with `--version`.

---

## 6. Iter-2 follow-ups

These items are explicitly out of scope for iter-1 and are tracked here for
the next iteration:

- **sha256 sidecar files.** Publish `<artifact>.sha256` alongside each binary
  and document the verification command (`sha256sum -c`) in `install.sh`.
- **Sigstore / cosign signing.** Sign each artifact with sigstore's
  keyless-signing flow and publish the signature + certificate sidecars.
- **Windows builds.** Add `windows-latest` (`x86_64-pc-windows-msvc`) to the
  build matrix. iter-1 deliberately ships unix-only because the consumer
  surface (`install.sh`) is bash-only in iter-1.
- **Provenance attestations** (SLSA / GitHub-Attestations) so downstream
  consumers can verify the artifact was produced by this exact workflow run.

---

## 7. Relationship to the SDLC release pipeline

To restate plainly: this workflow has **nothing to do with** the SDLC repo's
own `release-engineer` agent or its `/merge-ready` Gate 9. **Gate 9 is
UNCHANGED** by the introduction of the local-knowledge-base feature.

- The SDLC repo's `release-engineer` runs at Gate 9 of `/merge-ready` and is
  responsible for the SDLC's own release cadence (CHANGELOG, install.sh
  versioning, agent-set tag).
- The `sdlc-knowledge` binary has its own lifecycle, its own tag scheme, its
  own GitHub Release page, and its own version number.
- A new SDLC release does **not** require a new `sdlc-knowledge` release.
- A new `sdlc-knowledge` release does **not** require a new SDLC release.

The only coupling is the one-time bootstrap (§2): the very first
`sdlc-knowledge-v0.1.0` tag must exist before the SDLC release that wires
`install.sh` to download it can merge.

---

## Facts

### Verified facts
- Workflow path `.github/workflows/sdlc-knowledge-release.yml` is the file produced in this same Slice 4 commit — source: `.claude/plan.md` lines 240-244 (Slice 4 Files declaration) and Slice 4 implementation prompt.
- Crate package name is `sdlc-knowledge`, version `0.1.0`, manifest at `tools/sdlc-knowledge/Cargo.toml` — source: `tools/sdlc-knowledge/Cargo.toml:1-6` Read this session.
- NFR-1.1 size budget is 10 MB (10485760 bytes) — source: `.claude/plan.md` line 244 (Slice 4 Changes) and line 258 (Done-when condition).
- Slices 1, 2, 3 are complete with the Rust crate fully functional (ingest, search, list, status, delete) — source: Slice 4 implementation prompt context paragraph.
- Gate 9 invariance is mandated by FR-12.4 / PRD §11.7 item 5 — source: `.claude/plan.md` line 245 (Slice 4 Changes, RELEASING.md item (e)).
- Maintainer one-time bootstrap of `sdlc-knowledge-v0.1.0` is required by FR-11.3 / AC-13 — source: `.claude/plan.md` line 245 (Slice 4 Changes, RELEASING.md item (b)).

### External contracts
- `actions/checkout@v4` — symbol: action major version `v4` — source: GitHub Actions marketplace standard usage in current ecosystem — verified: no — assumption (action exists and major-version pin is the canonical reference; risk: if v4 is removed/yanked, the lint+build jobs fail with a clear actionlint or runtime error and we bump to v5).
- `dtolnay/rust-toolchain@stable` — symbol: tag `stable` selects current stable Rust — source: dtolnay/rust-toolchain README convention — verified: no — assumption (the `@stable` tag is the action's documented entry point; risk: if the action's API changes the toolchain step fails fast in CI before any artifact is uploaded).
- `actions/upload-artifact@v4` — symbol: action major version `v4` with `name`, `path`, `if-no-files-found`, `retention-days` inputs — source: GitHub-published v4 input schema, standard usage — verified: no — assumption (inputs match v4 contract; risk: input rename causes the upload step to fail in CI on first run, fixable by aligning to actual v4 inputs).
- `actions/download-artifact@v4` — symbol: action major version `v4` with `path` input downloading all artifacts to subdirectories — source: GitHub-published v4 behavior — verified: no — assumption (multi-artifact download lays out one subdir per artifact name; risk: layout mismatch causes the `softprops/action-gh-release` `files:` glob to miss files, fixable by adjusting glob).
- `softprops/action-gh-release@v2` — symbol: action major version `v2` with `tag_name`, `name`, `files`, `fail_on_unmatched_files` inputs — source: action README convention — verified: no — assumption (inputs match v2 contract; risk: if the action drops `fail_on_unmatched_files` the release step still runs but silently uploads fewer files; mitigated by §5 manual checklist requiring 4 artifacts on the release page).
- `rhysd/actionlint@v1` — symbol: action major version `v1` with `files` input — source: action README convention — verified: no — assumption (inputs match v1 contract; risk: misconfigured input causes lint job to fail loudly, gating the matrix as designed).
- GitHub-hosted runner labels `macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm` — symbol: runner image labels — source: `.claude/plan.md` line 244 (Slice 4 Changes prescribes these verbatim per architect decision) — verified: yes (load-bearing per architect; pinned literally as required).
- Rust target triples `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu` — symbol: rustc built-in target triples — source: standard rustc tier-1/tier-2 target triple naming, also referenced verbatim in Slice 4 implementation prompt — verified: yes (these are stable, long-published Rust target identifiers).

### Assumptions
- The `dist/<artifact-name>/<artifact-name>` layout produced by `actions/download-artifact@v4` matches the `softprops/action-gh-release@v2` `files:` glob. Risk: if the layout differs the release job fails on `fail_on_unmatched_files: true`, surfacing immediately. How to verify: first invocation via §2 bootstrap procedure — the maintainer watches the workflow and confirms 4 artifacts attach.
- The `cargo build` step is sufficient on `ubuntu-22.04-arm` without an explicit cross toolchain because the runner is natively aarch64. Risk: if the runner image is not actually aarch64-native, `aarch64-unknown-linux-gnu` requires `cross` or a toolchain image and the build fails fast. How to verify: bootstrap run reveals the truth on first push of `sdlc-knowledge-v0.1.0`.
- `stat -f%z` (BSD) vs `stat -c%s` (GNU) covers all 4 runners. Risk: if a future runner image changes its stat flavor the assertion errors out clearly with `stat: illegal option`, not silently. How to verify: bootstrap run.

### Open questions
- (none) — all decisions for Slice 4 are documented; sha256, sigstore, Windows are explicitly tracked under §6 iter-2 follow-ups and are out of scope.
