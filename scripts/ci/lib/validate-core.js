'use strict';

/**
 * Shared helpers for the harness asset validators.
 *
 * Constraints (PRD Section 6, NFR-1):
 *   - Node only, ZERO npm dependencies.
 *   - This module and the validators that use it run in CI only. `install.sh`
 *     must never invoke `node` or `jq`.
 *
 * The anti-vacuity rule (FR-5.9) lives here: a validator that matches zero
 * files MUST fail. A validator that validates nothing is not a passing
 * validator, it is a broken one.
 */

const fs = require('fs');
const path = require('path');

const MIN_NODE_MAJOR = 18;

/**
 * Fail loudly and by name when the runtime is too old or unidentifiable.
 * UC-14: the failure must say what is wrong, not produce a syntax error.
 */
function assertNodeVersion() {
  const raw = process.versions && process.versions.node;
  const major = Number(String(raw).split('.')[0]);
  if (!Number.isFinite(major) || major < MIN_NODE_MAJOR) {
    process.stderr.write(
      `FATAL: this validator requires Node >= ${MIN_NODE_MAJOR}, found ${raw || 'unknown'}.\n` +
      `Install a supported Node version and re-run.\n`
    );
    process.exit(1);
  }
}

/** Repo root, derived from this file's location (scripts/ci/lib/ -> ../../..). */
function repoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

/**
 * Parse argv for `--root <dir>`. This is what makes fixture runs and
 * anti-vacuity runs possible: point a validator at a seeded bad tree, or at
 * an empty directory, without touching the real assets.
 */
function parseArgs(argv) {
  const args = { root: repoRoot(), min: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') {
      const value = argv[i + 1];
      if (!value) {
        process.stderr.write('FATAL: --root requires a directory argument.\n');
        process.exit(1);
      }
      args.root = path.resolve(value);
      i += 1;
    } else if (argv[i] === '--min') {
      // Lowers the anti-vacuity floor so a small seeded fixture can be checked
      // for the defect it actually encodes, instead of tripping the count
      // check first. Never used against the real tree — CI passes it only on
      // fixture runs.
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value < 0) {
        process.stderr.write('FATAL: --min requires a non-negative integer argument.\n');
        process.exit(1);
      }
      args.min = value;
      i += 1;
    }
  }
  return args;
}

/** List files directly under `dir` matching `test(name)`. Missing dir -> []. */
function listFiles(dir, test) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return entries
    .filter((e) => e.isFile() && test(e.name))
    .map((e) => path.join(dir, e.name))
    .sort();
}

/** List `<dir>/<sub>/<fileName>` for every immediate subdirectory. Missing dir -> []. */
function listNestedFiles(dir, fileName) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => path.join(dir, e.name, fileName))
    .filter((p) => fs.existsSync(p))
    .sort();
}

/**
 * Minimal YAML frontmatter reader — enough for the flat `key: value` blocks
 * the harness actually uses, and deliberately no more. Returns raw string
 * values; interpreting them is each validator's job.
 */
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') {
    return { ok: false, error: 'file does not open with a `---` frontmatter fence' };
  }
  const closing = lines.indexOf('---', 1);
  if (closing === -1) {
    return { ok: false, error: 'frontmatter fence is never closed' };
  }

  const data = {};
  for (let i = 1; i < closing; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) {
      return { ok: false, error: `unparseable frontmatter line ${i + 1}: ${JSON.stringify(line)}` };
    }
    data[match[1]] = match[2].trim();
  }
  return { ok: true, data };
}

/**
 * Split a frontmatter value that may be a JSON array (`["Read", "Grep"]`),
 * a bracketed bare list (`[feature]`), or a comma-separated list
 * (`Read, Grep`). Returns [] for an empty value.
 */
function parseList(value) {
  if (value === undefined || value === null) return [];
  const trimmed = String(value).trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch (err) {
      // Not JSON — fall through to bare bracketed list handling.
    }
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((v) => v.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  return trimmed
    .split(',')
    .map((v) => v.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/** Collects findings and enforces the anti-vacuity minimum. */
class Validator {
  constructor(name) {
    this.name = name;
    this.errors = [];
    this.checkedCount = 0;
  }

  error(file, message) {
    this.errors.push({ file, message });
  }

  /**
   * FR-5.9 — a validator MUST fail when it matched fewer files than expected,
   * including zero. Without this, pointing a validator at the wrong directory
   * (or running it before the assets exist) looks identical to success.
   */
  requireMinimum(actual, minimum, description) {
    this.checkedCount = actual;
    if (actual < minimum) {
      this.errors.push({
        file: '(scope)',
        message:
          `expected at least ${minimum} ${description}, found ${actual}. ` +
          'A validator that matches too few files is failing, not passing ' +
          '(check --root, or whether the assets have moved).',
      });
      return false;
    }
    return true;
  }

  finish() {
    if (this.errors.length > 0) {
      process.stderr.write(`FAIL ${this.name} — ${this.errors.length} problem(s):\n`);
      for (const e of this.errors) {
        process.stderr.write(`  ${e.file}: ${e.message}\n`);
      }
      process.exit(1);
    }
    process.stdout.write(`PASS ${this.name} — ${this.checkedCount} file(s) checked\n`);
    process.exit(0);
  }
}

/**
 * Wrap a validator body so an unexpected throw reports as a named failure
 * rather than a raw stack trace (QA 18.8.2).
 */
function run(name, body) {
  assertNodeVersion();
  const validator = new Validator(name);
  try {
    body(validator, parseArgs(process.argv.slice(2)));
  } catch (err) {
    process.stderr.write(`FAIL ${name} — unexpected error: ${err && err.message ? err.message : err}\n`);
    process.exit(1);
  }
  validator.finish();
}

module.exports = {
  MIN_NODE_MAJOR,
  assertNodeVersion,
  repoRoot,
  parseArgs,
  listFiles,
  listNestedFiles,
  parseFrontmatter,
  parseList,
  Validator,
  run,
};
