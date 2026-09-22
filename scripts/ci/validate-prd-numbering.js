#!/usr/bin/env node
'use strict';

/**
 * Guards docs/PRD.md's section-number allocation invariant (PRD Section 15,
 * UC-6): section numbers are allocated `max(existing) + 1` and NEVER reused
 * (`agents/prd-writer.md`'s allocation rule), so the only illegal state the
 * file itself can exhibit is a duplicated `## N.` heading — the exact
 * artifact two parallel feature sessions produce when both allocate the
 * "next" section number from the same base and both merges land.
 *
 * Deliberately NOT flagged: gaps. A renamed or moved section vacates its
 * number forever, so a non-contiguous sequence is the designed trace of a
 * rename, not a defect. A contiguity check here would force gap-refill —
 * precisely the behaviour the allocation rule forbids, because every
 * cross-reference class (use-case headers, QA headers, digest rows) keys on
 * the section number, and refilling a vacated one silently repoints them.
 * The `good-moved-section-gap` fixture pins this as a CI positive control.
 *
 * Anti-vacuity counts HEADINGS, not files: a PRD that exists but contains no
 * `## N.` heading has nothing for this validator to check, and "exits 0"
 * must not mean "found nothing" (FR-5.9).
 */

const fs = require('fs');
const path = require('path');
const core = require('./lib/validate-core.js');

const PRD_REL = 'docs/PRD.md';
const HEADING_RE = /^## (\d+)\./;

core.run('validate-prd-numbering', (v, args) => {
  const abs = path.join(args.root, PRD_REL);
  let headings = 0;

  if (fs.existsSync(abs)) {
    const seen = new Map(); // section number -> [1-based line numbers]
    fs.readFileSync(abs, 'utf8').split('\n').forEach((line, i) => {
      const m = HEADING_RE.exec(line);
      if (!m) return;
      headings += 1;
      const n = Number(m[1]);
      if (!seen.has(n)) seen.set(n, []);
      seen.get(n).push(i + 1);
    });

    for (const [n, at] of seen) {
      if (at.length > 1) {
        v.error(
          PRD_REL,
          `duplicate section number ${n}: \`## ${n}.\` appears ${at.length} times ` +
            `(lines ${at.join(', ')}). Numbers are allocated max+1 and never reused, ` +
            `so a duplicate is a merge collision: the later merger renumbers their ` +
            `OWN section to max+1 — never the already-merged one — and updates its ` +
            `use-case, QA, and digest references (skills/merge-ready Gate 1).`
        );
      }
    }
  }

  const minimum = args.min === null ? 1 : args.min;
  v.requireMinimum(headings, minimum, 'numbered `## N.` PRD section headings');
});
