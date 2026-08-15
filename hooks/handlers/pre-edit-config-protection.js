'use strict';

/**
 * pre:edit:config-protection — PreToolUse on Edit|Write.
 *
 * Refuses edits that make the build pass by lowering the bar rather than by
 * fixing the code: flipping `strict` off, downgrading a lint rule to `off`,
 * dropping an `extends`, or pasting `@ts-nocheck` at the top of a file that
 * will not compile.
 *
 * This is the most common way an unattended run produces a dishonest green.
 * The model is not being malicious — a failing typecheck and a config knob are
 * both just text, and turning the knob is the shorter path.
 *
 * It denies rather than warns. A warning here would be addressed to the actor
 * that just decided weakening the config was the way forward, which is not a
 * deterrent.
 *
 * Scope note that matters: the directive check covers source files only, and
 * explicitly excludes docs, markdown and test fixtures. This repository's own
 * fixtures contain the literal strings `@ts-nocheck` and `eslint-disable` —
 * without the exclusion, this guard would block the pipeline writing its own
 * tests, including the autonomy regression run that proves the feature works.
 *
 * Backstop: merge-ready Gate 2 (code review).
 */

const fs = require('fs');
const path = require('path');

const ESCAPE = 'SDLC_ALLOW_CONFIG_EDIT';

const CONFIG_FILES = [
  'tsconfig.json', 'tsconfig.base.json', 'jsconfig.json',
  '.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.yml',
  'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs',
  'biome.json', 'biome.jsonc',
  '.prettierrc', '.prettierrc.json', 'prettier.config.js',
  'jest.config.js', 'jest.config.ts', 'jest.config.json',
  'vitest.config.js', 'vitest.config.ts',
];

const STRICTNESS_KEYS = [
  'strict', 'noImplicitAny', 'strictNullChecks', 'noUnusedLocals',
  'noUnusedParameters', 'noImplicitReturns', 'strictFunctionTypes',
  'alwaysStrict', 'noFallthroughCasesInSwitch',
];

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

/** Directive checks apply to code only — never to docs or fixtures. */
function isExcludedFromDirectiveCheck(relative) {
  if (relative.startsWith('docs/') || relative.startsWith('docs\\')) return true;
  if (/\.md$/i.test(relative)) return true;
  if (relative.indexOf('tests/fixtures/') === 0 || relative.indexOf('tests\\fixtures\\') === 0) return true;
  if (relative.indexOf(path.join('tests', 'fixtures')) === 0) return true;
  return false;
}

function readIfPossible(absolute) {
  try {
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink() || !stat.isFile()) return '';
    return fs.readFileSync(absolute, 'utf8');
  } catch (err) {
    return '';
  }
}

/** Apply an Edit's replacement so the resulting content can be compared. */
function projectedContent(toolInput, existing) {
  if (typeof toolInput.content === 'string') return toolInput.content;
  if (typeof toolInput.new_string === 'string' && typeof toolInput.old_string === 'string') {
    if (toolInput.replace_all) return existing.split(toolInput.old_string).join(toolInput.new_string);
    return existing.replace(toolInput.old_string, toolInput.new_string);
  }
  return null;
}

/** Structural weakening, detected without an AST and without dependencies. */
function findWeakening(before, after) {
  for (const key of STRICTNESS_KEYS) {
    const on = new RegExp('"' + key + '"\\s*:\\s*true');
    const off = new RegExp('"' + key + '"\\s*:\\s*false');
    if (on.test(before) && off.test(after)) {
      return '`' + key + '` was turned from true to false';
    }
    if (on.test(before) && !on.test(after) && !off.test(after)) {
      return '`' + key + '` was removed';
    }
  }

  // A lint rule going quiet.
  // The value may be a bare severity or an array whose first element is one —
  // `"no-console": ["error", {...}]` is the standard form for any rule taking
  // options, and matching only the bare form missed most real downgrades.
  const ruleRe = /"([@a-zA-Z0-9/_-]+)"\s*:\s*(?:\[\s*)?("error"|"warn"|2|1)/g;
  let m;
  while ((m = ruleRe.exec(before)) !== null) {
    const rule = m[1];
    if (STRICTNESS_KEYS.indexOf(rule) !== -1) continue;
    const wasError = /"error"|2/.test(m[2]);
    if (!wasError) continue;
    const offRe = new RegExp('"' + rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"\\s*:\\s*("off"|0)');
    if (offRe.test(after)) return 'lint rule `' + rule + '` was downgraded to off';
    const stillRe = new RegExp('"' + rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"\\s*:');
    if (!stillRe.test(after)) return 'lint rule `' + rule + '` was removed';
  }

  // A shared config being dropped.
  const extendsRe = /"extends"\s*:\s*(\[[^\]]*\]|"[^"]*")/;
  const beforeExtends = extendsRe.exec(before);
  const afterExtends = extendsRe.exec(after);
  if (beforeExtends && afterExtends) {
    // Count entries, not characters. Comparing raw length reported a removal
    // whenever a path was merely renamed to something shorter.
    const count = (v) => (v.trim().startsWith('[') ? (v.match(/"/g) || []).length / 2 : 1);
    if (count(beforeExtends[1]) > count(afterExtends[1])) {
      return 'an `extends` entry was removed';
    }
  }
  if (beforeExtends && !afterExtends) return 'the `extends` block was removed';

  return '';
}

/** A blanket suppression newly introduced into a source file. */
function findDirective(before, after) {
  const checks = [
    { re: /@ts-nocheck/, label: '`@ts-nocheck`' },
    // Blanket only. A scoped `eslint-disable-next-line no-unused-vars` is a
    // normal, reviewable thing to write and must not be refused.
    { re: /\/\*\s*eslint-disable\s*\*\//, label: 'a blanket `/* eslint-disable */`' },
    { re: /\/\/\s*eslint-disable\s*$/m, label: 'a blanket `// eslint-disable`' },
  ];
  for (const check of checks) {
    if (!check.re.test(before) && check.re.test(after)) return check.label;
  }
  return '';
}

module.exports = function configProtection(input) {
  const event = (input && input.hook_event_name) || '';
  if (event !== 'PreToolUse') return null;

  const toolInput = (input && input.tool_input) || {};
  const target = toolInput.file_path;
  if (!target) return null;

  const root = path.resolve((input && input.cwd) || process.cwd());
  const absolute = path.resolve(root, String(target));
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..')) return null;

  const existing = readIfPossible(absolute);
  const after = projectedContent(toolInput, existing);
  if (after === null) return null;

  const base = path.basename(absolute);
  let problem = '';

  if (CONFIG_FILES.indexOf(base) !== -1 && existing) {
    problem = findWeakening(existing, after);
  }
  if (!problem && SOURCE_EXT.test(base) && !isExcludedFromDirectiveCheck(relative)) {
    const directive = findDirective(existing, after);
    if (directive) {
      problem = directive + ' was added, which silences checks for the whole file';
    }
  }

  if (!problem) return null;

  if (process.env[ESCAPE] === '1') {
    return { systemMessage: 'config-protection bypassed via ' + ESCAPE + ': ' + relative + ' — ' + problem };
  }

  return {
    deny: {
      reason:
        'Refusing this edit to ' + relative + ': ' + problem + '. Making a check ' +
        'stop complaining is not the same as making the code correct, and an ' +
        'unattended run has no one to notice the difference. Fix what the check ' +
        'is reporting instead. If relaxing the configuration really is the ' +
        'intended change for this slice, set ' + ESCAPE + '=1. ' +
        '[deviation: rule-3 — set ' + ESCAPE + '=1 if the relaxation is intended, costs 1 retry]',
    },
  };
};
