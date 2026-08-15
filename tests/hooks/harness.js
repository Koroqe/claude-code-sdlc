'use strict';

/**
 * Test harness for the hook wrapper.
 *
 * Hooks are exercised the way Claude Code runs them — as child processes fed
 * JSON on stdin — never by requiring them in-process. That is deliberate: the
 * fail-open contract is about process exit codes, and a `require` would not
 * test it. It also keeps the zone rule intact (tests/ must not couple
 * hooks/lib/ to scripts/ci/lib/).
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WRAPPER = path.join(REPO_ROOT, 'hooks', 'lib', 'run-hook.js');

/**
 * Run a hook. `input` is the stdin object; `env` overrides process env.
 * Returns { code, stdout, stderr, json } where json is the parsed envelope or
 * null when stdout was not valid JSON.
 */
function runHook(hookId, input, env, opts) {
  const options = opts || {};
  const result = spawnSync(
    process.execPath,
    [WRAPPER, '--hook', hookId],
    {
      input: JSON.stringify(input || {}),
      encoding: 'utf8',
      timeout: options.killAfterMs || 30000,
      env: Object.assign({}, process.env, { CLAUDE_PLUGIN_ROOT: REPO_ROOT }, env || {}),
      cwd: options.cwd || REPO_ROOT,
    }
  );

  let json = null;
  try {
    const line = String(result.stdout || '').trim();
    if (line) json = JSON.parse(line);
  } catch (err) {
    json = null;
  }

  return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '', json };
}

/** Create a throwaway directory that is cleaned up by the caller. */
function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'sdlc-hook-test-'));
}

function rimraf(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

/** Minimal assertion recorder — no dependencies, readable failure output. */
class Checks {
  constructor(name) {
    this.name = name;
    this.passed = 0;
    this.failures = [];
  }

  ok(label, condition, detail) {
    if (condition) {
      this.passed += 1;
    } else {
      this.failures.push(label + (detail ? ' — ' + detail : ''));
    }
  }

  equal(label, actual, expected) {
    this.ok(label, actual === expected, 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }

  contains(label, haystack, needle) {
    const text = String(haystack === null || haystack === undefined ? '' : haystack);
    this.ok(label, text.indexOf(needle) !== -1, 'expected to contain ' + JSON.stringify(needle) + ', got ' + JSON.stringify(text.slice(0, 300)));
  }

  finish() {
    if (this.failures.length) {
      process.stderr.write('FAIL ' + this.name + ' — ' + this.failures.length + ' problem(s):\n');
      for (const f of this.failures) process.stderr.write('  ' + f + '\n');
      process.exit(1);
    }
    process.stdout.write('PASS ' + this.name + ' — ' + this.passed + ' check(s)\n');
    process.exit(0);
  }
}

module.exports = { runHook, tempDir, rimraf, Checks, REPO_ROOT, WRAPPER };
