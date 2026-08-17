#!/usr/bin/env node
'use strict';

/**
 * Validates `tests/fixtures/manifest.json` against EVERY discovered QA
 * document under `docs/qa/*_test_cases.md` (10 exist at HEAD) — the map from
 * every FIXTURE-class test case in each of those documents to the committed
 * input it needs.
 *
 * What a FIXTURE case is (per each QA document's own Section 1 definition):
 * invoke exactly one named subagent (`verifier`, `plan-critic`,
 * `code-reviewer`, `security-auditor`, `planner`, or `debugger`) against a
 * crafted input file committed under `tests/fixtures/`, and inspect that
 * agent's own returned output. There is no scripted mechanism in this
 * repository to invoke a Claude agent headlessly and capture its output for
 * assertion — no API harness, no eval runner — so FIXTURE cases cannot be
 * executed in CI.
 *
 * IMPORTANT — what this validator does NOT do: it never invokes an agent and
 * never asserts on a FIXTURE case's actual outcome. It proves a narrower,
 * genuinely mechanizable fact, per QA document: that every FIXTURE case
 * named in that document has a manifest entry whose `qaDoc` points at it,
 * that every entry's committed fixture path still exists on disk (the
 * actual failure mode — a renamed, emptied, or deleted fixture directory
 * going unnoticed), that every entry names a real agent, that no `qaDoc`
 * value is dangling (naming a document that does not exist), and that no
 * document containing FIXTURE cases is wholesale unregistered (zero manifest
 * entries pointing at it at all — the gap this generalization exists to
 * close). Closing the "nothing runs these cases" gap requires a human, or a
 * future eval harness, to actually invoke each agent — this validator only
 * keeps their committed inputs honest in the meantime.
 *
 * The `(qaDoc, id)` pair, not `id` alone, is the unit of identity: the same
 * `TC-<n>.<n>`-shaped id is reused independently across documents, so an
 * id-only bijection would silently treat a same-numbered case in the wrong
 * document as a match.
 */

const fs = require('fs');
const path = require('path');
const core = require('./lib/validate-core.js');

const QA_DIR = 'docs/qa';
const QA_DOC_NAME_RE = /_test_cases\.md$/;
const MANIFEST = 'tests/fixtures/manifest.json';

// Matches both the legacy `TC-<n>.<n>` shape (e.g. `TC-12.1`) and the wider
// shape actually used across QA documents (e.g. `TC-FR6.2a-1`, `TC-FR6.5-1`):
// an alnum-only first segment, zero or more `.`-delimited alnum segments,
// and an optional trailing `-<digits>` disambiguator. Verified empirically:
// the previous `/^TC-\d+\.\d+$/` matched `TC-12.1` but not `TC-FR6.2a-1`,
// silently hiding every `TC-FR*` FIXTURE case from the bijection below.
const TC_ID_RE = /^TC-[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*(?:-\d+)?$/;

function tryRead(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Discovers every `docs/qa/*_test_cases.md` file under `root`, returning
 * repo-relative paths (POSIX-separated, sorted) suitable both for display
 * and for direct comparison against a manifest entry's `qaDoc` value.
 * Missing `docs/qa/` -> [].
 */
function discoverQaDocs(root) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, QA_DIR), { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return entries
    .filter((e) => e.isFile() && QA_DOC_NAME_RE.test(e.name))
    .map((e) => `${QA_DIR}/${e.name}`)
    .sort();
}

/**
 * Extracts every TC ID from a row of a QA document's test-case tables whose
 * `Kind` column reads exactly `FIXTURE`. Every test-case table across every
 * discovered document shares the same 7-column shape:
 *   | TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
 * so `Kind` is always the 3rd cell after the leading (empty) split segment.
 * Reference/summary tables elsewhere in a document (Verdict Matrix rows,
 * AC/UC coverage tables, the Count Summary table) never start a row with a
 * `TC-...` token in the first cell, so they are excluded by construction —
 * no separate exclusion list is needed.
 */
function extractFixtureIds(qaDocText) {
  const ids = [];
  const lines = qaDocText.split(/\r?\n/);
  const rowRe = new RegExp(`^\\|\\s*(${TC_ID_RE.source.slice(1, -1)})\\s*\\|`);
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

  // Anti-vacuity, extended to document count (FR-9.6): a regression that
  // silently stops discovering one or more docs/qa/*_test_cases.md files
  // (e.g. a broken glob, or pointing --root at the wrong place) must fail
  // loudly rather than validating fewer documents than actually exist.
  // Defaults to 10 (the real count at HEAD); --min lowers it for seeded
  // single-document fixture roots.
  const discoveredDocs = discoverQaDocs(root);
  const docCountMinimum = args.min === null ? 10 : args.min;
  if (!v.requireMinimum(discoveredDocs.length, docCountMinimum, `discovered QA document(s) matching ${QA_DIR}/*_test_cases.md`)) {
    return;
  }

  const manifestText = tryRead(root, MANIFEST);
  if (manifestText === null) {
    v.error(MANIFEST, 'file does not exist');
    return;
  }

  let manifest = null;
  try {
    manifest = JSON.parse(manifestText);
  } catch (err) {
    v.error(MANIFEST, `does not parse as JSON — ${err.message}`);
    return;
  }

  const cases = Array.isArray(manifest.cases) ? manifest.cases : [];

  // Anti-vacuity, independent of the document-count floor above: a manifest
  // that exists but declares zero cases must fail, not pass. This floor is
  // fixed at 1 and is deliberately NOT controlled by `--min`, so a tiny
  // seeded fixture (one deliberately-bad entry) still reaches its intended
  // assertion below rather than tripping here.
  if (cases.length < 1) {
    v.error(MANIFEST, 'declares zero entries under `cases` — a manifest with no entries proves nothing about any FIXTURE case');
  }

  const discoveredDocSet = new Set(discoveredDocs);

  // Per-document FIXTURE id sets, built once per discovered document.
  const qaFixtureIdsByDoc = new Map();
  for (const docPath of discoveredDocs) {
    const text = tryRead(root, docPath);
    qaFixtureIdsByDoc.set(docPath, new Set(text !== null ? extractFixtureIds(text) : []));
  }

  const seenPairs = new Set(); // `${qaDoc} ${id}`
  const manifestIdsByDoc = new Map(); // qaDoc -> Set(id) — only entries with a valid, non-dangling qaDoc
  const registeredDocs = new Set(); // every qaDoc value any entry legitimately points at

  for (let i = 0; i < cases.length; i += 1) {
    const entry = cases[i];
    const label = entry && typeof entry.id === 'string' && entry.id ? entry.id : `cases[${i}]`;

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      v.error(MANIFEST, `${label}: entry is not a JSON object`);
      continue;
    }

    // Required `qaDoc` field (FR-9.2). Missing/empty is an error identical
    // in shape to a missing `id`/`agent`/`expect`. A non-empty value that
    // does not name any discovered document is a DANGLING reference — its
    // own, distinctly worded error, separate from a stale-id finding below.
    let qaDocValid = false;
    if (typeof entry.qaDoc !== 'string' || !entry.qaDoc.trim()) {
      v.error(MANIFEST, `${label}: missing or empty required field \`qaDoc\``);
    } else if (!discoveredDocSet.has(entry.qaDoc)) {
      v.error(
        MANIFEST,
        `${label}: \`qaDoc\` "${entry.qaDoc}" is a dangling reference — it does not match any discovered QA document under ${QA_DIR}/*_test_cases.md (typo'd, renamed, or removed)`
      );
    } else {
      qaDocValid = true;
      registeredDocs.add(entry.qaDoc);
    }

    // Required fields.
    if (typeof entry.id !== 'string' || !entry.id.trim()) {
      v.error(MANIFEST, `${label}: missing or empty required field \`id\``);
    } else if (!TC_ID_RE.test(entry.id)) {
      v.error(MANIFEST, `${label}: \`id\` "${entry.id}" does not match the QA document's TC-<id> format (e.g. TC-12.1 or TC-FR6.2a-1)`);
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

    // Bijection bookkeeping is scoped by the `(qaDoc, id)` pair (FR-9.3):
    // only entries whose `qaDoc` resolved to a real discovered document
    // contribute, since a dangling `qaDoc` already has its own error above
    // and cannot be meaningfully attributed to any document's bijection.
    if (qaDocValid && typeof entry.id === 'string' && entry.id.trim()) {
      const pairKey = `${entry.qaDoc} ${entry.id}`;
      if (seenPairs.has(pairKey)) {
        v.error(MANIFEST, `${entry.qaDoc} ${entry.id}: duplicate manifest entry for this (qaDoc, id) pair`);
      }
      seenPairs.add(pairKey);
      if (!manifestIdsByDoc.has(entry.qaDoc)) manifestIdsByDoc.set(entry.qaDoc, new Set());
      manifestIdsByDoc.get(entry.qaDoc).add(entry.id);
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

  // Per-document bijection (FR-9.3): every FIXTURE-labelled case ID in a
  // document must have a manifest entry whose `(qaDoc, id)` pair matches,
  // and no manifest entry may reference a case ID absent from the document
  // it claims to belong to (catches stale entries — renamed/removed test
  // cases, or entries for a case whose Kind is no longer FIXTURE).
  for (const docPath of discoveredDocs) {
    const qaIds = qaFixtureIdsByDoc.get(docPath) || new Set();
    const manifestIds = manifestIdsByDoc.get(docPath) || new Set();

    const missing = [...qaIds].filter((id) => !manifestIds.has(id));
    if (missing.length > 0) {
      v.error(
        MANIFEST,
        `${missing.length} FIXTURE case(s) documented in ${docPath} have no manifest entry: ${missing.join(', ')}`
      );
    }

    const stale = [...manifestIds].filter((id) => !qaIds.has(id));
    if (stale.length > 0) {
      v.error(
        MANIFEST,
        `${stale.length} manifest entry(ies) reference a case ID not documented as FIXTURE in ${docPath}: ${stale.join(', ')}`
      );
    }
  }

  // Wholesale-unregistered-document check (FR-9.5) — independent of the
  // per-entry bijection above, and the specific defect this generalization
  // exists to close: a document with zero manifest entries pointing at it
  // produces an empty `missing` set (nothing to compare against) in the
  // per-document loop above and would otherwise pass silently. Confirmed at
  // HEAD: `docs/qa/adaptive-tier-routing_test_cases.md` has FIXTURE cases
  // but zero manifest entries name it via `qaDoc`.
  for (const docPath of discoveredDocs) {
    const qaIds = qaFixtureIdsByDoc.get(docPath) || new Set();
    if (qaIds.size > 0 && !registeredDocs.has(docPath)) {
      v.error(
        MANIFEST,
        `${docPath}: contains ${qaIds.size} FIXTURE case(s) but has no manifest entry pointing at it at all (no entry's \`qaDoc\` names this document) — this document is wholesale unregistered`
      );
    }
  }
});
