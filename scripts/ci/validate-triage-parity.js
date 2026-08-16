#!/usr/bin/env node
'use strict';

/**
 * Closes a false-safety-net gap: `skills/develop-feature/SKILL.md` and
 * `src/claude.md` each carry a byte-identical claim —
 * "A CI check greps both copies for parity, so any edit to Steps 1-7 below
 * MUST be mirrored there too." — but until this file existed, no such check
 * ran anywhere in `scripts/ci/` or `.github/workflows/ci.yml`. Steps 1-7 are
 * the triage classification that routes every future unprefixed request into
 * `fast`/`quick`/`full`; a hand-edit to one copy without the other would
 * silently desynchronize that routing, which is the exact failure class this
 * feature exists to prevent.
 *
 * Extraction boundary (documented, per the requirement that it be a stable
 * marker present in both files):
 *   - START: the first line matching `^\*\*Step 1 —` (both files phrase their
 *     lead-in paragraph before Step 1 differently — "Restated here..." in
 *     `src/claude.md` vs "Defined once, authoritatively..." in
 *     `skills/develop-feature/SKILL.md` — so the block intentionally starts
 *     AT Step 1, not at either file's own section heading, which also differs
 *     in wording between the two files: "### Triage (Phase 0) —
 *     Unprefixed-Request Path" vs "### Phase 0: Triage").
 *   - END (exclusive): the first line matching `^\*\*Tier branch —` after
 *     START. The "Tier branch" bullets immediately following that marker are
 *     legitimately NOT identical between the two files (each points at its
 *     own file's downstream section — "What Every Plan MUST Include" vs
 *     "Phase 1: Bootstrap") — so they are deliberately excluded from the
 *     parity block, not merely uncompared by omission.
 *   - At HEAD, `sed`-extracting exactly this range from both files and
 *     diffing them is empty — the block is genuinely byte-identical today,
 *     which is what "no normalisation needed" below relies on.
 *
 * Checks:
 *   1. Both `skills/develop-feature/SKILL.md` and `src/claude.md` contain a
 *      START..END block (anti-vacuity: `requireMinimum` on file presence,
 *      plus a named failure if either marker is missing from a present file).
 *   2. The two extracted blocks compare byte-for-byte. No normalisation is
 *      applied — the block is prose describing binding classification rules,
 *      not something with an incidental formatting difference to tolerate.
 *   3. On divergence, the block is split into per-`**Step N —` chunks and
 *      each chunk is compared individually, so the failure names WHICH step
 *      differs and shows a context snippet at the first differing character
 *      — never merely "files differ".
 *   4. Both copies still enumerate all 9 fixed sensitive-path defaults from
 *      Step 6 (`auth`, `payment`, `billing`, `secret`, `migration`,
 *      `.github/workflows/`, `install.sh`, `.claude/settings.json`,
 *      `docs/PRD.md`) — checked independently of the parity diff, because a
 *      default silently dropped from BOTH copies in the same edit would pass
 *      a parity-only check while still being a security regression (Step
 *      2(c) routes `full` off this exact list).
 */

const fs = require('fs');
const path = require('path');
const core = require('./lib/validate-core.js');

const CORE_FILES = ['skills/develop-feature/SKILL.md', 'src/claude.md'];

// See header comment for why the block starts at Step 1 rather than either
// file's own (differently-worded) section heading, and ends before the
// "Tier branch" bullets rather than at end of file.
const BLOCK_START_RE = /^\*\*Step 1 —/;
const BLOCK_END_RE = /^\*\*Tier branch —/;
const STEP_HEADING_RE = /^\*\*Step (\d+) —/;
const EXPECTED_STEP_NUMBERS = [1, 2, 3, 4, 5, 6, 7];

// Step 6's fixed sensitive-path default list. Dropping any one of these from
// BOTH copies in the same edit would pass a parity-only diff while still
// being a security regression, since this list is what forces `full` routing
// (Step 2(c)) for auth/payment/billing/secret/migration/CI/install/settings/
// PRD paths regardless of what a project declares.
const SENSITIVE_PATH_DEFAULTS = [
  '`auth`',
  '`payment`',
  '`billing`',
  '`secret`',
  '`migration`',
  '`.github/workflows/`',
  '`install.sh`',
  '`.claude/settings.json`',
  '`docs/PRD.md`',
];

function tryRead(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Extracts the lines from the first line matching `startRe` up to (not
 * including) the next line matching `endRe`, treating fenced code blocks
 * (```...```) as opaque, mirroring `validate-verification-upgrade.js`'s
 * `section()` helper. Unlike that helper, a missing END marker returns
 * `null` rather than silently taking the rest of the file to EOF — for this
 * validator the END marker is itself part of what "the boundary is stable
 * and present in both files" means, so an unterminated block is its own
 * named failure, never a quietly over-wide comparison.
 */
function section(text, startRe, endRe) {
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (startRe.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  let end = -1;
  let inFence = false;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (endRe.test(line)) {
      end = i;
      break;
    }
  }
  if (end === -1) return null;
  return lines.slice(start, end).join('\n');
}

/** Splits a Steps-1-7 block into `{ [stepNumber]: chunkText }`. */
function splitIntoSteps(block) {
  const lines = block.split(/\r?\n/);
  const steps = {};
  let current = null;
  for (const line of lines) {
    const match = STEP_HEADING_RE.exec(line);
    if (match) {
      current = Number(match[1]);
      steps[current] = [];
    }
    if (current !== null) steps[current].push(line);
  }
  const out = {};
  for (const key of Object.keys(steps)) out[key] = steps[key].join('\n');
  return out;
}

/** Index of the first character at which two strings differ (length if one is a prefix of the other). */
function firstDiffIndex(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return len;
}

/** A short, whitespace-flattened window around `index`, for "enough context to locate it". */
function context(text, index, radius) {
  const r = radius || 50;
  const start = Math.max(0, index - r);
  const end = Math.min(text.length, index + r);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function checkSensitiveDefaults(v, rel, block) {
  for (const token of SENSITIVE_PATH_DEFAULTS) {
    if (!block.includes(token)) {
      v.error(
        rel,
        `Step 6's fixed sensitive-path default list is missing ${token} — a silently dropped default is a ` +
        'security regression, since this list forces `full` routing (Step 2(c)) regardless of what a project declares'
      );
    }
  }
}

function checkParity(v, contents) {
  const [fileA, fileB] = CORE_FILES;
  const textA = contents[fileA];
  const textB = contents[fileB];
  if (!textA || !textB) return; // requireMinimum already reported this — nothing meaningful to diff with fewer than both files present.

  const blockA = section(textA, BLOCK_START_RE, BLOCK_END_RE);
  const blockB = section(textB, BLOCK_START_RE, BLOCK_END_RE);

  if (!blockA) {
    v.error(
      fileA,
      'could not locate the Steps 1-7 parity block — no line matches the "**Step 1 —" start marker, or no ' +
      '"**Tier branch —" end marker follows it'
    );
  }
  if (!blockB) {
    v.error(
      fileB,
      'could not locate the Steps 1-7 parity block — no line matches the "**Step 1 —" start marker, or no ' +
      '"**Tier branch —" end marker follows it'
    );
  }
  if (!blockA || !blockB) return;

  checkSensitiveDefaults(v, fileA, blockA);
  checkSensitiveDefaults(v, fileB, blockB);

  if (blockA === blockB) return; // byte-identical — parity holds.

  const stepsA = splitIntoSteps(blockA);
  const stepsB = splitIntoSteps(blockB);

  const allStepNumbers = new Set(EXPECTED_STEP_NUMBERS);
  for (const n of Object.keys(stepsA)) allStepNumbers.add(Number(n));
  for (const n of Object.keys(stepsB)) allStepNumbers.add(Number(n));

  let anyStepReported = false;
  for (const n of [...allStepNumbers].sort((a, b) => a - b)) {
    const hasA = Object.prototype.hasOwnProperty.call(stepsA, n);
    const hasB = Object.prototype.hasOwnProperty.call(stepsB, n);
    if (!hasA || !hasB) {
      const presentIn = hasA ? fileA : fileB;
      const missingFrom = hasA ? fileB : fileA;
      v.error(
        '(triage parity)',
        `Step ${n} marker is present in ${presentIn} but missing from ${missingFrom} — Steps 1-7 must be mirrored identically in both copies`
      );
      anyStepReported = true;
      continue;
    }
    if (stepsA[n] !== stepsB[n]) {
      const idx = firstDiffIndex(stepsA[n], stepsB[n]);
      v.error(
        '(triage parity)',
        `Step ${n} differs between ${fileA} and ${fileB} — mirrored copies have diverged. ` +
        `${fileA}: "...${context(stepsA[n], idx)}..." vs ${fileB}: "...${context(stepsB[n], idx)}..."`
      );
      anyStepReported = true;
    }
  }

  if (!anyStepReported) {
    // The overall blocks differ (blockA !== blockB) but every individual Step
    // N chunk still matched — e.g. stray content between steps. Report by
    // name rather than let a real divergence go unreported just because it
    // fell outside a Step N chunk boundary.
    const idx = firstDiffIndex(blockA, blockB);
    v.error(
      '(triage parity)',
      `${fileA} and ${fileB} diverge outside any single Step N chunk — first divergence near: ` +
      `"${context(blockA, idx)}" vs "${context(blockB, idx)}"`
    );
  }
}

core.run('validate-triage-parity', (v, args) => {
  const root = args.root;

  const contents = {};
  let presentCount = 0;
  for (const rel of CORE_FILES) {
    const text = tryRead(root, rel);
    if (text !== null) {
      presentCount += 1;
      contents[rel] = text;
    }
  }

  const minimum = args.min === null ? CORE_FILES.length : args.min;
  if (!v.requireMinimum(presentCount, minimum, 'triage-parity source files (skills/develop-feature/SKILL.md and src/claude.md)')) {
    return;
  }

  checkParity(v, contents);
});
