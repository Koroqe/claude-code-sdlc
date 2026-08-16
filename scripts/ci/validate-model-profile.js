#!/usr/bin/env node
'use strict';

/**
 * Validates that `agents/*.md`'s `model:` values actually match the model
 * profile the tree claims to be running (PRD Section 10, FR-10).
 *
 * This closes the gap Section 3 recorded: three installed agent copies were
 * once hand-edited to a different model than the repo shipped, and the repo
 * had no idea. A mis-tiered agent produces no runtime signal — an agent
 * silently running at `haiku` looks identical to one at `opus` until output
 * quality quietly degrades.
 *
 * Checks (FR-10.2, FR-10.3, FR-9.3):
 *   - resolves the active profile from `.sdlc-model-profile` at `--root`
 *     (absent -> `quality`, the shipped baseline; unrecognized -> its own
 *     named malformed-receipt failure, never silently defaulted);
 *   - every `agents/*.md` file's `model:` value against
 *     `scripts/ci/lib/model-profiles.js`'s `<profile>:<role>` entry,
 *     reporting file / found / expected on mismatch;
 *   - iff `<root>/install.sh` exists, text-parses (never executes) its
 *     `model_for_role()` case arms and byte-compares them against the same
 *     JS table, so a hand-edit to either copy diverging from the other
 *     fails by name (FR-10.3). This comparison is bidirectional: it is not
 *     enough for every *parsed* arm to match the JS table — a deleted arm
 *     produces no parse result at all, so a completeness pass separately
 *     asserts the extracted `<profile>:<role>` set equals the full expected
 *     matrix (every non-`inherit` profile x every known role, since
 *     `inherit` rows are covered by the single `inherit:*)` wildcard). And
 *     any line inside the `case` body that is neither scaffolding, the
 *     wildcard, nor a line matching `CASE_ARM_RE`'s strict shape fails by
 *     name too, so an arm rewritten into an executable-but-nonmatching form
 *     (e.g. `budget:planner) echo 'fable' ;;` — quotes fall outside
 *     `CASE_ARM_RE`'s charset) cannot silently drop out of the comparison.
 *
 * `--assert-baseline` (FR-9, the never-commit-the-receipt guard): when
 * passed, ANY `.sdlc-model-profile` present at `--root` fails by name — the
 * receipt is a local, install-time artifact, never something CI should see
 * checked in. Without this flag, a contributor who runs `--profile budget`
 * locally and commits both the rewritten `agents/` tree and the matching
 * receipt produces a tree this validator would otherwise happily approve —
 * CI blessing the exact drift class this feature exists to catch. The
 * real-tree CI step passes this flag; fixture runs decide per fixture.
 *
 * `--assert-baseline` is parsed directly off `process.argv` here, not added
 * to `scripts/ci/lib/validate-core.js`'s shared `parseArgs` — that module is
 * shared by every validator in `scripts/ci/`, and this flag is meaningful to
 * this one alone.
 */

const fs = require('fs');
const path = require('path');
const core = require('./lib/validate-core.js');
const profiles = require('./lib/model-profiles.js');

const MIN_AGENTS = 13;
const AGENTS_SUBDIR = 'agents';
const RECEIPT_FILE = '.sdlc-model-profile';

// One `<profile>:<role>) echo <model> ;;` case arm, exactly the shape
// `install.sh`'s `model_for_role()` uses (FR-10.3) — a contract, not a
// style choice, per that function's own header comment.
const CASE_ARM_RE = /^\s*([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)\)\s*echo\s+([a-z][a-z0-9.-]*)\s*;;\s*$/;
// The single `inherit:*) echo inherit ;;` wildcard standing in for all 14
// `inherit` rows.
const WILDCARD_RE = /^\s*inherit:\*\)\s*echo\s+inherit\s*;;\s*$/;
// A line that LOOKS like it is trying to be a case arm (opens with
// `<profile>:<role>)`) but does not match CASE_ARM_RE's strict shape — used
// only to name the intended pair in an "unparseable line" finding. Matching
// this is never sufficient on its own; CASE_ARM_RE is still what decides
// whether a line is accepted.
const ARM_PREFIX_RE = /^\s*([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)\)/;

// Every other line `model_for_role()`'s body is allowed to contain: the
// function signature, its local-var declaration, the `case`/`esac` bracketing,
// the `*) return 1 ;;` catch-all, blank lines, and comments. Anything inside
// the body that is none of these AND does not match CASE_ARM_RE or
// WILDCARD_RE is unparseable — see checkInstallTable's `unmatched` handling.
const SCAFFOLDING_LINE_RES = [
  /model_for_role\(\)\s*\{\s*$/,
  /^\s*\}\s*$/,
  /^\s*local\s+profile="\$1"\s+role="\$2"\s*$/,
  /^\s*case\s+"\$\{profile\}:\$\{role\}"\s+in\s*$/,
  /^\s*esac\s*$/,
  /^\s*\*\)\s*return\s+1\s*;;\s*$/,
  /^\s*$/,
  /^\s*#/,
];

function isScaffoldingLine(line) {
  return SCAFFOLDING_LINE_RES.some((re) => re.test(line));
}

// FR-10.3's full expected matrix: every non-`inherit` profile x every role
// `scripts/ci/lib/model-profiles.js` knows about. `inherit` rows are excluded
// on purpose — they are covered by the single `inherit:*)` wildcard arm, not
// by 14 individual `inherit:<role>)` arms.
function expectedTripleKeys() {
  const keys = new Set();
  for (const profile of profiles.PROFILES) {
    if (profile === 'inherit') continue;
    for (const role of profiles.ROLES) {
      keys.add(`${profile}:${role}`);
    }
  }
  return keys;
}

function readReceipt(root) {
  let raw;
  try {
    raw = fs.readFileSync(path.join(root, RECEIPT_FILE), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { present: false, value: null };
    throw err;
  }
  return { present: true, value: raw.trim() };
}

/**
 * Scope the text parse to the `model_for_role() { ... }` function body only
 * — never the whole file — so an unrelated line elsewhere in `install.sh`
 * (or a descriptive comment quoting the shape, e.g. this file's own header)
 * can never be mistaken for a real case arm.
 */
function extractModelForRoleBody(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => /model_for_role\(\)\s*\{/.test(line));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^}\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end + 1);
}

/**
 * Parses the `model_for_role()` body into `(profile, role, model)` triples,
 * wildcard presence, and — the FR-10.3 completeness fix — every line that is
 * neither a recognized case arm, the wildcard, nor known scaffolding. That
 * third bucket (`unmatched`) is what catches a case arm rewritten into an
 * executable-but-nonmatching form (e.g. quoted output): such a line does not
 * produce a triple, so a check that only iterates `triples` would silently
 * skip it exactly like a deleted arm would be skipped.
 */
function parseInstallTable(bodyLines) {
  const triples = [];
  let wildcardSeen = false;
  const unmatched = [];
  for (const line of bodyLines) {
    if (WILDCARD_RE.test(line)) {
      wildcardSeen = true;
      continue;
    }
    const match = CASE_ARM_RE.exec(line);
    if (match) {
      triples.push({ profile: match[1], role: match[2], model: match[3] });
      continue;
    }
    if (isScaffoldingLine(line)) continue;
    unmatched.push(line);
  }
  return { triples, wildcardSeen, unmatched };
}

/**
 * FR-10.3: text-parse (never execute) `<root>/install.sh`'s case arms and
 * assert they byte-compare against `scripts/ci/lib/model-profiles.js`. Runs
 * only when `<root>/install.sh` exists, so per-file-drift fixtures can omit
 * it and fail for exactly their own encoded reason.
 */
function checkInstallTable(v, root) {
  const installPath = path.join(root, 'install.sh');
  if (!fs.existsSync(installPath)) return;
  const rel = path.relative(root, installPath) || 'install.sh';

  const text = fs.readFileSync(installPath, 'utf8');
  const body = extractModelForRoleBody(text);
  if (!body) {
    v.error(rel, 'no `model_for_role() {` function found — expected FR-10.3\'s shell case-arm table');
    return;
  }

  const { triples, wildcardSeen, unmatched } = parseInstallTable(body);
  if (triples.length === 0 && !wildcardSeen) {
    v.error(rel, 'model_for_role() body was found but no `<profile>:<role>) echo <model> ;;` case arms were extracted from it');
    return;
  }

  // Direction 1 (pre-existing): every arm that WAS parsed must echo the
  // right model.
  const actualKeys = new Set();
  for (const { profile, role, model } of triples) {
    actualKeys.add(`${profile}:${role}`);
    const expected = profiles.modelFor(profile, role);
    if (expected === undefined) {
      v.error(rel, `${profile}:${role} is not a role scripts/ci/lib/model-profiles.js knows about`);
      continue;
    }
    if (model !== expected) {
      v.error(
        rel,
        `${profile}:${role} echoes '${model}', expected '${expected}' — install.sh's model_for_role() table disagrees with scripts/ci/lib/model-profiles.js (FR-10.3)`
      );
    }
  }

  // Direction 2 (the fix): every pair the JS table expects must actually
  // have been parsed. An arm that was deleted outright — or rewritten into a
  // shape CASE_ARM_RE cannot match — produces no entry in `actualKeys`, so
  // this is what stops it from being silently skipped rather than failed.
  for (const key of expectedTripleKeys()) {
    if (!actualKeys.has(key)) {
      v.error(
        rel,
        `missing case arm for ${key} — model_for_role() has no '${key}) echo <model> ;;' line matching CASE_ARM_RE's shape, so install.sh silently disagrees with scripts/ci/lib/model-profiles.js for this pair (FR-10.3)`
      );
    }
  }
  if (!wildcardSeen) {
    v.error(
      rel,
      "model_for_role() body has no 'inherit:*) echo inherit ;;' wildcard arm — all 14 inherit:<role> rows are effectively missing (FR-10.3)"
    );
  }

  // Direction 3 (the fix): any line inside the case body that is executable
  // but does not match CASE_ARM_RE, the wildcard, or known scaffolding is
  // itself a failure — e.g. `budget:planner) echo 'fable' ;;`, where the
  // quotes around the model fall outside CASE_ARM_RE's charset. Such a line
  // sets no model this validator can see, yet install.sh would still run it.
  for (const line of unmatched) {
    const prefix = ARM_PREFIX_RE.exec(line);
    const named = prefix ? ` (intended pair appears to be '${prefix[1]}:${prefix[2]}')` : '';
    v.error(
      rel,
      `unparseable line inside model_for_role(): ${JSON.stringify(line.trim())}${named} — matches neither a '<profile>:<role>) echo <model> ;;' case arm nor the 'inherit:*' wildcard nor known scaffolding. bash would still execute this arm; it is this validator's per-arm check that would otherwise miss it silently (FR-10.3)`
    );
  }
}

/** FR-10.2: every `agents/*.md` file's `model:` against `<profile>:<role>`. */
function checkAgentModels(v, root, profile) {
  const dir = path.join(root, AGENTS_SUBDIR);
  const files = core.listFiles(dir, (name) => name.endsWith('.md'));

  for (const file of files) {
    const rel = path.relative(root, file);
    const role = path.basename(file, '.md');
    const expected = profiles.modelFor(profile, role);
    if (expected === undefined) continue; // an unknown role is validate-agents.js's schema concern, not this validator's.

    const parsed = core.parseFrontmatter(fs.readFileSync(file, 'utf8'));
    if (!parsed.ok) {
      v.error(rel, `frontmatter does not parse — ${parsed.error}`);
      continue;
    }
    const found = parsed.data.model;
    if (found !== expected) {
      v.error(rel, `model '${found}', expected '${expected}'`);
    }
  }

  return files.length;
}

core.run('validate-model-profile', (v, args) => {
  const root = args.root;
  const assertBaseline = process.argv.includes('--assert-baseline');

  const receipt = readReceipt(root);

  // FR-9: `--assert-baseline` — any receipt present at the validated root
  // fails by name, regardless of whether its value is even recognized.
  if (assertBaseline && receipt.present) {
    v.error(
      RECEIPT_FILE,
      `${RECEIPT_FILE} is present at the validated root — under --assert-baseline this must never be ` +
      'committed: it is a local, install-time artifact (FR-9.1), and a tree that commits both a ' +
      'rewritten agents/ profile and its matching receipt is a tree this validator would otherwise ' +
      'happily approve, blessing the exact drift class this feature exists to catch.'
    );
  }

  // FR-9.3 / UC-14-EC1: absent -> `quality`; unrecognized -> its own named
  // malformed-receipt failure, never silently defaulted past.
  let profile = 'quality';
  if (receipt.present) {
    if (!profiles.PROFILES.includes(receipt.value)) {
      v.error(
        RECEIPT_FILE,
        `unrecognized profile '${receipt.value}' in ${RECEIPT_FILE} — must be one of ${profiles.PROFILES.join(', ')}`
      );
      return;
    }
    profile = receipt.value;
  }

  const dir = path.join(root, AGENTS_SUBDIR);
  const fileCount = core.listFiles(dir, (name) => name.endsWith('.md')).length;
  const minimum = args.min === null ? MIN_AGENTS : args.min;
  if (!v.requireMinimum(fileCount, minimum, `agents/*.md files checked against the '${profile}' model profile`)) {
    return;
  }

  checkAgentModels(v, root, profile);
  checkInstallTable(v, root);
});
