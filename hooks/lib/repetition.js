'use strict';

/**
 * Repetition detection over a subagent's tool calls.
 *
 * WHY. Step repetition — an agent redoing work it has already done — is the
 * single largest measured failure mode in multi-agent systems: 17.14% of all
 * failures across 7 frameworks and 1,600+ annotated traces (MAST,
 * arXiv:2503.13657; see `docs/findings/harness-optimization-research.md` §4).
 * It is also the cheapest pathology to spot mechanically, because a loop is
 * exactly identical by construction while progress is not.
 *
 * WHY IT LIVES IN lib/. `tests/hooks/test-guards-cross.js` pins the handler
 * count at twelve — the asset ceiling — by counting `.js` files under
 * `hooks/handlers/`. A module here costs nothing against that, so detection
 * can be added without spending the last hook slot on it.
 *
 * THE CRAFT IS IN THE NORMALISATION, not the counting. OpenHands' StuckDetector
 * compares command/exit-code pairs while deliberately ignoring PIDs, because
 * two runs of the same command are "identical" in every way that matters and
 * differ in ways that do not. Compare raw text and a real loop never matches;
 * normalise too aggressively and honest iteration looks like a loop. The
 * normaliser below strips only what cannot carry intent: absolute temp paths,
 * hex ids, timestamps and whitespace.
 *
 * Advisory only. Nothing here blocks, denies, or fails a run — it annotates a
 * record the orchestrator already reads when folding a wave.
 */

const MAX_SIGNATURE = 300;

/** Collapse the incidental so two genuinely-identical calls compare equal. */
function normalizeInput(value) {
  let s;
  try {
    s = typeof value === 'string' ? value : JSON.stringify(value);
  } catch (err) {
    return '';           // circular or unserialisable — treat as no signature
  }
  if (typeof s !== 'string') return '';
  return s
    .replace(/\/(?:private\/)?(?:tmp|var\/folders)\/[^"\s,}]+/g, '<tmp>')
    .replace(/\b[0-9a-f]{7,40}\b/gi, '<hex>')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '<ts>')
    // JSON.stringify escapes newlines/tabs as the two characters \ and n, so a
    // bare \s+ never sees them and a reflowed command would read as a new call.
    .replace(/\\[nrt]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SIGNATURE);
}

/** A stable signature for one tool call. */
function signature(name, input) {
  return String(name || 'unknown') + '|' + normalizeInput(input || {});
}

/**
 * Summarise repetition across an ordered list of {name, input} tool calls.
 *
 * Returns { distinct, repeated: [{signature, count}], maxRepeat, longestRun }.
 * `longestRun` is consecutive identical calls — the sharpest loop signal, since
 * revisiting a file later is normal work while calling it five times in a row
 * is not.
 */
function analyse(toolCalls, options) {
  const opts = options || {};
  const minRepeat = typeof opts.minRepeat === 'number' ? opts.minRepeat : 3;
  const counts = Object.create(null);
  let longestRun = 1;
  let run = 1;
  let prev = null;

  const calls = Array.isArray(toolCalls) ? toolCalls : [];
  for (const call of calls) {
    if (!call || typeof call !== 'object') continue;
    const sig = signature(call.name, call.input);
    counts[sig] = (counts[sig] || 0) + 1;
    if (prev !== null && sig === prev) {
      run += 1;
      if (run > longestRun) longestRun = run;
    } else {
      run = 1;
    }
    prev = sig;
  }

  const repeated = Object.keys(counts)
    .filter((sig) => counts[sig] >= minRepeat)
    .map((sig) => ({ signature: sig, count: counts[sig] }))
    .sort((a, b) => b.count - a.count);

  const maxRepeat = repeated.length ? repeated[0].count : (calls.length ? 1 : 0);
  return {
    distinct: Object.keys(counts).length,
    repeated,
    maxRepeat,
    longestRun: calls.length ? longestRun : 0,
  };
}

module.exports = { analyse, signature, normalizeInput, MAX_SIGNATURE };
