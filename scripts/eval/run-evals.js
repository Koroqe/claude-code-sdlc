#!/usr/bin/env node
'use strict';

/**
 * Behavioural eval runner — does the harness actually BEHAVE as specified?
 *
 * Everything else in this repo checks structure (validators) or hook logic
 * (tests/hooks). Nothing checked that the instructions the harness ships
 * actually steer a real session. This runs seeded scenarios through a real
 * headless `claude -p` in a throwaway project directory and grades the
 * transcript deterministically.
 *
 * Why not `claude plugin eval`: it exists on the CLI but is gated to early
 * access on this account (measured 2026-08-24 — it prints "`plugin eval` is
 * currently in early access"). If that gate opens, prefer it and retire this.
 *
 * COSTS MONEY. Deliberately NOT part of the default sweep: run it explicitly.
 *   node scripts/eval/run-evals.js               # all cases
 *   node scripts/eval/run-evals.js triage-       # name prefix filter
 *   node scripts/eval/run-evals.js --dry-run     # show the plan, spend nothing
 *
 * The grading logic itself is pure and unit-tested for free in
 * tests/hooks/test-eval-graders.js, so a broken grader is caught by CI.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseStream, gradeCase } = require('./graders.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CASES_DIR = path.join(REPO_ROOT, 'evals', 'cases');
const RESULTS_DIR = path.join(REPO_ROOT, 'evals', 'results');

function claudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const local = path.join(os.homedir(), '.local', 'bin', 'claude');
  if (fs.existsSync(local)) return local;
  return 'claude';
}

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rimraf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (err) { /* best effort */ }
}

/**
 * Verify the INSTALLED memory layer matches the working tree, and report which
 * one we are about to measure.
 *
 * Why not sandbox HOME and seed a private copy: measured 2026-08-24 — a
 * sandboxed HOME loses the CLI's credentials entirely ("Not logged in ·
 * Please run /login"), so every case exits in ~1s and the suite reports a
 * confident 0/4 that is purely an artifact of the harness. A green-looking
 * eval that never ran a session is worse than no eval, so this runs against
 * the real HOME and instead REFUSES to run when the installed memory layer
 * differs from src/, which is the only way the result could be misattributed.
 */
function assertMemoryLayerCurrent() {
  const installed = path.join(os.homedir(), '.claude', 'claude.md');
  const source = path.join(REPO_ROOT, 'src', 'claude.md');
  if (!fs.existsSync(installed)) {
    return { ok: false, why: 'no memory layer installed at ' + installed +
      ' — run `bash install.sh --yes` first; without it Triage never fires and every case fails for the wrong reason' };
  }
  const a = fs.readFileSync(installed, 'utf8');
  const b = fs.readFileSync(source, 'utf8');
  if (a !== b) {
    return { ok: false, why: 'installed memory layer differs from src/claude.md — you would be measuring the OLD text. Run `bash install.sh --yes` to sync, then re-run.' };
  }
  return { ok: true, why: 'installed memory layer matches src/claude.md (' + a.length + ' bytes)' };
}

function seedProject(dir, files) {
  for (const [rel, content] of Object.entries(files || {})) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
}

function listCases(filter) {
  if (!fs.existsSync(CASES_DIR)) return [];
  return fs.readdirSync(CASES_DIR)
    .filter((n) => fs.existsSync(path.join(CASES_DIR, n, 'case.json')))
    .filter((n) => !filter || n.indexOf(filter) === 0)
    .sort()
    .map((n) => Object.assign(
      { name: n },
      JSON.parse(fs.readFileSync(path.join(CASES_DIR, n, 'case.json'), 'utf8'))
    ));
}

function runCase(spec) {
  const proj = tempDir('sdlc-eval-proj-');
  try {
    seedProject(proj, spec.seed);

    const args = [
      '-p', spec.prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--max-turns', String(spec.maxTurns || 3),
    ];
    if (spec.model) args.push('--model', spec.model);

    const started = Date.now();
    const r = spawnSync(claudeBin(), args, {
      cwd: proj,
      encoding: 'utf8',
      timeout: (spec.timeoutSeconds || 240) * 1000,
      env: Object.assign({}, process.env),
    });
    const elapsed = Date.now() - started;

    const parsed = parseStream(r.stdout || '');
    // Files the run created/changed inside the sandbox project.
    const written = [];
    (function walk(d, base) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const rel = base ? base + '/' + e.name : e.name;
        if (e.isDirectory()) { if (e.name !== '.git') walk(path.join(d, e.name), rel); }
        else written.push(rel);
      }
    })(proj, '');

    // A run the harness killed (timeout, spawn failure) produced no transcript to
    // grade. Grading it anyway manufactures findings: every content grader
    // reports "absent" and the output reads exactly like a behavioural failure.
    // Measured 2026-08-26 — a 240s timeout on a maxTurns:10 case produced three
    // confident grader failures whose real cause was one line further down.
    // An errored run is INCONCLUSIVE: it cannot pass, and it must not pretend to
    // explain itself.
    const spawnError = r.error ? String(r.error.message) : null;
    if (spawnError) {
      return {
        name: spec.name, pass: false, errored: true, graders: [],
        elapsedMs: elapsed, spawnError,
        transcriptChars: (r.stdout || '').length,
        assistantText: parsed.assistantText,
        toolUses: parsed.toolUses.map((t) => ({ name: t.name, input: t.input })),
      };
    }

    const graded = gradeCase(spec, parsed, written);
    return {
      name: spec.name,
      pass: graded.pass,
      errored: false,
      graders: graded.graders,
      elapsedMs: elapsed,
      spawnError: null,
      transcriptChars: (r.stdout || '').length,
      assistantText: parsed.assistantText,
      toolUses: parsed.toolUses.map((t) => ({ name: t.name, input: t.input })),
    };
  } finally {
    rimraf(proj);
  }
}

/**
 * Run one case `runs` times and report the pass RATE, not a coin flip.
 *
 * Measured 2026-08-25: `skill-tracer-gate-refuses` failed on one run (the model
 * edited a file despite correctly refusing in prose) and passed on the very next
 * one, same inputs. A single-run suite reports that as PASS or FAIL at random,
 * which is worse than useless for deciding whether a change helped — the thing
 * this eval exists to decide. Every serious harness in the field repeats cases
 * for exactly this reason. A case is green only when EVERY run is green: a
 * gating rule that holds two times in three is not holding.
 */
function runCaseRepeated(spec) {
  const runs = Math.max(1, spec.runs || 1);
  const attempts = [];
  for (let i = 0; i < runs; i += 1) attempts.push(runCase(spec));
  const passed = attempts.filter((a) => a.pass).length;
  const errored = attempts.filter((a) => a.errored).length;
  const firstFailure = attempts.find((a) => !a.pass && !a.errored) || attempts.find((a) => !a.pass);
  return {
    name: spec.name,
    pass: passed === runs,
    runs,
    passedRuns: passed,
    erroredRuns: errored,
    elapsedMs: attempts.reduce((n, a) => n + a.elapsedMs, 0),
    graders: (firstFailure || attempts[0]).graders,
    spawnError: (firstFailure || attempts[0]).spawnError,
    transcriptChars: attempts[0].transcriptChars,
    assistantText: firstFailure ? firstFailure.assistantText : undefined,
    toolUses: firstFailure ? firstFailure.toolUses : undefined,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const filter = argv.find((a) => a[0] !== '-');
  const cases = listCases(filter);

  if (cases.length === 0) {
    process.stdout.write('no eval cases found under evals/cases/' +
      (filter ? ' matching "' + filter + '"' : '') + '\n');
    process.exit(1);
  }

  if (dryRun) {
    process.stdout.write('would run ' + cases.length + ' case(s):\n');
    for (const c of cases) {
      process.stdout.write('  ' + c.name + '  (runs=' + (c.runs || 1) +
        ', maxTurns=' + (c.maxTurns || 3) +
        ', graders=' + (c.graders || []).length + ')\n');
    }
    process.exit(0);
  }

  const mem = assertMemoryLayerCurrent();
  process.stdout.write((mem.ok ? '· ' : 'REFUSING TO RUN: ') + mem.why + '\n');
  if (!mem.ok) process.exit(1);

  const results = [];
  for (const spec of cases) {
    process.stdout.write('· ' + spec.name + ' … ');
    const res = runCaseRepeated(spec);
    results.push(res);
    process.stdout.write((res.pass ? 'PASS' : 'FAIL') + '  ' +
      res.passedRuns + '/' + res.runs + ' run(s)' +
      (res.erroredRuns ? '  [' + res.erroredRuns + ' INCONCLUSIVE — run errored, not graded]' : '') +
      '  (' + Math.round(res.elapsedMs / 1000) + 's)\n');
    if (!res.pass) {
      for (const g of res.graders.filter((x) => !x.pass)) {
        process.stdout.write('    ✗ ' + g.name + ' — ' + g.detail + '\n');
      }
      if (res.spawnError) process.stdout.write('    ✗ spawn: ' + res.spawnError + '\n');
    }
  }

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(RESULTS_DIR, stamp + '.json');
  fs.writeFileSync(outFile, JSON.stringify({
    ranAt: stamp,
    cases: results.map((r) => ({
      name: r.name, pass: r.pass, runs: r.runs, passedRuns: r.passedRuns,
      erroredRuns: r.erroredRuns,
      elapsedMs: r.elapsedMs,
      graders: r.graders, transcriptChars: r.transcriptChars,
      // On failure, keep what the model actually said and did. Twice now a
      // confident-looking FAIL has turned out to be the instrument starving the
      // run rather than the harness misbehaving, and both times the only way to
      // tell was to read the transcript. Saving it on failure makes the next
      // diagnosis a file read instead of a re-run.
      toolUses: r.pass ? undefined : r.toolUses,
      assistantText: r.pass ? undefined : r.assistantText,
    })),
  }, null, 2) + '\n');

  const passed = results.filter((r) => r.pass).length;
  process.stdout.write('\n' + passed + '/' + results.length + ' case(s) passed — ' +
    path.relative(REPO_ROOT, outFile) + '\n');
  process.exit(passed === results.length ? 0 : 1);
}

if (require.main === module) main();
module.exports = { listCases, runCase, runCaseRepeated, assertMemoryLayerCurrent };
