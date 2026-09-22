#!/usr/bin/env node
'use strict';

/**
 * Mechanizes the instinct store's arithmetic — the single largest gap the
 * verification gate named in `docs/verification/self-improvement-loop.md`:
 *
 *   "the code that writes .claude/instincts.md in the first place (capture,
 *    elevation, decay, retirement) has no code path at all; it is a
 *    human/model-following-prose activity ... there is no static or dynamic
 *    proof that the file's contents are ever produced correctly."
 *
 * Everything downstream of the store IS real, tested code: the session-start
 * injection path, both wave-safety guards, the D1 allowlist. The producer side
 * was prose in `skills/merge-ready/SKILL.md` and nothing checked its output.
 *
 * This does not turn the prose into an executor — a model still performs the
 * capture and consolidation. It makes the RESULT checkable, which converts a
 * silent arithmetic drift into a failing build. That is the same trade the rest
 * of this repo makes with `validate-instinct-discipline.js`: it cannot force
 * correct behaviour, but it can refuse to let an incorrect result stand.
 *
 * Invariants enforced, each traceable to its requirement:
 *
 *   C2/FR-1.4  Confidence must be within [0.3, 0.9] AND no greater than
 *              min(0.9, 0.3 + 0.2 x (occurrences - 1)). It may be LOWER —
 *              decay subtracts 0.05 per unconfirmed Finalization, floored at
 *              0.3 — so the formula is an upper bound, never an equality. An
 *              equality check here would fail every legitimately decayed entry.
 *   FR-4.x     Retires at must equal Last confirmed at + 10.
 *   FR-4.1     An entry whose Retires at has fallen to or below the Meta
 *              feature counter should have been deleted outright, not left.
 *   FR-3.3     Elevation is by occurrence count and category: an entry in
 *              Prevention Rules must have reached 2 occurrences when its
 *              category is security or data-integrity, 3 when it is general.
 *              An entry still in Instincts Log must NOT have reached it —
 *              otherwise elevation silently did not run.
 *   D1         Rule text must satisfy the same allowlist the session-start
 *              hook enforces, so a rule that would be silently dropped at
 *              injection time is caught when it is written instead.
 *
 * Merge-artifact detection (parallel-features S7). `.claude/instincts.md`
 * carries `merge=union`, so a two-branch merge legitimately leaves duplicated
 * lines behind — and this parser used to normalize every one of them SILENTLY:
 * the Meta `.find()` half-read a duplicated counter, `parseStore` folded a
 * duplicated `## X` heading's lines into the first, and `entriesOf` let a
 * duplicated field line win last and emitted duplicated slugs as independent
 * entries. Each of the five canonical reconciliation classes that
 * `skills/merge-ready/SKILL.md`'s Merge Reconciliation preamble repairs is now
 * DETECTED and reported here — never silently normalized, and never repaired:
 * the repair is the preamble's job, this validator only refuses to let an
 * unreconciled store stand.
 *
 *   class (a)  duplicated `Feature counter:` lines in `## Meta`.
 *   class (b)  duplicated `### <slug>` entries (same or different section).
 *   class (c)  `Last confirmed at` beyond the Meta feature counter.
 *   class (d)  duplicated field lines within one entry.
 *   class (e)  duplicated `## X` section headings.
 *
 * An empty store (the shipped template) is valid and must pass: a project that
 * has not learned anything yet is a designed state, not an error.
 */

const fs = require('fs');
const path = require('path');
const core = require('./lib/validate-core.js');

// Shared verbatim with hooks/handlers/session-start-spine.js's RULE_RE (D1).
// Kept identical on purpose: a rule accepted here and rejected there would put
// the two consumers back out of sync, which is the exact BLOCKER D1 exists to
// prevent.
const RULE_RE = /^[\p{L}\p{N} ._/():+#&',—-]{1,200}$/u;

const CATEGORIES = new Set(['security', 'data-integrity', 'general']);
const ELEVATION_THRESHOLD = { security: 2, 'data-integrity': 2, general: 3 };

const REQUIRED_FIELDS = [
  'Confidence', 'Category', 'Pattern', 'Rule', 'Trigger',
  'Occurrences', 'Last confirmed at', 'Retires at',
];

const STORE_PATHS = ['.claude/instincts.md', 'templates/instincts.md'];

function parseStore(text) {
  const sections = { Meta: [], 'Prevention Rules': [], 'Instincts Log': [] };
  // Class (e) bookkeeping: a duplicated heading's lines are still appended
  // into the first occurrence's array (unchanged fold, so downstream checks
  // keep working on SOME coherent view), but the fold is no longer silent —
  // checkStore reports every heading seen more than once.
  const headingLines = {};
  let current = null;
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      current = h2[1];
      (headingLines[current] = headingLines[current] || []).push(i + 1);
      if (!(current in sections)) sections[current] = [];
      return;
    }
    if (current) sections[current].push({ line: i + 1, text: line });
  });
  const duplicateHeadings = Object.keys(headingLines)
    .filter((name) => headingLines[name].length > 1)
    .map((name) => ({ name, lines: headingLines[name] }));
  return { sections, duplicateHeadings };
}

function entriesOf(sectionLines) {
  const entries = [];
  let cur = null;
  for (const { line, text } of sectionLines) {
    const h3 = /^###\s+(.+?)\s*$/.exec(text);
    if (h3) { cur = { slug: h3[1], line, fields: {}, duplicateFields: [] }; entries.push(cur); continue; }
    if (!cur) continue;
    const f = /^([A-Za-z ]+):\s*(.*)$/.exec(text);
    if (f) {
      const name = f[1].trim();
      // Class (d) bookkeeping: keep the last value (unchanged last-wins, so
      // downstream checks see one value per field), but record the collision
      // for checkEntry to report instead of letting one branch's decay or
      // confirmation vanish without a trace.
      if (name in cur.fields) cur.duplicateFields.push({ name, line });
      cur.fields[name] = f[2].trim();
    }
  }
  return entries;
}

function num(raw) {
  if (raw === undefined) return null;
  const m = /-?\d+(?:\.\d+)?/.exec(raw);
  return m ? Number(m[0]) : null;
}

function checkEntry(v, rel, entry, section, counter) {
  // `rel` is already the error's file field; repeating it here duplicated the
  // path in every message.
  const where = `${section} / ${entry.slug}, line ${entry.line}`;
  const f = entry.fields;

  // Reported before the required-fields gate: a duplicated field is present
  // twice, not missing, so the early return below would never surface it.
  for (const dup of entry.duplicateFields) {
    v.error(
      rel,
      `${where}: \`${dup.name}:\` appears more than once in this entry (again at line ${dup.line}) — ` +
        `a class (d) merge artifact. A union merge kept both branches' field lines, and last-wins ` +
        `silently erased one branch's decay or confirmation. The reconciliation preamble keeps the ` +
        `repaired value and drops the duplicates.`
    );
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in f) || f[field] === '') {
      v.error(rel, `${where}: missing required field \`${field}:\`.`);
      return; // further checks would report noise off a half-parsed entry
    }
  }

  const category = f.Category;
  if (!CATEGORIES.has(category)) {
    v.error(rel, `${where}: \`Category: ${category}\` is not one of ${[...CATEGORIES].join(', ')}.`);
    return;
  }

  if (!RULE_RE.test(f.Rule)) {
    v.error(
      rel,
      `${where}: \`Rule:\` fails the D1 allowlist that hooks/handlers/session-start-spine.js ` +
        `enforces at injection time, so this entry would be silently dropped rather than injected. ` +
        `A single line of 1-200 characters, letters/digits/space and . _ / ( ) : + # & ' , — - only. ` +
        `Got: ${f.Rule.slice(0, 80)}`
    );
  }

  const occurrences = num(f.Occurrences);
  const confidence = num(f.Confidence);
  const lastConfirmed = num(f['Last confirmed at']);
  const retires = num(f['Retires at']);

  if (occurrences === null || occurrences < 1) {
    v.error(rel, `${where}: \`Occurrences:\` must carry a count of at least 1.`);
    return;
  }
  if (confidence === null) {
    v.error(rel, `${where}: \`Confidence:\` is not a number.`);
    return;
  }

  if (confidence < 0.3 || confidence > 0.9) {
    v.error(
      rel,
      `${where}: \`Confidence: ${confidence}\` is outside the [0.3, 0.9] range C2 clamps to.`
    );
  }

  // Upper bound, not equality — decay legitimately pushes a value below it.
  const ceiling = Math.min(0.9, 0.3 + 0.2 * (occurrences - 1));
  if (confidence > ceiling + 1e-9) {
    v.error(
      rel,
      `${where}: \`Confidence: ${confidence}\` exceeds what ${occurrences} occurrence(s) can ` +
        `produce. C2's formula min(0.9, 0.3 + 0.2 x (occurrences - 1)) caps this entry at ` +
        `${ceiling.toFixed(2)}. Confidence may sit BELOW the cap (decay), never above it — a value ` +
        `above it means the number was raised without a recorded occurrence, and the ` +
        `>=0.7 session-start filter injects on exactly this number.`
    );
  }

  // Class (c): a stamp from a discarded branch can sit beyond the kept
  // counter, because class (a)'s max-repair deliberately undercounts by one
  // per concurrent feature. Every later decay/retirement computation would
  // then reason from a Finalization that never happened.
  if (counter !== null && lastConfirmed !== null && lastConfirmed > counter) {
    v.error(
      rel,
      `${where}: \`Last confirmed at: ${lastConfirmed}\` is beyond the Meta feature counter ` +
        `(${counter}) — a class (c) merge artifact. The reconciliation preamble clamps the stamp ` +
        `to the counter and recomputes \`Retires at\` from the clamped value.`
    );
  }

  if (lastConfirmed !== null && retires !== null && retires !== lastConfirmed + 10) {
    v.error(
      rel,
      `${where}: \`Retires at: ${retires}\` should be \`Last confirmed at\` + 10 = ` +
        `${lastConfirmed + 10}. Retirement is what bounds the store; a wrong offset either keeps ` +
        `a stale rule forever or drops a live one early.`
    );
  }

  if (counter !== null && retires !== null && retires <= counter) {
    v.error(
      rel,
      `${where}: \`Retires at: ${retires}\` is at or below the Meta feature counter (${counter}), ` +
        `so FR-4.1 required this entry to be deleted outright at the last Finalization. It is ` +
        `still here, which means the retirement sweep did not run.`
    );
  }

  const threshold = ELEVATION_THRESHOLD[category];
  if (section === 'Prevention Rules' && occurrences < threshold) {
    v.error(
      rel,
      `${where}: elevated to Prevention Rules at ${occurrences} occurrence(s), but ` +
        `\`Category: ${category}\` requires ${threshold}. Prevention Rules are read unfiltered by ` +
        `planner and injected at session start — early elevation puts an unconfirmed pattern into ` +
        `executed plans.`
    );
  }
  if (section === 'Instincts Log' && occurrences >= threshold) {
    v.error(
      rel,
      `${where}: has reached ${occurrences} occurrence(s) with \`Category: ${category}\` ` +
        `(threshold ${threshold}) but is still in Instincts Log. Elevation did not run, so a ` +
        `pattern that earned its way into Prevention Rules is being ignored.`
    );
  }
}

function checkStore(v, rel, text) {
  const { sections, duplicateHeadings } = parseStore(text);

  // Class (e): reported first because the fold it names is what every check
  // below reads through — the preamble likewise folds duplicated headings
  // before applying any other repair, for exactly this reason.
  for (const dup of duplicateHeadings) {
    v.error(
      rel,
      `\`## ${dup.name}\` appears ${dup.lines.length} times (lines ${dup.lines.join(', ')}) — a ` +
        `class (e) merge artifact. A union merge kept both branches' section headings, and the ` +
        `parser silently appends the duplicate's lines into the first. The reconciliation ` +
        `preamble folds each section's blocks into one before any other repair.`
    );
  }

  for (const required of ['Meta', 'Prevention Rules', 'Instincts Log']) {
    if (!(required in sections)) {
      v.error(rel, `missing the \`## ${required}\` section. The store has exactly three.`);
      return;
    }
  }

  const counterLines = sections.Meta.filter((l) => /^Feature counter:/.test(l.text));
  if (counterLines.length === 0) {
    v.error(rel, '`## Meta` has no `Feature counter:` line.');
    return;
  }
  // Class (a): the old `.find()` took whichever line came first and said
  // nothing. The first-line read below is unchanged — but it is no longer
  // silent when there was more than one line to choose from.
  if (counterLines.length > 1) {
    v.error(
      rel,
      `\`## Meta\` carries ${counterLines.length} \`Feature counter:\` lines ` +
        `(lines ${counterLines.map((l) => l.line).join(', ')}) — a class (a) merge artifact. A ` +
        `union merge kept both branches' counters, and every reader silently half-reads whichever ` +
        `line comes first. The reconciliation preamble resolves this to the max.`
    );
  }
  const counterLine = counterLines[0];
  const counter = num(counterLine.text);
  if (counter === null || counter < 0 || !Number.isInteger(counter)) {
    v.error(rel, `\`Feature counter\` must be a non-negative integer; got ${counterLine.text.trim()}.`);
    return;
  }

  // Class (b) bookkeeping: `entriesOf` still emits a duplicated slug as
  // independent entries (each is checked on its own merits), but the split
  // itself is now reported — same or cross-section, since a cross-section
  // twin is exactly what the preamble's section-placement clause repairs.
  const slugLocations = {};
  for (const section of ['Prevention Rules', 'Instincts Log']) {
    for (const entry of entriesOf(sections[section])) {
      (slugLocations[entry.slug] = slugLocations[entry.slug] || [])
        .push(`${section} line ${entry.line}`);
      checkEntry(v, rel, entry, section, counter);
    }
  }
  for (const slug of Object.keys(slugLocations)) {
    if (slugLocations[slug].length > 1) {
      v.error(
        rel,
        `\`### ${slug}\` appears ${slugLocations[slug].length} times (${slugLocations[slug].join('; ')}) ` +
          `— a class (b) merge artifact. A union merge kept both branches' captures of the same ` +
          `pattern, fragmenting its occurrence count so it neither elevates nor retires. The ` +
          `reconciliation preamble unions the twins into one entry with re-derived ` +
          `occurrences/confidence and a single section placement.`
      );
    }
  }
}

core.run('validate-instinct-store', (v, args) => {
  const root = args.root;
  let checked = 0;

  for (const rel of STORE_PATHS) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue; // a project without a store is a designed state
    checkStore(v, rel, fs.readFileSync(abs, 'utf8'));
    checked += 1;
  }

  const minimum = args.min === null ? 1 : args.min;
  v.requireMinimum(checked, minimum, 'instinct store files');
  v.checkedCount = checked;
});
