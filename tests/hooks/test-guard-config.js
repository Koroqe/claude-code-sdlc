#!/usr/bin/env node
'use strict';

/** pre:edit:config-protection (PRD Section 8, FR-5). */

const fs = require('fs');
const path = require('path');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('pre:edit:config-protection');
const HANDLERS = path.join(REPO_ROOT, 'hooks', 'handlers');
const scratch = tempDir('sdlc-config-');

function project(name, files) {
  const root = path.join(scratch, name);
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return root;
}
function write(root, rel, content, env) {
  return runHook('pre:edit:config-protection',
    { session_id: 's1', cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Write',
      tool_input: { file_path: path.join(root, rel), content } },
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, env || {}));
}
function edit(root, rel, oldStr, newStr, env) {
  return runHook('pre:edit:config-protection',
    { session_id: 's1', cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Edit',
      tool_input: { file_path: path.join(root, rel), old_string: oldStr, new_string: newStr } },
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, env || {}));
}
function denied(r) {
  return !!(r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecision === 'deny');
}
function reason(r) {
  return (r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecisionReason) || '';
}

const TSCONFIG = JSON.stringify({ compilerOptions: { strict: true, noImplicitAny: true } }, null, 2);
const ESLINT = JSON.stringify({ extends: ['a', 'b'], rules: { 'no-unused-vars': 'error', 'eqeqeq': 'warn' } }, null, 2);

const root = project('p', {
  'tsconfig.json': TSCONFIG,
  '.eslintrc.json': ESLINT,
  'src/a.ts': 'export const a = 1;\n',
  'docs/guide.md': 'Use @ts-nocheck sparingly.\n',
  'docs/notes.ts': 'export const x = 1;\n',
  'tests/fixtures/sample.ts': 'export const s = 1;\n',
});

// --- weakening is refused -------------------------------------------------
let r = write(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: false, noImplicitAny: true } }, null, 2));
c.ok('turning strict off is refused', denied(r));
c.contains('reason names the key', reason(r), 'strict');
c.contains('reason explains the principle', reason(r), 'not the same as making the code correct');
c.contains('reason names the escape', reason(r), 'SDLC_ALLOW_CONFIG_EDIT');
c.contains('reason carries a rule-3 token', reason(r), '[deviation: rule-3');

r = write(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { noImplicitAny: true } }, null, 2));
c.ok('removing strict entirely is refused', denied(r));

r = write(root, '.eslintrc.json', JSON.stringify({ extends: ['a', 'b'], rules: { 'no-unused-vars': 'off', 'eqeqeq': 'warn' } }, null, 2));
c.ok('downgrading a rule to off is refused', denied(r));
c.contains('reason names the rule', reason(r), 'no-unused-vars');

r = write(root, '.eslintrc.json', JSON.stringify({ extends: ['a'], rules: { 'no-unused-vars': 'error', 'eqeqeq': 'warn' } }, null, 2));
c.ok('dropping an extends entry is refused', denied(r));

// --- strengthening and additions are allowed -----------------------------
r = write(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, noImplicitAny: true, noUnusedLocals: true } }, null, 2));
c.ok('adding a stricter option is allowed', !denied(r), reason(r));

r = write(root, '.eslintrc.json', JSON.stringify({ extends: ['a', 'b', 'c'], rules: { 'no-unused-vars': 'error', 'eqeqeq': 'error' } }, null, 2));
c.ok('raising a severity and adding an extends is allowed', !denied(r), reason(r));

r = write(root, '.eslintrc.json', JSON.stringify({ extends: ['a', 'b'], rules: { 'no-unused-vars': 'error', 'eqeqeq': 'warn', 'no-debugger': 'error' } }, null, 2));
c.ok('adding a new rule is allowed', !denied(r), reason(r));

// --- blanket suppressions in source --------------------------------------
r = write(root, 'src/a.ts', '// @ts-nocheck\nexport const a = 1;\n');
c.ok('adding @ts-nocheck to source is refused', denied(r));
c.contains('reason names the directive', reason(r), '@ts-nocheck');

r = write(root, 'src/a.ts', '/* eslint-disable */\nexport const a = 1;\n');
c.ok('a blanket eslint-disable is refused', denied(r));

// A scoped disable with a named rule is normal, reviewable work.
r = write(root, 'src/a.ts', '// eslint-disable-next-line no-unused-vars -- needed for the API shape\nexport const a = 1;\n');
c.ok('a scoped eslint-disable-next-line is allowed', !denied(r), reason(r));

// --- THE SELF-BLOCKING CASE ----------------------------------------------
// This repo's own fixtures and docs legitimately contain those literal
// strings. Without the exclusion the guard would block the pipeline writing
// its own tests — including the run that proves the feature works.
r = write(root, 'tests/fixtures/sample.ts', '// @ts-nocheck\nexport const s = 1;\n');
c.ok('fixtures may contain the directive', !denied(r), reason(r));
r = write(root, 'docs/notes.ts', '// @ts-nocheck\nexport const x = 1;\n');
c.ok('docs may contain the directive', !denied(r), reason(r));
r = write(root, 'docs/guide.md', 'Add @ts-nocheck like this: /* eslint-disable */\n');
c.ok('markdown may contain the directive', !denied(r), reason(r));

// --- Edit shape, not just Write ------------------------------------------
r = edit(root, 'tsconfig.json', '"strict": true', '"strict": false');
c.ok('an Edit that weakens is refused too', denied(r));
r = edit(root, 'src/a.ts', 'export const a = 1;', 'export const a = 2;');
c.ok('an ordinary source edit is untouched', !denied(r), reason(r));

// --- silence when nothing matches ----------------------------------------
r = write(root, 'src/a.ts', 'export const a = 42;\n');
c.ok('an unrelated edit produces no decision', !denied(r));
c.ok('and no message at all', !(r.json && r.json.systemMessage), JSON.stringify(r.json));

// --- a project with no config is not this guard's business ---------------
const bare = project('bare', { 'src/x.ts': 'export const x = 1;\n' });
r = write(bare, 'src/x.ts', 'export const x = 2;\n');
c.ok('a config-less project is untouched', !denied(r));

// --- REGRESSION: array-form rule severities are the standard ESLint shape --
// `"no-console": ["error", {...}]` is how any rule taking options is written,
// so matching only the bare-string form missed most real downgrades.
const arrayForm = project('array-form', {
  '.eslintrc.json': JSON.stringify({ rules: { 'no-console': ['error', { allow: ['warn'] }] } }, null, 2),
});
r = write(arrayForm, '.eslintrc.json', JSON.stringify({ rules: { 'no-console': 'off' } }, null, 2));
c.ok('downgrading an array-form rule is refused', denied(r), reason(r));
c.contains('reason names the rule', reason(r), 'no-console');

// --- REGRESSION: renaming an extends path is not a removal ---------------
// Comparing raw string length reported a removal whenever a path merely got
// shorter, refusing a benign refactor.
const renameExtends = project('rename-extends', {
  '.eslintrc.json': JSON.stringify({ extends: ['./config/shared/tsconfig.base.strict.json'] }, null, 2),
});
r = write(renameExtends, '.eslintrc.json', JSON.stringify({ extends: ['./base.json'] }, null, 2));
c.ok('renaming an extends entry to a shorter path is allowed', !denied(r), reason(r));
r = write(renameExtends, '.eslintrc.json', JSON.stringify({ extends: [] }, null, 2));
c.ok('but actually removing the entry is refused', denied(r));

// --- escape and kill switch ----------------------------------------------
r = write(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: false } }, null, 2), { SDLC_ALLOW_CONFIG_EDIT: '1' });
c.ok('the escape allows the weakening', !denied(r));
c.contains('and announces the bypass', r.json && r.json.systemMessage, 'bypassed');

r = write(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: false } }, null, 2), { SDLC_DISABLED_HOOKS: 'pre:edit:config-protection' });
c.ok('the kill switch disables the guard', !denied(r));
c.ok('and is silent', !(r.json && r.json.systemMessage));

rimraf(scratch);
c.finish();
