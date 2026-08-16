#!/usr/bin/env node
'use strict';

/**
 * Validates `tests/fixtures/manifest.json` against
 * `docs/qa/verification-review-upgrade_test_cases.md` — the map from every
 * FIXTURE-class test case in that QA document to the committed input it
 * needs.
 *
 * What a FIXTURE case is (per the QA document's own Section 1 definition):
 * invoke exactly one named subagent (`verifier`, `plan-critic`,
 * `code-reviewer`, `security-auditor`, or `planner`) against a crafted input
 * file committed under `tests/fixtures/`, and inspect that agent's own
 * returned output. There is no scripted mechanism in this repository to
 * invoke a Claude agent headlessly and capture its output for assertion — no
 * API harness, no eval runner — so FIXTURE cases cannot be executed in CI.
 *
 * IMPORTANT — what this validator does NOT do: it never invokes an agent and
 * never asserts on a FIXTURE case's actual outcome. It proves a narrower,
 * genuinely mechanizable fact: that every FIXTURE case named in the QA
 * document has a manifest entry, that every entry's committed fixture path
 * still exists on disk (the actual failure mode — a renamed, emptied, or
 * deleted fixture directory going unnoticed), that every entry names a real
 * agent, and that the manifest carries no stale entries the QA document no
 * longer documents. Closing the "nothing runs these 52 cases" gap requires a
 * human, or a future eval harness, to actually invoke each agent — this
 * validator only keeps their committed inputs honest in the meantime.
 */

const fs = require('fs');
const path = require('path');
const core = require('./lib/validate-core.js');

const QA_DOC = 'docs/qa/verification-review-upgrade_test_cases.md';
const MANIFEST = 'tests/fixtures/manifest.json';

function tryRead(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Extracts every TC ID from a row of the QA document's test-case tables
 * whose `Kind` column reads exactly `FIXTURE`. Every test-case table in that
 * document shares the same 7-column shape:
 *   | TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
 * so `Kind` is always the 3rd cell after the leading (empty) split segment.
 * Reference/summary tables elsewhere in the document (the Verdict Matrix's
 * numbered rows, the AC/UC coverage tables, the Count Summary table) never
 * start a row with a `TC-<n>.<n>` token in the first cell, so they are
 * excluded by construction — no separate exclusion list is needed.
 */
function extractFixtureIds(qaDocText) {
  const ids = [];
  const lines = qaDocText.split(/\r?\n/);
  const rowRe = /^\|\s*(TC-\d+\.\d+)\s*\|/;
  for (const line of lines) {
    const m = rowRe.exec(line);
    if (!m) continue;
    const cells = line.split('|').map((c) => c.trim());
    // cells[0] is '' (text before the leading `|`); cells[1] = TC ID,
    // cells[2] = UC Scenario, cells[3] = Kind.
    if (cells.length < 4) continue;
    if (cells[3] === 'FIXTURE') ids.push(m[1]);
  }
  return ids;
}

function fixturePathsOf(entry) {
  if (entry.fixture === null || entry.fixture === undefined) return [];
  return Array.isArray(entry.fixture) ? entry.fixture : [entry.fixture];
}

core.run('validate-fixture-manifest', (v, args) => {
  const root = args.root;

  const qaDocText = tryRead(root, QA_DOC);
  const manifestText = tryRead(root, MANIFEST);

  const presentCount = (qaDocText !== null ? 1 : 0) + (manifestText !== null ? 1 : 0);
  const sourceMinimum = args.min === null ? 2 : args.min;
  if (!v.requireMinimum(presentCount, sourceMinimum, `required source files (${QA_DOC} and ${MANIFEST})`)) {
    return;
  }

  let manifest = null;
  if (manifestText !== null) {
    try {
      manifest = JSON.parse(manifestText);
    } catch (err) {
      v.error(MANIFEST, `does not parse as JSON — ${err.message}`);
    }
  }

  const cases = manifest && Array.isArray(manifest.cases) ? manifest.cases : [];

  // Anti-vacuity, independent of the source-file-presence floor above: a
  // manifest that exists but declares zero cases must fail, not pass —
  // exactly the "manifest with zero entries" half of the anti-vacuity
  // requirement. This floor is fixed at 1 and is deliberately NOT controlled
  // by `--min`, so a tiny seeded fixture (one deliberately-bad entry) still
  // reaches its intended assertion below rather than tripping here.
  if (manifest !== null && cases.length < 1) {
    v.error(MANIFEST, 'declares zero entries under `cases` — a manifest with no entries proves nothing about any FIXTURE case');
  }

  const qaFixtureIds = qaDocText !== null ? extractFixtureIds(qaDocText) : [];
  const qaFixtureIdSet = new Set(qaFixtureIds);

  const seenIds = new Set();
  const manifestIdSet = new Set();

  for (let i = 0; i < cases.length; i += 1) {
    const entry = cases[i];
    const label = entry && typeof entry.id === 'string' && entry.id ? entry.id : `cases[${i}]`;

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      v.error(MANIFEST, `${label}: entry is not a JSON object`);
      continue;
    }

    // Required fields.
    if (typeof entry.id !== 'string' || !entry.id.trim()) {
      v.error(MANIFEST, `${label}: missing or empty required field \`id\``);
    } else if (!/^TC-\d+\.\d+$/.test(entry.id)) {
      v.error(MANIFEST, `${label}: \`id\` "${entry.id}" does not match the QA document's TC-<n>.<n> format`);
    }
    if (typeof entry.agent !== 'string' || !entry.agent.trim()) {
      v.error(MANIFEST, `${label}: missing or empty required field \`agent\``);
    }
    if (!('fixture' in entry)) {
      v.error(MANIFEST, `${label}: missing required field \`fixture\` (a path, an array of paths, or null)`);
    }
    if (typeof entry.expect !== 'string' || !entry.expect.trim()) {
      v.error(MANIFEST, `${label}: missing or empty required field \`expect\``);
    }

    if (typeof entry.id === 'string' && entry.id.trim()) {
      if (seenIds.has(entry.id)) {
        v.error(MANIFEST, `${entry.id}: duplicate manifest entry for this ID`);
      }
      seenIds.add(entry.id);
      manifestIdSet.add(entry.id);
    }

    // `fixture` shape and, unless explicitly null, on-disk existence.
    if (entry.fixture === null) {
      if (typeof entry.note !== 'string' || !entry.note.trim()) {
        v.error(MANIFEST, `${label}: \`fixture\` is null but no non-empty \`note\` explains what committed input is missing`);
      }
    } else if (entry.fixture !== undefined) {
      const paths = fixturePathsOf(entry);
      if (paths.length === 0) {
        v.error(MANIFEST, `${label}: \`fixture\` must be a non-empty path, a non-empty array of paths, or null`);
      }
      for (const p of paths) {
        if (typeof p !== 'string' || !p.trim()) {
          v.error(MANIFEST, `${label}: \`fixture\` contains a non-string or empty path entry`);
          continue;
        }
        const full = path.join(root, p);
        if (!fs.existsSync(full)) {
          v.error(MANIFEST, `${label}: fixture path does not exist: ${p}`);
        }
      }
    }

    // `agent` must resolve to a real agent definition.
    if (typeof entry.agent === 'string' && entry.agent.trim()) {
      const agentFile = path.join(root, 'agents', `${entry.agent}.md`);
      if (!fs.existsSync(agentFile)) {
        v.error(MANIFEST, `${label}: agent \`${entry.agent}\` does not exist as agents/${entry.agent}.md`);
      }
    }
  }

  // Every FIXTURE-labelled case ID in the QA document must have a manifest
  // entry — catches a case added to the doc with no fixture ever recorded.
  if (qaDocText !== null) {
    const missing = qaFixtureIds.filter((id) => !manifestIdSet.has(id));
    if (missing.length > 0) {
      v.error(
        MANIFEST,
        `${missing.length} FIXTURE case(s) documented in ${QA_DOC} have no manifest entry: ${missing.join(', ')}`
      );
    }
  }

  // No manifest entry may reference a case ID absent from the QA document —
  // catches stale entries (renamed/removed test cases, or entries for a
  // case whose Kind is no longer FIXTURE).
  if (qaDocText !== null) {
    const stale = [...manifestIdSet].filter((id) => !qaFixtureIdSet.has(id));
    if (stale.length > 0) {
      v.error(
        MANIFEST,
        `${stale.length} manifest entry(ies) reference a case ID not documented as FIXTURE in ${QA_DOC}: ${stale.join(', ')}`
      );
    }
  }
});
