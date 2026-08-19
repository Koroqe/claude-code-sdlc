#!/usr/bin/env node
'use strict';

/**
 * Closes the gap that pinned every existing install for ten commits.
 *
 * `claude plugin update` compares the version the **marketplace advertises**
 * against the version installed. It does not look at the commit behind it. So
 * a repository that merges code without moving that number tells every
 * existing user "already at the latest version (4.0.0)" and installs nothing.
 * Measured directly on Claude Code 2.1.9: ten commits of shipped hooks,
 * agents and skills sat undelivered while the update command reported success.
 *
 * Nothing caught it, for the usual reason: `validate-version-consistency.js`
 * checked that the four version strings AGREE WITH EACH OTHER. Four files all
 * saying `4.0.0` is perfectly consistent and completely stale. Agreement is
 * not freshness.
 *
 * This validator asserts freshness instead, against the only ground truth
 * available in the repository — the release tags:
 *
 *   If a tag `v<advertised version>` exists, that version has already been
 *   published. Any later change to a file consumers actually receive means
 *   the advertised number is now stale, and installs are pinned. The version
 *   must be bumped before that code can reach anyone.
 *
 * What "consumers actually receive" means here is deliberately narrow — the
 * runtime surface, not the repository:
 *
 *   - plugin assets:   agents/  skills/  hooks/  .claude-plugin/
 *   - memory layer:    src/  templates/  (copied by install.sh)
 *   - the installer:   install.sh
 *
 * Documentation, tests and CI scripts are excluded on purpose. A README fix
 * does not need a version bump to reach anybody, and failing on one would
 * train people to bump meaninglessly, which is how a check stops meaning
 * anything.
 *
 * Bootstrap behaviour, stated plainly: with no `v*` tags at all, there is
 * nothing to compare against and the check passes with a note. It becomes
 * load-bearing only once releases are actually tagged — which is precisely
 * what `/merge-ready`'s Release step now guarantees. The two are designed as
 * a pair: the skill step creates the tag, this validator makes it impossible
 * to ship past it silently.
 *
 * Requires full history and tags. CI must check out with `fetch-depth: 0`; a
 * shallow clone is reported as a failure rather than passing vacuously, since
 * "I could not look" and "I looked and it was fine" must never be the same
 * exit code.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const core = require('./lib/validate-core.js');

/**
 * Paths whose contents reach an installed user. A change under any of these
 * after the advertised version was tagged means installs are pinned.
 */
const DELIVERED = [
  'agents/',
  'skills/',
  'hooks/',
  '.claude-plugin/',
  'src/',
  'templates/',
  'install.sh',
];

/** Informational output. The core Validator carries findings only, not notes. */
function note(message) {
  process.stdout.write('  note: ' + message + '\n');
}

function git(root, args) {
  try {
    return {
      ok: true,
      out: execFileSync('git', ['-C', root].concat(args), {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim(),
    };
  } catch (err) {
    return { ok: false, out: '', err: err && err.message ? err.message : String(err) };
  }
}

function advertisedVersion(root) {
  const file = path.join(root, '.claude-plugin', 'marketplace.json');
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return null;
  }
  const entry = Array.isArray(parsed.plugins) ? parsed.plugins[0] : null;
  return entry && typeof entry.version === 'string' ? entry.version : null;
}

function isDelivered(file) {
  return DELIVERED.some((prefix) =>
    prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix
  );
}

core.run('validate-release-readiness', (v, args) => {
  const root = args.root;

  const version = advertisedVersion(root);
  if (!version) {
    v.error(
      '.claude-plugin/marketplace.json',
      'no advertised plugin version found — this is the field `claude plugin update` ' +
      'compares against, so it cannot be missing'
    );
    v.requireMinimum(1, 1, 'marketplace manifest');
    return;
  }

  // A repository at all? Distinguish "not a repo" from "no tags", because they
  // need different answers.
  const inRepo = git(root, ['rev-parse', '--git-dir']);
  if (!inRepo.ok) {
    v.error('(scope)', 'not a git repository, so release freshness cannot be checked');
    v.requireMinimum(1, 1, 'marketplace manifest');
    return;
  }

  // A shallow clone has history but not enough of it, and would silently
  // produce an empty diff — the exact false pass this validator exists to
  // prevent.
  const shallow = git(root, ['rev-parse', '--is-shallow-repository']);
  if (shallow.ok && shallow.out === 'true') {
    v.error(
      '(scope)',
      'shallow clone: full history is required to compare against the release tag. ' +
      'Check out with `fetch-depth: 0`.'
    );
    v.requireMinimum(1, 1, 'marketplace manifest');
    return;
  }

  const tag = 'v' + version;
  const tagExists = git(root, ['rev-parse', '--verify', '--quiet', tag + '^{commit}']).ok;

  v.requireMinimum(1, 1, 'marketplace manifest');

  if (!tagExists) {
    const anyTag = git(root, ['tag', '--list', 'v*']);
    if (!anyTag.ok || anyTag.out === '') {
      note(
        'no `v*` release tags exist yet, so there is no published version to compare ' +
        'against. This check becomes load-bearing once /merge-ready cuts its first release.'
      );
      return;
    }
    // The advertised version is ahead of every published release. That is the
    // correct state mid-development: work has been bumped but not yet cut.
    note(
      `advertised version ${version} has no \`${tag}\` tag yet — unreleased, which is the ` +
      'expected state between a bump and its release.'
    );
    return;
  }

  // The advertised version IS published. Anything delivered that changed since
  // then is code no installed user can receive.
  const diff = git(root, ['diff', '--name-only', tag + '..HEAD']);
  if (!diff.ok) {
    v.error('(scope)', `could not diff against ${tag}: ${diff.err}`);
    return;
  }

  const changed = diff.out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(isDelivered);

  if (changed.length === 0) return;

  const shown = changed.slice(0, 8);
  const more = changed.length - shown.length;
  v.error(
    '.claude-plugin/marketplace.json',
    `advertises ${version}, which is already published as \`${tag}\`, but ` +
    `${changed.length} delivered file(s) changed since then:\n` +
    shown.map((f) => `      ${f}`).join('\n') +
    (more > 0 ? `\n      … and ${more} more` : '') +
    `\n    Every existing install is pinned: \`claude plugin update\` compares the ` +
    `advertised version, not the commit, and will report "already at the latest ` +
    `version (${version})" while delivering none of this. Bump the version in all four ` +
    `sources (see validate-version-consistency.js) before merging.`
  );
});
