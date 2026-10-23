#!/usr/bin/env node
'use strict';

/**
 * Guards the shipped topic-closure rule (`src/rules/topic-closure.md`), which
 * the installer places in every adopter's ~/.claude/rules/ and which loads in
 * every session.
 *
 * Checks:
 *   FR-5.1  size cap 4800 B; every REQUIRED literal present (FR-2.9 ones
 *           scoped to the FR-2.9 paragraph).
 * Tracer checks:
 *   FR-5.1  the rule file exists and is non-empty (an empty rule is exactly one
 *           problem, then the validator stops).
 *   FR-5.2  manifests/owned-files.txt lists `rules/topic-closure.md` under
 *           `owns` — not `legacy`, which would REMOVE it on install.
 *   FR-5.8(b) the rule carries no maintainer-environment literal. The shipped
 *           file is generic; those literals belong to the author's own setup.
 *           One problem per occurrence. (`/Users/` is left to
 *           validate-personal-paths.js.)
 */

const fs = require('fs');
const path = require('path');
const core = require('./lib/validate-core.js');

const RULE = 'src/rules/topic-closure.md';
const MANIFEST = 'manifests/owned-files.txt';
const OWNED_ENTRY = 'rules/topic-closure.md';

const FORBIDDEN = [
  'this Mac',
  '~/Documents',
  'Projects.nosync',
  'Deliberately NOT listed',
  'delete this file',
  'output-shaping.md',
  'opos-precedence.md',
];

const REQUIRED = [
  { fr: "FR-2.1", literal: "AskUserQuestion" },
  { fr: "FR-2.2", literal: "(Recommended)" },
  { fr: "FR-2.3", literal: "at most 4 questions per call" },
  { fr: "FR-2.3", literal: "most consequential first" },
  { fr: "FR-2.3", literal: "act on the answers in the same turn" },
  { fr: "FR-2.3", literal: "then ask the remaining questions" },
  { fr: "FR-2.2", literal: "and its cost" },
  { fr: "FR-2.1", literal: "needs your attention" },
  { fr: "FR-2.6", literal: "blockers, failures and bad news are given in full, in the question or the summary, never in a trailing list" },
  { fr: "FR-2.7", literal: "## Blockers" },
  { fr: "FR-2.9", literal: "## Status: blocked" },
  { fr: "FR-2.7", literal: "orchestrator" },
  { fr: "FR-4.1", literal: "own tracker" },
  { fr: "FR-4.1", literal: ".claude/agents/company/chief-of-staff.md" },
  { fr: "FR-2.9", literal: "unavailable or refused" },
  { fr: "FR-2.9", literal: "once, plainly" },
  { fr: "FR-2.9", literal: "no trailing owed list" },
  { fr: "FR-2.10", literal: "SDLC_ALLOW_GIT_GUARD=1" },
  { fr: "FR-2.10", literal: "## Release" },
  { fr: "FR-3.2", literal: "git fetch origin <base>" },
  { fr: "FR-3.2", literal: "git merge-base --is-ancestor" },
  { fr: "FR-3.2", literal: "compare trees" },
  { fr: "FR-3.3", literal: "git status --short --ignored" },
  { fr: "FR-3.3", literal: "git log <branch> --not --remotes" },
  { fr: "FR-3.4", literal: "lsof -a -d cwd" },
  { fr: "FR-3.4", literal: "lsof unavailable" },
  { fr: "FR-3.4", literal: "durable record" },
  { fr: "FR-3.4", literal: "merged upstream" },
  { fr: "FR-3.4", literal: "launch directory" },
  { fr: "FR-3.4", literal: "the ancestors of the current shell" },
  { fr: "FR-3.4", literal: "any other process with its cwd inside still fails the check" },
  { fr: "FR-3.4", literal: "git -C <main checkout> worktree remove <path>" },
  { fr: "FR-3.4", literal: "Leave it for removal from the main checkout" },
  { fr: "FR-3.4", literal: "IN-USE-BY-CLAUDE-SESSION.txt" },
  { fr: "FR-3.4", literal: "secondary signal" },
  { fr: "FR-3.5", literal: "git worktree remove <path>" },
  { fr: "FR-3.5", literal: "never `--force`" },
  { fr: "FR-3.5", literal: "if it refuses, stop and ask" },
  { fr: "FR-3.5", literal: "2.17" },
  { fr: "FR-3.5", literal: "git worktree list --porcelain" },
  { fr: "FR-3.5", literal: "lsof +D <path>" },
  { fr: "FR-3.5", literal: "rm -rf -- \"<absolute path>\"" },
  { fr: "FR-3.5", literal: "no glob, no variable, no trailing slash, not a symlink" },
  { fr: "FR-3.5", literal: "git worktree prune --dry-run -v" },
  { fr: "FR-3.5", literal: "never retry harder" },
  { fr: "FR-3.6", literal: "git branch -d <branch>" },
  { fr: "FR-3.6", literal: "immediately before" },
  { fr: "FR-3.7", literal: "becomes a prompt" },
  { fr: "FR-3.8", literal: "main checkout" },
  { fr: "FR-3.9", literal: "one short paragraph" },
  { fr: "FR-3.9", literal: "worktree removed" },
  { fr: "FR-4.2", literal: "### Next" },
  { fr: "FR-4.2", literal: "never prompted" },
  { fr: "FR-4.2", literal: "/develop-feature`'s final report" },
  { fr: "FR-4.2", literal: "print in full" },
  { fr: "FR-3.1", literal: "Interactive only" },
  { fr: "FR-2.7", literal: "unattended" },
  { fr: "FR-3.10", literal: "verbatim from git" },
  { fr: "FR-2.7", literal: "a record is never consent" },
  { fr: "FR-3.10", literal: "backtick or newline: ask" },
  { fr: "FR-3.4", literal: "a branch name is not one" },
  { fr: "FR-3.1", literal: "replying in this session" },
  { fr: "FR-3.4", literal: "`pwd -P`" },
  { fr: "FR-3.3", literal: "and for `HEAD`" },
  { fr: "FR-4.1", literal: "may only tighten" },
  { fr: "FR-2.10", literal: "never forced" },
  { fr: "FR-3.4", literal: "present fails" },
  { fr: "FR-3.5", literal: "lists just this worktree" },
];

const MAX_BYTES = 4800;

/** FR-2.9 literals must sit inside that paragraph (the `unavailable or refused` line to the next blank line). */
const FR29_SCOPED = ['unavailable or refused', 'once, plainly', '## Status: blocked', 'no trailing owed list'];

function fr29Paragraph(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.indexOf('unavailable or refused') !== -1);
  if (start === -1) return '';
  let end = start;
  while (end < lines.length && lines[end].trim() !== '') end++;
  return lines.slice(start, end).join('\n');
}

function tryRead(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/** Entries of the manifest's `owns` section only. */
function ownsEntries(text) {
  const out = [];
  let section = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    if (line === 'owns' || line === 'legacy') { section = line; continue; }
    if (section === 'owns') out.push(line);
  }
  return out;
}

core.run('validate-topic-closure', (v, args) => {
  const root = args.root;
  const rule = tryRead(root, RULE);
  const manifest = tryRead(root, MANIFEST);

  const present = (rule !== null ? 1 : 0) + (manifest !== null ? 1 : 0);
  const missing = [RULE, MANIFEST].filter((rel, i) => (i === 0 ? rule : manifest) === null);
  const desc = 'topic-closure source files (' + RULE + ' and ' + MANIFEST + ')' +
    (missing.length ? ' — ' + missing.map((m) => 'missing: ' + m).join(', ') : '');
  const minimum = args.min === null ? 2 : args.min;
  if (!v.requireMinimum(present, minimum, desc)) return;

  if (rule !== null && rule.trim() === '') {
    v.error(RULE, 'FR-5.1: ' + RULE + ' is empty');
    return;
  }

  if (manifest !== null && ownsEntries(manifest).indexOf(OWNED_ENTRY) === -1) {
    v.error(MANIFEST, 'FR-5.2: ' + OWNED_ENTRY + ' is not listed under `owns` — the installer would never deliver it');
  }

  if (rule !== null) {
    for (const lit of FORBIDDEN) {
      let from = 0;
      for (;;) {
        const i = rule.indexOf(lit, from);
        if (i === -1) break;
        v.error(RULE, 'FR-5.8(b): forbidden literal "' + lit + '" in the shipped rule');
        from = i + lit.length;
      }
    }
  }

  if (rule !== null) {
    if (Buffer.byteLength(rule, 'utf8') > MAX_BYTES) {
      v.error(RULE, 'FR-5.1: ' + RULE + ' is ' + Buffer.byteLength(rule, 'utf8') + ' B, over the ' + MAX_BYTES + ' B cap');
    }
    const para = fr29Paragraph(rule);
    for (const r of REQUIRED) {
      const hay = FR29_SCOPED.indexOf(r.literal) !== -1 ? para : rule;
      if (hay.indexOf(r.literal) === -1) {
        v.error(RULE, r.fr + ': required literal missing' +
          (FR29_SCOPED.indexOf(r.literal) !== -1 ? ' from the FR-2.9 paragraph' : '') + ': "' + r.literal + '"');
      }
    }
  }

  process.stdout.write('validate-topic-closure: checked ' + present + ' file(s), ' +
    FORBIDDEN.length + ' forbidden literals, ' + REQUIRED.length + ' required literals\n');
});
