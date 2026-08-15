#!/usr/bin/env node
'use strict';

/**
 * pre:bash:git-guard (PRD Section 8, FR-2).
 *
 * The allow cases matter as much as the block cases here. A guard that refuses
 * legitimate work stalls an unattended run, which is worse than the rule it
 * enforces — so every check is tested in both directions.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('pre:bash:git-guard');
const HANDLERS = path.join(REPO_ROOT, 'hooks', 'handlers');
const scratch = tempDir('sdlc-gitguard-');

/** A real git repo on a named branch, so the branch check has something true to read. */
function repoOn(branch) {
  const dir = path.join(scratch, 'repo-' + branch.replace(/\W/g, '_') + '-' + Math.random().toString(36).slice(2, 7));
  fs.mkdirSync(dir, { recursive: true });
  const opts = { cwd: dir, stdio: 'ignore' };
  spawnSync('git', ['init', '-q'], opts);
  spawnSync('git', ['config', 'user.email', 'test@example.com'], opts);
  spawnSync('git', ['config', 'user.name', 'Test'], opts);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'x\n');
  spawnSync('git', ['add', 'a.txt'], opts);
  spawnSync('git', ['commit', '-m', 'init', '--no-verify'], opts);
  spawnSync('git', ['branch', '-M', branch], opts);
  return dir;
}

function bash(command, cwd, env) {
  return runHook(
    'pre:bash:git-guard',
    { session_id: 'g1', cwd, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } },
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, env || {})
  );
}
function denied(r) {
  return !!(r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecision === 'deny');
}
function reason(r) {
  return (r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecisionReason) || '';
}

const mainRepo = repoOn('main');
const featRepo = repoOn('feat/thing');

// --- branch protection ----------------------------------------------------
let r = bash('git commit -m "feat(core): x"', mainRepo);
c.ok('commit on main is refused', denied(r));
c.contains('reason names the branch', reason(r), 'main');
c.contains('reason gives the remedy', reason(r), 'git checkout -b');
c.contains('reason carries a deviation token', reason(r), '[deviation: rule-1');

r = bash('git commit -m "feat(core): x"', featRepo);
c.ok('the same commit on a feature branch is allowed', !denied(r), reason(r));

// --- conventional commit shape: every valid combination must pass ---------
const TYPES = ['feat', 'fix', 'test', 'chore'];
const SCOPES = ['api', 'ui', 'db', 'auth', 'core', 'infra'];
let allowedCount = 0;
for (const t of TYPES) {
  for (const s of SCOPES) {
    const res = bash('git commit -m "' + t + '(' + s + '): a real summary"', featRepo);
    if (!denied(res)) allowedCount += 1;
  }
}
c.equal('all 24 valid type/scope combinations are allowed', allowedCount, 24);

r = bash('git commit -m "docs(core): update readme"', featRepo);
c.ok('an out-of-set type is refused', denied(r));
c.contains('reason lists the allowed types', reason(r), 'feat|fix|test|chore');

r = bash('git commit -m "feat(frontend): x"', featRepo);
c.ok('an out-of-set scope is refused', denied(r));

r = bash('git commit -m "just some words"', featRepo);
c.ok('an unparseable message is refused', denied(r));

// --- AI attribution -------------------------------------------------------
r = bash('git commit -m "feat(core): x" -m "Co-Authored-By: Someone <a@b.c>"', featRepo);
c.ok('Co-Authored-By in a later -m is caught', denied(r));
c.contains('reason explains why', reason(r), 'attribution');

r = bash('git commit -m "feat(core): x" -m "Generated with Claude"', featRepo);
c.ok('a generated-with line is caught', denied(r));

// The narrow-matching cases: these are legitimate and must NOT be refused.
r = bash('git commit -m "fix(core): rename ClaudeConfig to AgentConfig"', featRepo);
c.ok('a message merely containing Claude is allowed', !denied(r), reason(r));
r = bash('git commit -m "feat(api): improve AI summary endpoint"', featRepo);
c.ok('a message merely containing AI is allowed', !denied(r), reason(r));

// --- --no-verify ----------------------------------------------------------
r = bash('git commit --no-verify -m "feat(core): x"', featRepo);
c.ok('--no-verify is refused', denied(r));
r = bash('git log -n 5', featRepo);
c.ok('git log -n is not mistaken for --no-verify', !denied(r), reason(r));

// --- bulk add -------------------------------------------------------------
r = bash('git add -A', featRepo);
c.ok('git add -A is refused', denied(r));
r = bash('git add .', featRepo);
c.ok('git add . is refused', denied(r));
r = bash('git add src/one.js src/two.js', featRepo);
c.ok('naming files is allowed', !denied(r), reason(r));

// --- push -----------------------------------------------------------------
r = bash('git push origin main', featRepo);
c.ok('an unrequested push is refused', denied(r));
c.contains('push reason costs a retry', reason(r), 'rule-3');

// --- quote awareness: separators inside a message must not split ----------
r = bash('git commit -m "feat(core): support a || b in the parser"', featRepo);
c.ok('a pipe inside the message does not split the command', !denied(r), reason(r));
r = bash('git commit -m "fix(core): handle a && b"', featRepo);
c.ok('an ampersand inside the message does not split', !denied(r), reason(r));
r = bash('git commit -m "docs: how to git push safely"', mainRepo);
c.ok('the word push inside a message does not trigger the push check',
  reason(r).indexOf('unrequested `git push`') === -1, reason(r));

// --- separators the naive split would miss --------------------------------
r = bash('true & git push origin main', featRepo);
c.ok('a single & still separates segments', denied(r));
r = bash('echo hi\ngit add -A', featRepo);
c.ok('a newline still separates segments', denied(r));

// --- prefix normalisation -------------------------------------------------
for (const spelling of ['command git add -A', 'env git add -A', '/usr/bin/git add -A', '\\git add -A']) {
  const res = bash(spelling, featRepo);
  c.ok('refuses via spelling: ' + spelling, denied(res));
}

// --- non-git commands are untouched ---------------------------------------
for (const cmd of ['npm test', 'ls -la', 'echo "git commit -m nonsense"']) {
  const res = bash(cmd, featRepo);
  c.ok('leaves alone: ' + cmd, !denied(res), reason(res));
}

// --- escape sentinel ------------------------------------------------------
r = bash('git push origin main', featRepo, { SDLC_ALLOW_GIT_GUARD: '1' });
c.ok('the env escape allows the push', !denied(r));
c.contains('but the bypass is announced', r.json && r.json.systemMessage, 'bypassed');

r = bash('SDLC_ALLOW_GIT_GUARD=1 git push origin main', featRepo);
c.ok('the inline escape allows the push', !denied(r), reason(r));
c.contains('the inline bypass is announced', r.json && r.json.systemMessage, 'bypassed');

// A quoted mention of the sentinel is not an escape.
r = bash('git commit -m "docs(core): mention SDLC_ALLOW_GIT_GUARD=1 in the readme"', mainRepo);
c.ok('a quoted sentinel does not grant the escape', denied(r), reason(r));

// --- REGRESSION: a quoted env-var prefix must not hide the command --------
// `GIT_SSH_COMMAND="ssh -i key" git commit` is an ordinary, non-adversarial
// shape. Marking the whole token quoted because its VALUE was quoted meant the
// assignment was never stripped, git was never found, and every check was
// bypassed silently — worse than the documented escape, which at least leaves
// a note.
for (const prefix of [
  'GIT_SSH_COMMAND="ssh -i /tmp/key"',
  'GIT_AUTHOR_DATE="2020-01-01"',
  "GIT_EDITOR='vim -n'",
]) {
  const res = bash(prefix + ' git commit -m "feat(core): x"', mainRepo);
  c.ok('quoted env prefix still sees the commit: ' + prefix, denied(res), reason(res));
}
// And a genuinely quoted string that merely looks like an assignment must NOT
// be treated as one.
r = bash('git commit -m "chore(core): document GIT_SSH_COMMAND=x usage"', featRepo);
c.ok('a quoted assignment-looking string is just text', !denied(r), reason(r));

// --- REGRESSION: git accepts unambiguous long-option abbreviations --------
for (const spelling of ['--no-verify', '--no-verif', '--no-veri', '--no-ver', '--no-v']) {
  const res = bash('git commit ' + spelling + ' -m "feat(core): x"', featRepo);
  c.ok('hook-skipping abbreviation is caught: ' + spelling, denied(res), reason(res));
}

// --- REGRESSION: bundled -am carries an inspectable message ---------------
r = bash('git commit -am "feat(core): bundled flags"', featRepo);
c.ok('a bundled -am message is inspected, not refused as uninspectable',
  !denied(r), reason(r));
r = bash('git commit -am "nonsense message"', featRepo);
c.ok('and its shape is still checked', denied(r));

// --- REGRESSION: an innocent bundle is not mistaken for --no-verify -------
r = bash('git commit -uno -m "feat(core): x"', featRepo);
c.ok('an innocent flag bundle is not read as --no-verify', !denied(r), reason(r));

// --- REGRESSION: env/command wrappers with their own flags ---------------
for (const spelling of ['env -i git push', 'env -u FOO git push', 'command -p git push']) {
  const res = bash(spelling, featRepo);
  c.ok('wrapper flags do not hide the command: ' + spelling, denied(res), reason(res));
}

// --- REGRESSION: git global options taking a separate argument -----------
for (const spelling of ['git --git-dir .git push', 'git --work-tree . push']) {
  const res = bash(spelling, featRepo);
  c.ok('separate-arg global option does not hide the subcommand: ' + spelling, denied(res));
}

// --- REGRESSION: a line continuation must not hide a segment -------------
r = bash('git \\\n push origin main', featRepo);
c.ok('a line-continued push is still seen', denied(r), reason(r));

// --- fail-open: for a guard, a malfunction must ALLOW ---------------------
r = bash('git commit -m "feat(core): x"', '/nonexistent/path/for/sure');
c.ok('an unresolvable cwd does not deny on the branch check', !denied(r), reason(r));

// --- kill switch ----------------------------------------------------------
r = bash('git add -A', featRepo, { SDLC_DISABLED_HOOKS: 'pre:bash:git-guard' });
c.ok('the kill switch disables the guard', !denied(r));
c.ok('and the kill switch is silent', !(r.json && r.json.systemMessage));

// --- every reason is self-sufficient --------------------------------------
const denials = [
  bash('git commit -m "feat(core): x"', mainRepo),
  bash('git add -A', featRepo),
  bash('git push', featRepo),
  bash('git commit -m "nope"', featRepo),
];
for (const d of denials) {
  const text = reason(d);
  c.ok('reason carries a deviation token', /\[deviation: rule-\d+ — .+\]/.test(text), text.slice(0, 120));
  c.ok('reason references no external document', text.indexOf('error-recovery.md') === -1);
}

rimraf(scratch);
c.finish();
