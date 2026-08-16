'use strict';

/**
 * .claude/statusline.js — claude-code-sdlc statusline renderer (PRD §10 FR-13).
 *
 * Copied verbatim by `install.sh --init-project` to `.claude/statusline.js`
 * (a `cp`, never an execution — FR-13.1) and then invoked directly by Claude
 * Code's own native statusline mechanism after every response, per the
 * `statusLine` command `.claude/settings.json` configures (FR-13.2):
 * `{"type": "command", "command": "node .claude/statusline.js"}`.
 *
 * NOT A HOOK. This is never dispatched through `hooks/lib/run-hook.js`,
 * registers no `hooks/hooks.json` entry, has no Node-version gate, and is
 * not subject to `SDLC_HOOKS_ENABLED`/`SDLC_DISABLED_HOOKS` — it is its own,
 * fourth, independent Node-execution context (NFR-4), consuming zero of the
 * harness's hook-budget slots (FR-13.7). It also has NO reverse dependency
 * on the pipeline: nothing this repository ships reads this script's stdout
 * back in (FR-13.6) — its own absence (an unconfigured `statusLine`) is
 * Claude Code's native, silent behavior, not a condition this file detects.
 *
 * ===========================================================================
 * FR-13.4 SPIKE FINDING — read this before touching the extraction logic.
 * ===========================================================================
 *
 * REQUIRED (FR-13.4 / UC-17-EC1): invoke a real, interactive Claude Code
 * session with `statusLine` configured, capture the ACTUAL stdin JSON, and
 * record the exact field names for cost and token/context-window usage —
 * including whether an autocompact-reserve value is exposed directly or must
 * be approximated by a documented constant — before finalizing this file's
 * extraction logic. This is a go/no-go gate, mirroring PRD §8 FR-6.1's own
 * "record the finding before writing the logic" precedent exactly.
 *
 * THIS ENVIRONMENT COULD NOT PERFORM THAT CAPTURE. This subagent runs
 * non-interactively, with no running Claude Code session to configure a live
 * `statusLine` command against and observe what it actually pipes to stdin.
 * No such capture exists anywhere in this repository either — `hooks/`,
 * `docs/`, `templates/`, and `README.md` were all searched for prior
 * evidence of the payload shape, and none names these fields. The finding is
 * therefore recorded HONESTLY, split field-by-field, rather than assumed:
 *
 *   - COST: NOT independently verified against a live capture in this
 *     environment. `cost.total_cost_usd` is tried first below because it is
 *     the shape most consistently referenced by community-written Claude
 *     Code statusline scripts this model's training data is aware of — but
 *     that recollection is explicitly NOT the same thing as a verified
 *     capture, and it is treated here as one untrusted candidate among
 *     several (see COST_PATHS), never as a confirmed fact.
 *   - TOKEN / CONTEXT-WINDOW USAGE: UNDETERMINED. No field name for a
 *     numeric used-token count, a max-token/context-window size, or an
 *     autocompact-reserve value could be found in this repository, and none
 *     could be independently verified against a live capture either. This is
 *     the field FR-13.4 most needed to settle and it did not settle here.
 *   - WHAT WOULD SETTLE IT: configure `statusLine` per FR-13.2 in a real,
 *     interactive session; temporarily replace the command with one that
 *     tees stdin to a file before rendering, e.g.
 *       "command": "sh -c 'tee /tmp/statusline-capture.json | node .claude/statusline.js'"
 *     trigger one response, and inspect the captured JSON directly. Update
 *     this header and the *_PATHS lists below once that capture exists.
 *
 * CONSEQUENCE FOR THE CODE BELOW: because the shape is not confirmed, every
 * extraction is written DEFENSIVELY — several plausible field-name
 * candidates are tried, in order, for cost and for token/context usage (see
 * COST_PATHS / USED_TOKEN_PATHS / MAX_TOKEN_PATHS / RESERVE_TOKEN_PATHS),
 * and the renderer degrades to rendering only what is actually present,
 * per FR-13.5's fail-open contract. Per this slice's own instructions: if NO
 * token-usage field is found under any candidate name, the context-bar
 * segment degrades to an explicit "ctx: unknown" marker rather than a
 * fabricated bar — this is FR-13.5 operating as designed, not a defect.
 *
 * The autocompact-reserve term is handled the same way. If stdin exposes one
 * of the RESERVE_TOKEN_PATHS candidates, it is used; if not, the formula
 * below falls back to a reserve of 0 rather than inventing a numeric
 * constant to stand in for it. That fallback is recorded here, not smoothed
 * over: a reserve of 0 does NOT mean this renderer has confirmed there is no
 * reserve — it means no reserve field could be found, which is a different,
 * weaker claim. The arithmetic itself (FR-13.3) — subtracting the reserve
 * from BOTH the numerator and the denominator, not the numerator alone — is
 * implemented correctly regardless of which value (found, or the 0
 * fallback) ends up in that slot; see renderContextBar() below.
 * ===========================================================================
 */

var fs = require('fs');
var path = require('path');

// ---------------------------------------------------------------------------
// Candidate stdin field-name lists (see the FR-13.4 spike finding above).
// Each list is tried in order; the first path that resolves to a finite
// number wins. Every entry is a GUESS, not a confirmed shape.
// ---------------------------------------------------------------------------
var COST_PATHS = [
  'cost.total_cost_usd',
  'cost_usd',
  'total_cost_usd',
  'costUSD',
  'cost',
];

var USED_TOKEN_PATHS = [
  'context.used_tokens',
  'token_usage.used_tokens',
  'context_window.used_tokens',
  'usage.used_tokens',
  'tokens.used',
  'used_tokens',
];

var MAX_TOKEN_PATHS = [
  'context.max_tokens',
  'token_usage.max_tokens',
  'context_window.max_tokens',
  'model.context_window',
  'tokens.max',
  'max_tokens',
];

var RESERVE_TOKEN_PATHS = [
  'context.autocompact_reserve_tokens',
  'context.autocompact_reserve',
  'token_usage.autocompact_reserve_tokens',
  'autocompact_reserve_tokens',
  'autocompact_reserve',
];

var MAX_SCRATCHPAD_BYTES = 256 * 1024;
var MAX_LINE = 500;
var MAX_FEATURE_LEN = 200;
var BAR_WIDTH = 10;

/** Reads stdin synchronously (fd 0). Returns '' on any failure — e.g. no
 * piped input, an unreadable fd, or a platform that can't do this sync. */
function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (err) {
    return '';
  }
}

/** Navigates a dotted path ('a.b.c') through a plain object. Returns
 * undefined on any missing/non-object segment, never throws. */
function getPath(obj, dotted) {
  if (!obj || typeof obj !== 'object') return undefined;
  var parts = dotted.split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i += 1) {
    if (cur === null || typeof cur !== 'object' || !(parts[i] in cur)) return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

/** First candidate path that resolves to a finite number, else undefined. */
function firstNumber(obj, candidatePaths) {
  for (var i = 0; i < candidatePaths.length; i += 1) {
    var v = getPath(obj, candidatePaths[i]);
    if (typeof v === 'number' && isFinite(v)) return v;
  }
  return undefined;
}

/** Strips control characters and caps length. Scratchpad content is
 * project-supplied (untrusted) input — the same posture hooks/handlers/
 * session-start-spine.js takes for the identical file. */
function sanitizeText(s, maxLen) {
  if (typeof s !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  var cleaned = s.replace(/[\x00-\x1f\x7f]/g, '').trim();
  if (cleaned.length > maxLen) cleaned = cleaned.slice(0, maxLen);
  return cleaned;
}

/** Reads a capped prefix of `.claude/scratchpad.md` under `cwd`. Returns
 * null when absent, a symlink, unreadable, or not a regular file — never
 * throws. Mirrors hooks/handlers/session-start-spine.js's own posture
 * toward the same file (a hostile repo can commit a symlinked scratchpad
 * pointing outside the project). */
function readScratchpad(cwd) {
  var file = path.join(cwd, '.claude', 'scratchpad.md');
  var stat;
  try {
    stat = fs.lstatSync(file);
  } catch (err) {
    return null;
  }
  if (stat.isSymbolicLink() || !stat.isFile()) return null;
  try {
    var fd = fs.openSync(file, 'r');
    var buf = Buffer.alloc(Math.min(MAX_SCRATCHPAD_BYTES, stat.size));
    var read = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    return buf.slice(0, read).toString('utf8');
  } catch (err) {
    return null;
  }
}

/** `## Feature:` value, or the FR-13.3-mandated default when absent or
 * reading the literal "none active". */
function extractFeature(text) {
  var lines = text.split('\n');
  for (var i = 0; i < lines.length; i += 1) {
    if (lines[i].length > MAX_LINE) continue;
    var m = /^##\s*Feature:\s*(.+)$/.exec(lines[i]);
    if (m) {
      var value = sanitizeText(m[1], MAX_FEATURE_LEN);
      if (!value || /^none active$/i.test(value)) return 'no active feature';
      return value;
    }
  }
  return 'no active feature';
}

/** Lines strictly between `## Plan` and the next `## `-level heading (or
 * EOF). Returns null when no `## Plan` heading exists at all. */
function extractPlanLines(text) {
  var lines = text.split('\n');
  var start = -1;
  for (var i = 0; i < lines.length; i += 1) {
    if (/^##\s+Plan\s*$/.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;
  var end = lines.length;
  for (var j = start; j < lines.length; j += 1) {
    if (/^##\s+\S/.test(lines[j])) {
      end = j;
      break;
    }
  }
  return lines.slice(start, end);
}

/**
 * Wave/slice position, per src/rules/scratchpad.md's format and FR-13.3:
 * finds the first wave (top to bottom) containing a pending (unchecked)
 * slice, and returns that slice's 1-based position WITHIN its own wave
 * plus that wave's total slice count. Returns null when:
 *   - there is no `## Plan` section at all (including the ordinary,
 *     non-escalated fast-tier case, which per FR-3.5 never writes a
 *     scratchpad — this function is keyed on plan absence, never on a
 *     `## Tier:` read, exactly as FR-13.3/UC-17-A1 require);
 *   - the `## Plan` body has no recognisable `### Wave N` / slice-checkbox
 *     structure at all (a legacy "(no active plan)" placeholder, or a
 *     `## Plan` section truncated before any slice line appears);
 *   - every slice in every wave is already DONE (UC-17-A2).
 * Never throws — a corrupted/truncated `## Plan` degrades to null exactly
 * like a legitimately absent one (UC-18-A1), rather than crashing.
 */
function extractWaveSlice(text) {
  var planLines = extractPlanLines(text);
  if (!planLines || planLines.length === 0) return null;

  var waves = [];
  var current = null;
  for (var i = 0; i < planLines.length; i += 1) {
    var line = planLines[i];
    if (line.length > MAX_LINE) continue;
    var w = /^###\s*Wave\s+(\d{1,4})/i.exec(line);
    if (w) {
      var n = parseInt(w[1], 10);
      if (n < 1 || n > 9999) continue;
      current = { num: n, lines: [] };
      waves.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }

  // Legacy/flat plans carry no `### Wave N` heading at all — src/rules/
  // scratchpad.md's documented fallback shape is `### Wave 1 (sequential)`,
  // but even that heading is optional in practice, so treat the whole
  // plan body as one implicit wave when no heading was found.
  if (waves.length === 0) {
    waves.push({ num: 1, lines: planLines });
  }

  for (var k = 0; k < waves.length; k += 1) {
    var pending = [];
    for (var li = 0; li < waves[k].lines.length; li += 1) {
      var wl = waves[k].lines[li];
      if (wl.length > MAX_LINE) continue;
      var sl = /^\s*-\s*\[([ xX])\]\s*(?:\*\*)?Slice\s+\d{1,4}/.exec(wl);
      if (sl) pending.push(sl[1] === ' ');
    }
    if (pending.length === 0) continue; // nothing recognisable in this wave
    var idx = -1;
    for (var si = 0; si < pending.length; si += 1) {
      if (pending[si]) {
        idx = si;
        break;
      }
    }
    if (idx !== -1) {
      return { wave: waves[k].num, slice: idx + 1, total: pending.length };
    }
  }
  return null; // every wave fully DONE, or nothing parseable anywhere
}

/** `Gates: N/9` progress line merge-ready writes/refreshes after each gate
 * reaches a terminal state (skills/merge-ready/SKILL.md), mirroring the
 * existing `Gate 6 attempts: N/3` precedent. Returns null when absent. */
function extractGates(text) {
  var m = /^Gates:\s*(\d{1,2})\/9\b/m.exec(text);
  if (!m) return null;
  var n = parseInt(m[1], 10);
  if (n < 0 || n > 9) return null;
  return n;
}

/** `$<cost>`, or an honest "unknown" marker (still carrying a literal `$`,
 * so a degraded line is never mistaken for a blank one) when no COST_PATHS
 * candidate resolved to a number. */
function formatCost(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '$n/a';
  return '$' + n.toFixed(2);
}

/**
 * FR-13.3's usable-context bar: (max - reserve - used) / (max - reserve),
 * floored at 0 (and capped at 1 — a percentage above 100% is meaningless
 * for a "how much usable budget is left" bar, which the PRD's floor-only
 * wording does not forbid guarding against). The reserve is subtracted from
 * BOTH the numerator and the denominator — not the numerator alone — which
 * is what makes this the "real", reserve-excluded headroom the PRD
 * describes rather than merely apparent headroom against the raw max.
 *
 * Degrades to an explicit "ctx: unknown" marker — never a fabricated bar —
 * when stdin exposes neither a usable-tokens nor a max-tokens candidate
 * (see the FR-13.4 spike finding above: this is the field that spike could
 * not confirm at all).
 */
function renderContextBar(data) {
  var used = firstNumber(data, USED_TOKEN_PATHS);
  var max = firstNumber(data, MAX_TOKEN_PATHS);
  if (used === undefined || max === undefined) return 'ctx: unknown';

  var reserve = firstNumber(data, RESERVE_TOKEN_PATHS);
  if (reserve === undefined) reserve = 0; // no invented constant — see header

  var denom = max - reserve;
  if (denom <= 0) return 'ctx: unknown';

  var pct = (denom - used) / denom;
  if (pct < 0) pct = 0;
  if (pct > 1) pct = 1;

  var filled = Math.round(pct * BAR_WIDTH);
  if (filled < 0) filled = 0;
  if (filled > BAR_WIDTH) filled = BAR_WIDTH;
  var bar = '[' + '#'.repeat(filled) + '-'.repeat(BAR_WIDTH - filled) + ']';
  return bar + ' ' + Math.round(pct * 100) + '%';
}

// STDIN_DATA lives at module scope, populated as early as possible, so that
// the top-level catch below can still derive cost/context from it even if
// something later and unforeseen throws (FR-13.5's "at least the cost and
// usable-context segments it can still derive from its own stdin").
var STDIN_DATA = {};

function main() {
  var raw = readStdinSync();
  try {
    if (raw && raw.trim().length > 0) STDIN_DATA = JSON.parse(raw);
  } catch (err) {
    STDIN_DATA = {};
  }
  if (!STDIN_DATA || typeof STDIN_DATA !== 'object') STDIN_DATA = {};

  var cwd = (typeof STDIN_DATA.cwd === 'string' && STDIN_DATA.cwd) ? STDIN_DATA.cwd : process.cwd();
  var scratchpadText = readScratchpad(cwd);

  var parts = [];
  parts.push(scratchpadText ? extractFeature(scratchpadText) : 'no active feature');

  // Wave/slice and gates are omitted entirely — never rendered as a
  // degenerate 0/0 — whenever there is no scratchpad, no `## Plan`, no
  // pending slice left in it, or no `Gates: N/9` line (FR-13.3, UC-17-A1,
  // UC-17-A2, UC-18-A1). This is keyed purely on those absences, never on
  // reading `## Tier: fast` — that state never exists (FR-3.5).
  if (scratchpadText) {
    var ws = extractWaveSlice(scratchpadText);
    if (ws) parts.push('wave ' + ws.wave + ' slice ' + ws.slice + '/' + ws.total);

    var gates = extractGates(scratchpadText);
    if (gates !== null) parts.push('gates ' + gates + '/9');
  }

  parts.push(formatCost(firstNumber(STDIN_DATA, COST_PATHS)));
  parts.push(renderContextBar(STDIN_DATA));

  process.stdout.write(parts.join(' | ') + '\n');
}

try {
  main();
} catch (err) {
  // FR-13.5's own fail-open-by-analogy contract, this feature's own
  // requirement (not inherited from the hook system's — NFR-4 says a
  // statusline is not a hook). Whatever failed above, still emit a minimal,
  // non-empty line carrying whatever can still be derived from stdin, so a
  // crashed statusline is never visually indistinguishable from one that
  // was simply never configured (UC-18).
  var fallback = [];
  try {
    fallback.push(formatCost(firstNumber(STDIN_DATA, COST_PATHS)));
  } catch (e1) {
    fallback.push('$n/a');
  }
  try {
    fallback.push(renderContextBar(STDIN_DATA));
  } catch (e2) {
    fallback.push('ctx: unknown');
  }
  try {
    process.stdout.write(fallback.join(' | ') + '\n');
  } catch (writeErr) {
    // Nothing left to degrade to — stdout itself is unusable.
  }
}
