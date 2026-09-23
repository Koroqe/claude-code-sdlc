'use strict';

/**
 * Run-to-completion continuation check.
 *
 * Called from `hooks/handlers/stop-gate-evidence.js`, after its (unchanged)
 * MERGE READY evidence check, sharing that hook's single transcript read.
 * See that file's header for why this lives inside `stop:gate-evidence`
 * rather than as a thirteenth hook id, and `docs/PRD.md` Section 16 for the
 * full specification (FR-1 through FR-4).
 *
 * In one sentence: an approved plan that still has a pending slice, or that
 * reached quality-gates without a reported verdict, is not done — so a Stop
 * in an engaged session with no recorded blocker is refused, with the
 * remedy named in the reason, bounded to two refusals in a row on an
 * unchanged key so a run can never be wedged.
 *
 * FAIL-OPEN. `module.exports` wraps its entire body in one try/catch,
 * mirroring `stop-gate-evidence.js`'s own `attribution()` helper: any
 * unexpected failure here yields `null` — no decision — rather than taking
 * the Stop hook down with it.
 */

const fs = require('fs');
const path = require('path');
const scratchpadState = require('./scratchpad-state.js');
const accumulator = require('./accumulator.js');
const gitSafe = require('./git-safe.js');

const ESCAPE = 'SDLC_ALLOW_MIDPLAN_STOP';
const MAX_NO_PROGRESS_BLOCKS = 2;
const COUNTER_SUFFIX = '.cont';
const MAX_COUNTER_BYTES = 512;

/** The verdict this check is willing to treat as "reported, either polarity". */
const VERDICT_RE = /\bMERGE\s+READY\b/i;

const ENGAGEMENT_SKILL_RE = /(^|:)(develop-feature|implement-slice|bootstrap-feature|merge-ready|sdlc-quick)$/;
const ENGAGEMENT_COMMAND_RE = /<command-name>\/?(?:claude-code-sdlc:)?(develop-feature|implement-slice|bootstrap-feature|merge-ready|sdlc-quick)\b/;

const NO_PROGRESS_MESSAGE = 'run-to-completion: no progress since the last 2 continuation ' +
  'requests — letting this turn end to avoid a loop. Record what is blocking under ## Blockers.';
const COUNTER_UNAVAILABLE_MESSAGE =
  'run-to-completion: unable to track continuation attempts — not blocking.';

const TRAILER = 'Stop only if genuinely blocked: write the blocker under ## Blockers and set ' +
  '## Status: blocked (or paused, if the user asked to pause) — that ends the run. Override: ' +
  ESCAPE + '=1. [deviation: rule-1 — continue the plan, free]';

function denyReasonForSlice(sliceNum, sliceTotal) {
  const of = sliceTotal !== undefined ? ' of ' + sliceTotal : '';
  return 'Run-to-completion: the approved plan in .claude/scratchpad.md still has pending work ' +
    '(next: Slice ' + sliceNum + of + '). An approved plan runs to the end without waiting for a ' +
    'human — continue with that slice now (/implement-slice), then the remaining slices and ' +
    '/merge-ready. ' + TRAILER;
}

function denyReasonForGates() {
  return 'Run-to-completion: the scratchpad says quality-gates and no MERGE READY / NOT MERGE ' +
    'READY verdict has been reported — finish /merge-ready and report its verdict. ' + TRAILER;
}

/** The last main-thread (non-sidechain) assistant text block in the transcript. */
function lastMainThreadAssistantText(transcriptText) {
  let last = '';
  const lines = transcriptText.split('\n');
  for (const line of lines) {
    if (!line || line.charCodeAt(0) !== 123 /* { */) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (err) {
      continue; // a truncated tail line is normal; skip it
    }
    if (!record || record.type !== 'assistant' || record.isSidechain === true) continue;
    const content = record.message && record.message.content;
    if (!Array.isArray(content)) continue;
    const text = content
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n');
    if (text.trim()) last = text;
  }
  return last;
}

/**
 * Did THIS session touch the pipeline? A single pass over the transcript,
 * main-thread records only (`isSidechain !== true`): an Edit/Write/MultiEdit
 * of `.claude/scratchpad.md`, a `Skill` call naming one of the pipeline
 * skills, or a user record carrying `<command-name>` for one of them.
 */
function sessionEngaged(transcriptText) {
  if (typeof transcriptText !== 'string' || !transcriptText) return false;
  const lines = transcriptText.split('\n');

  for (const line of lines) {
    if (!line || line.charCodeAt(0) !== 123 /* { */) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (err) {
      continue; // a truncated tail line is normal; skip it
    }
    if (!record || record.isSidechain === true) continue;

    if (record.type === 'assistant') {
      const content = record.message && record.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (!block || block.type !== 'tool_use') continue;
        if (block.name === 'Edit' || block.name === 'Write' || block.name === 'MultiEdit') {
          const fp = block.input && typeof block.input.file_path === 'string' ? block.input.file_path : '';
          if (fp.replace(/\\/g, '/').endsWith('.claude/scratchpad.md')) return true;
        } else if (block.name === 'Skill') {
          const skill = block.input && block.input.skill;
          if (typeof skill === 'string' && ENGAGEMENT_SKILL_RE.test(skill)) return true;
        }
      }
    } else if (record.type === 'user') {
      const content = record.message && record.message.content;
      let text = '';
      if (typeof content === 'string') {
        text = content;
      } else if (Array.isArray(content)) {
        text = content
          .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
          .map((b) => b.text)
          .join('\n');
      }
      if (text && ENGAGEMENT_COMMAND_RE.test(text)) return true;
    }
  }
  return false;
}

function counterPath(root, sessionId) {
  const dir = accumulator.accumulatorDir(root);
  const file = path.resolve(dir, accumulator.sanitizeSessionId(sessionId) + COUNTER_SUFFIX);
  const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
  return file.indexOf(prefix) === 0 ? file : null;
}

/** Returns `{ key, count }` or null when absent, symlinked, oversized or malformed. */
function readCounter(root, sessionId) {
  if (!accumulator.pathIsSafe(root)) return null;
  const file = counterPath(root, sessionId);
  if (!file) return null;
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_COUNTER_BYTES) return null;
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    const key = lines[0];
    const count = parseInt(lines[1], 10);
    if (!key || !Number.isFinite(count)) return null;
    return { key: key, count: count };
  } catch (err) {
    return null;
  }
}

/** Returns false when the counter cannot be persisted. */
function writeCounter(root, sessionId, key, count) {
  if (!accumulator.pathIsSafe(root)) return false;
  const file = counterPath(root, sessionId);
  if (!file) return false;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, key + '\n' + String(count) + '\n', 'utf8');
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * `input` is the Stop hook payload; `transcriptText` is the transcript tail
 * `stop-gate-evidence.js` already read (or null when it could not be read).
 * Returns `null` (no decision), `{ deny: { reason } }`, or `{ systemMessage }`.
 */
module.exports = function continuation(input, transcriptText) {
  try {
    if (process.env[ESCAPE] === '1') return null;

    const event = input && input.hook_event_name;
    if (event !== undefined && event !== 'Stop') return null;

    const cwdRaw = input && input.cwd;
    if (typeof cwdRaw !== 'string' || !cwdRaw) return null;
    const root = path.resolve(cwdRaw);
    if (!accumulator.pathIsSafe(root)) return null;

    const scratchpadText = scratchpadState.readCapped(
      path.join(root, '.claude', 'scratchpad.md'), scratchpadState.MAX_BYTES
    );
    if (scratchpadText === null) return null;

    const state = scratchpadState.extractState(scratchpadText);

    let kind = null;
    let sliceNum;
    let sliceTotal;
    const pending = scratchpadState.firstPendingSlice(scratchpadText);
    if (typeof state.status === 'string' && state.status.indexOf('implementing') === 0 &&
        pending !== undefined) {
      kind = 'slice';
      sliceNum = pending;
      sliceTotal = state.sliceTotal;
    } else if (state.status === 'quality-gates') {
      // Can only conclude "no verdict reported" when there is a transcript to
      // read; an unreadable/empty one cannot prove the negative, so this
      // session is left alone rather than blocked on missing evidence.
      if (typeof transcriptText === 'string' && transcriptText) {
        const lastText = lastMainThreadAssistantText(transcriptText);
        if (!VERDICT_RE.test(lastText)) kind = 'gates';
      }
    }
    if (!kind) return null;

    if (scratchpadState.blockersPresent(scratchpadText)) return null;

    if (!sessionEngaged(transcriptText)) return null;

    const headOut = gitSafe.runGit(root, ['rev-parse', 'HEAD']);
    const head = headOut === gitSafe.UNKNOWN ? 'unknown' : headOut;
    const key = state.status + '|' + (sliceNum || '') + '|' +
      scratchpadState.doneSliceCount(scratchpadText) + '|' + head;

    const sessionId = input && input.session_id;
    const stored = readCounter(root, sessionId);
    const newCount = (stored && stored.key === key) ? stored.count + 1 : 1;

    if (newCount > MAX_NO_PROGRESS_BLOCKS) {
      // Not persisted: a later call with this same stuck key re-reads the
      // last-written { key, count: MAX_NO_PROGRESS_BLOCKS }, recomputes the
      // same newCount, and lands here again — the bound holds without a
      // write on every over-bound call. A call with a different key (real
      // progress) computes newCount = 1 against the stale entry and blocks.
      return { systemMessage: NO_PROGRESS_MESSAGE };
    }

    if (!writeCounter(root, sessionId, key, newCount)) {
      return { systemMessage: COUNTER_UNAVAILABLE_MESSAGE };
    }

    const reason = kind === 'slice' ? denyReasonForSlice(sliceNum, sliceTotal) : denyReasonForGates();
    return { deny: { reason: reason } };
  } catch (err) {
    return null;
  }
};
