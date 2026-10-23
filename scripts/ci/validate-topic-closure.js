#!/usr/bin/env node
'use strict';

/**
 * Guards the shipped topic-closure rule (`src/rules/topic-closure.md`), which
 * the installer places in every adopter's ~/.claude/rules/ and which loads in
 * every session.
 *
 * Checks:
 *   FR-5.1  the rule file exists and is non-empty (an empty rule is exactly one
 *           problem, then the validator stops); size cap 4950 B (DD-1b); every
 *           REQUIRED literal present (FR-2.9 ones scoped to the FR-2.9 paragraph).
 *   FR-5.2  manifests/owned-files.txt lists `rules/topic-closure.md` under
 *           `owns` — not `legacy`, which would REMOVE it on install.
 *   FR-5.4  the four pointer files (src/claude.md, skills/merge-ready,
 *           skills/develop-feature, src/rules/error-recovery.md; with the rule
 *           and the manifest, six sources in all) carry their
 *           pointer / Rule 4 wording, restate no substance, and the two skills
 *           list AskUserQuestion in `allowed-tools`. FR-2.8 for the Rule 4 text.
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
const POINTER = 'rules/topic-closure.md';

const CLAUDE_MD = 'src/claude.md';
const MERGE_READY = 'skills/merge-ready/SKILL.md';
const DEVELOP_FEATURE = 'skills/develop-feature/SKILL.md';
const ERROR_RECOVERY = 'src/rules/error-recovery.md';
const POINTER_FILES = [CLAUDE_MD, MERGE_READY, DEVELOP_FEATURE, ERROR_RECOVERY];

const RULE4_LITERALS = [
  'record it first, then ask with AskUserQuestion',
  'in an interactive session',
  'record only',
];
const SUBSTANCE = ['lsof', 'rm -rf', 'branch -D'];

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
  { fr: "FR-2.7", literal: "rebuilt from git, never copied from the record" },
  { fr: "FR-2.11", literal: "--body-file" },
  { fr: "FR-2.11", literal: "never inline in a command" },
  { fr: "FR-3.3", literal: "only build output, dependencies or the" },
  { fr: "FR-2.10", literal: "no `+` refspec" },
  { fr: "FR-3.4", literal: ".claude/tmp/" },
  { fr: "FR-2.11", literal: "--title \"$(cat <file>)\"" },
  { fr: "FR-3.4", literal: "untracked, not a symlink" },
];

const MAX_BYTES = 4950;

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

/** Lines after the first line matching `startRe`, up to (excluding) the next line matching `endRe`, or EOF. */
function section(text, startRe, endRe) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => startRe.test(l));
  if (start === -1) return [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (endRe.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end);
}

/** The `**Action:**` paragraph under `### Rule 4` (to the next blank line). */
function rule4Action(text) {
  const body = section(text, /^### Rule 4\b/, /^### /);
  const i = body.findIndex((l) => l.indexOf('**Action:**') === 0);
  if (i === -1) return '';
  let j = i;
  while (j < body.length && body[j].trim() !== '') j++;
  return body.slice(i, j).join('\n');
}

function allowedTools(text) {
  const m = /^allowed-tools:(.*)$/m.exec(text);
  return m ? m[1] : '';
}

core.run('validate-topic-closure', (v, args) => {
  const root = args.root;
  const rule = tryRead(root, RULE);
  const manifest = tryRead(root, MANIFEST);

  const pointers = {};
  for (const rel of POINTER_FILES) pointers[rel] = tryRead(root, rel);

  const sources = [RULE, MANIFEST].concat(POINTER_FILES);
  const contents = [rule, manifest].concat(POINTER_FILES.map((r) => pointers[r]));
  const present = contents.filter((c) => c !== null).length;
  const missing = sources.filter((rel, i) => contents[i] === null);
  const desc = 'topic-closure source files (' + sources.join(', ') + ')' +
    (missing.length ? ' — ' + missing.map((m) => 'missing: ' + m).join(', ') : '');
  const minimum = args.min === null ? 6 : args.min;
  if (!v.requireMinimum(present, minimum, desc)) return;

  if (rule !== null && rule.trim() === '') {
    v.error(RULE, 'FR-5.1: ' + RULE + ' is empty');
    return;
  }

  if (manifest !== null && ownsEntries(manifest).indexOf(POINTER) === -1) {
    v.error(MANIFEST, 'FR-5.2: ' + POINTER + ' is not listed under `owns` — the installer would never deliver it');
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

  // FR-5.4: the four pointers.
  const cm = pointers[CLAUDE_MD];
  if (cm !== null) {
    const bullets = section(cm, /^### Run to Completion\b/, /^### /)
      .filter((l) => /^\s*[-*]\s/.test(l) && l.indexOf(POINTER) !== -1);
    if (bullets.length !== 1) {
      v.error(CLAUDE_MD, 'FR-5.4: expected exactly one bullet containing ' + POINTER +
        ' inside `### Run to Completion`, found ' + bullets.length);
    }
  }
  const mr = pointers[MERGE_READY];
  if (mr !== null) {
    const hit = section(mr, /^## Finalization: Release\b/, /^## /).some((l) => l.indexOf(POINTER) !== -1);
    if (!hit) v.error(MERGE_READY, 'FR-5.4: no line containing ' + POINTER + ' inside `## Finalization: Release`');
  }
  const df = pointers[DEVELOP_FEATURE];
  if (df !== null) {
    const line = df.split(/\r?\n/).find((l) => l.indexOf('Output final MERGE READY / NOT MERGE READY verdict') !== -1);
    if (line === undefined || line.indexOf(POINTER) === -1) {
      v.error(DEVELOP_FEATURE, 'FR-5.4: the `Output final MERGE READY / NOT MERGE READY verdict` line does not contain ' + POINTER);
    }
  }
  const er = pointers[ERROR_RECOVERY];
  if (er !== null) {
    const action = rule4Action(er);
    for (const lit of RULE4_LITERALS) {
      if (action.indexOf(lit) === -1) {
        v.error(ERROR_RECOVERY, 'FR-2.8: Rule 4 **Action:** paragraph missing: "' + lit + '"');
      }
    }
  }
  for (const rel of POINTER_FILES) {
    const t = pointers[rel];
    if (t === null) continue;
    for (const l of t.split(/\r?\n/)) {
      if (l.indexOf('topic-closure.md') === -1) continue;
      for (const bad of SUBSTANCE) {
        if (l.indexOf(bad) !== -1) {
          v.error(rel, 'FR-5.4: a pointer line restates substance ("' + bad + '"); point at the rule, do not copy it');
        }
      }
    }
  }
  for (const rel of [MERGE_READY, DEVELOP_FEATURE]) {
    const t = pointers[rel];
    if (t !== null && allowedTools(t).indexOf('AskUserQuestion') === -1) {
      v.error(rel, 'FR-5.4: frontmatter `allowed-tools` does not include AskUserQuestion');
    }
  }

  process.stdout.write('validate-topic-closure: checked ' + present + ' file(s), ' +
    FORBIDDEN.length + ' forbidden literals, ' + REQUIRED.length + ' required literals\n');
});
