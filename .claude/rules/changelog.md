# Changelog Rules

## Audience

The product `CHANGELOG.md` file maintained by the `changelog-writer` agent is written for **product owners and end users, NOT developers**. Entries MUST describe user-visible behavior and product impact in plain language. Internal implementation details, refactors, and engineering concerns do not belong here.

## Format

The changelog follows the [Keep a Changelog](https://keepachangelog.com/) convention. All entries MUST be grouped under one of these six categories verbatim:

- `Added` — for new features.
- `Changed` — for changes in existing functionality.
- `Deprecated` — for soon-to-be-removed features.
- `Removed` — for features that have been removed.
- `Fixed` — for bug fixes.
- `Security` — for vulnerabilities and security-relevant changes.

## `[Unreleased]` convention

An `[Unreleased]` heading MUST always exist at the top of the changelog, above any versioned sections. New entries are appended under `[Unreleased]` as work lands. When a release is cut, the contents of `[Unreleased]` are promoted to a new versioned section, and a fresh empty `[Unreleased]` heading is left in place.

## Inclusion rule

A changelog entry is created ONLY from PRD sections whose `Changelog:` field contains a user-facing description. The value of `Changelog:` becomes the entry text verbatim. PRD sections whose `Changelog:` field is set to `skip — internal` are never recorded in the changelog.

## Exclusion rule

The following categories of work are internal and MUST NEVER appear in the user-facing changelog:

- Refactors and code reorganization.
- Test infrastructure changes (new test harnesses, fixture updates, CI test config).
- Type cleanup and type-only changes.
- Logging changes that are not user-visible.
- Metrics and instrumentation.
- CI, build pipeline, and tooling changes.

## Sentinel

**The presence of this file at `.claude/rules/changelog.md` is the sole signal the `changelog-writer` agent uses to decide whether to run. Absence equals opt-out.** Downstream projects that do not want an automated product changelog simply omit this file from their `.claude/rules/` directory; the SDLC harness itself ships without it and therefore never triggers the agent on its own commits.

## No lazy skip

`skip — internal` MUST NOT be used as a default value for user-facing features. It is reserved for genuinely internal work as defined by the Exclusion rule above. Marking a user-facing PRD section as `skip — internal` to avoid authoring a changelog entry is a policy violation and MUST be caught in review.
