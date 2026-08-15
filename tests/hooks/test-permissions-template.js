#!/usr/bin/env node
'use strict';

/**
 * Permission-template tests (PRD Section 7, FR-7).
 *
 * Every project scaffolded by `install.sh --init-project` inherits this file,
 * on machines nobody reviews. One overly broad allow entry weakens all of
 * them, so the shape of this policy is asserted rather than trusted.
 */

const fs = require('fs');
const path = require('path');
const { Checks, REPO_ROOT } = require('./harness');

const c = new Checks('permissions template');
const file = path.join(REPO_ROOT, 'templates', 'settings.json');
const raw = fs.readFileSync(file, 'utf8');
const settings = JSON.parse(raw);

const allow = settings.permissions.allow;
const deny = settings.permissions.deny;

// --- structure ------------------------------------------------------------
c.ok('has permissions.allow', Array.isArray(allow));
c.ok('has permissions.deny', Array.isArray(deny) && deny.length > 0);
c.ok('has no permissions.ask — an ask entry stalls an unattended run',
  settings.permissions.ask === undefined);
c.ok('has no hooks key — plugin hooks auto-load and would double-fire',
  settings.hooks === undefined && raw.indexOf('"hooks"') === -1);
c.ok('has no defaultMode', settings.permissions.defaultMode === undefined && settings.defaultMode === undefined);
c.ok('has no additionalDirectories', settings.permissions.additionalDirectories === undefined);
c.ok('has no env block — a scaffolded template must not pre-seed env overrides',
  settings.env === undefined);

// --- the three original entries survive verbatim (FR-7.4) -----------------
for (const original of ['Bash(git commit*)', 'Edit(.claude/scratchpad.md)', 'Write(.claude/scratchpad.md)']) {
  c.ok('preserves original allow entry ' + original, allow.indexOf(original) !== -1);
}

// --- forbidden catch-alls -------------------------------------------------
const forbidden = [
  'Bash', 'Bash(*)', 'Bash(:*)', 'Bash(git:*)',
  'WebFetch', 'WebFetch(*)',
  'Read(//**)', 'Edit(//**)', 'Write(//**)',
  'Edit(~/**)', 'Write(~/**)',
];
for (const entry of forbidden) {
  c.ok('allow does not contain catch-all ' + entry, allow.indexOf(entry) === -1);
}

// --- the denies that make Edit(**) safe ----------------------------------
// Without these, an agent could rewrite its own permission policy, or drop a
// pre-commit hook and turn the allowed `git commit` into code execution.
const requiredDenies = [
  'Edit(.claude/settings.json)',
  'Write(.claude/settings.json)',
  'Edit(.git/**)',
  'Write(.git/**)',
  'Edit(~/.claude/sdlc-trusted-projects)',
  'Write(~/.claude/sdlc-trusted-projects)',
];
for (const entry of requiredDenies) {
  c.ok('deny contains ' + entry, deny.indexOf(entry) !== -1);
}
if (allow.indexOf('Edit(**)') !== -1) {
  c.ok('Edit(**) is paired with a settings-file deny', deny.indexOf('Edit(.claude/settings.json)') !== -1);
  c.ok('Edit(**) is paired with a .git deny', deny.indexOf('Edit(.git/**)') !== -1);
}

// --- each deny category is represented ------------------------------------
function anyDenyMatches(re) { return deny.some((d) => re.test(d)); }
c.ok('denies privilege escalation (sudo)', anyDenyMatches(/^Bash\(sudo/));
c.ok('denies out-of-tree recursive deletion', anyDenyMatches(/^Bash\(rm -[rf]{2} \//));
c.ok('denies home-directory deletion', anyDenyMatches(/^Bash\(rm -[rf]{2} ~/));
c.ok('denies parent-traversal deletion', anyDenyMatches(/^Bash\(rm -rf \.\./));
c.ok('denies force push', anyDenyMatches(/^Bash\(git push --force/));
c.ok('denies history rewriting', anyDenyMatches(/filter-branch/));
c.ok('denies hooksPath redirection', anyDenyMatches(/core\.hooksPath/));
c.ok('denies secrets reads', deny.indexOf('Read(.env)') !== -1);
c.ok('denies ssh key reads', anyDenyMatches(/~\/\.ssh/));
for (const transport of ['curl', 'wget', 'nc', 'scp']) {
  c.ok('denies exfiltration transport ' + transport, deny.indexOf('Bash(' + transport + ':*)') !== -1);
}
for (const shell of ['bash -c', 'sh -c', 'eval', 'node -e', 'python -c']) {
  c.ok('denies shell re-entry via ' + shell, anyDenyMatches(new RegExp('^Bash\\(' + shell.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
}

// --- in-tree work must NOT be denied --------------------------------------
// A deny that caught `rm -rf ./node_modules` would break ordinary work. The
// patterns are prefix-scoped to /, ~, $HOME and .. precisely to avoid that.
c.ok('no deny pattern targets in-tree relative deletion',
  !deny.some((d) => /^Bash\(rm -[rf]{2} \.\/[a-z]/.test(d)));

// --- documented limitations are actually documented -----------------------
const comment = JSON.stringify(settings._comment || '');
c.contains('documents that patterns are not a sandbox', comment, 'not a sandbox');
c.contains('documents the double-fire hazard', comment, 'twice');
c.contains('documents why ask is absent', comment, 'stall');

c.finish();
