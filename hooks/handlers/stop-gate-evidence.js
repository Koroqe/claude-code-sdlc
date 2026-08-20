'use strict';

/**
 * `stop:gate-evidence` — Stop.
 *
 * Closes the structural gap every other guard in this harness leaves open.
 *
 * Every other mechanical check here fires on an ACTION: the git guard on an
 * attempted commit, the read guard on an attempted edit, the changelog guard
 * on a changed file. None of them can fire on a step that was SKIPPED,
 * because an omission produces no tool call to intercept.
 *
 * So the most expensive failure mode in an unattended run stays invisible: a
 * run that reports `Gate 3: Security Audit — PASS` having never invoked
 * `security-auditor`, and closes with MERGE READY. Nothing is red. The guards
 * are all satisfied, because they only police calls that were made.
 *
 * This hook polices the claim instead of the call.
 *
 * EVIDENCE, NOT A CHECKBOX
 *
 * The evidence is the session transcript itself, not a file the model writes.
 * That distinction is the whole design: anything the model records about its
 * own work is another self-report, and a self-report is exactly the wrong
 * source for "did I actually do this". Transcript records carry
 * `isSidechain: true` when they belong to a subagent, so subagent invocation
 * is observable as a byproduct of it happening, and is not forgeable by
 * claiming harder.
 *
 * DELIBERATELY NARROW
 *
 * It blocks one thing: a MERGE READY verdict in a session where no subagent
 * ever ran. `/merge-ready` delegates code review, security audit, build, E2E,
 * verification and doc accuracy to six different agents — zero subagent
 * invocations is not a borderline reading of that, it is proof the gates were
 * narrated rather than run.
 *
 * It deliberately does NOT try to match individual `Gate N: PASS` lines
 * against individual agents. `SubagentStop` carries no `agent_type`
 * (measured — see docs/findings/subagent-stop-payload.md), so which agent ran
 * cannot be established from the payload, and guessing from transcript
 * content would produce false blocks on honest runs. A guard that fires
 * wrongly on correct work gets disabled, and then it protects nothing. One
 * unambiguous assertion is worth more than five fuzzy ones.
 *
 * Recovery, per the autonomy contract: the refusal names the remedy — run the
 * gates — and carries `SDLC_ALLOW_UNEVIDENCED_GATES=1` for the legitimate
 * cases (a resumed session whose gates ran in an earlier one, a tier that
 * skipped them by design). It can never dead-end a run.
 */

const fs = require('fs');

const ESCAPE = 'SDLC_ALLOW_UNEVIDENCED_GATES';
const MAX_BYTES = 8 * 1024 * 1024;

/** The verdict this hook is willing to have an opinion about. */
const VERDICT_RE = /\bMERGE\s+READY\b/i;

/**
 * Wordings that mention the verdict without asserting it. Without these, any
 * discussion of the pipeline — including this file's own documentation — trips
 * the guard.
 */
const NOT_A_CLAIM = [
  /\bNOT\s+MERGE\s+READY\b/i,
  /\bnot\s+yet\s+merge\s+ready\b/i,
];

function readTail(file, maxBytes) {
  try {
    const stat = fs.statSync(file);
    const size = stat.size;
    const start = size > maxBytes ? size - maxBytes : 0;
    const fd = fs.openSync(file, 'r');
    try {
      const length = size - start;
      const buf = Buffer.alloc(length);
      fs.readSync(fd, buf, 0, length, start);
      return buf.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch (err) {
    return null;
  }
}

/**
 * Walk the transcript once, collecting the two facts this hook needs:
 * whether any subagent ran, and what the main loop last said.
 */
function scan(text) {
  const result = { sawSubagent: false, lastMainText: '' };
  const lines = text.split('\n');

  for (const line of lines) {
    if (!line || line.charCodeAt(0) !== 123 /* { */) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (err) {
      // A truncated final line is normal when reading a tail. Skip it.
      continue;
    }
    if (!record || record.type !== 'assistant') continue;

    if (record.isSidechain === true) {
      result.sawSubagent = true;
      continue;
    }

    const content = record.message && record.message.content;
    if (!Array.isArray(content)) continue;
    const text_ = content
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n');
    if (text_.trim()) result.lastMainText = text_;
  }

  return result;
}

module.exports = function stopGateEvidence(input) {
  if (process.env[ESCAPE] === '1') return null;

  const transcript = input && input.transcript_path;
  if (!transcript || typeof transcript !== 'string') return null;

  const text = readTail(transcript, MAX_BYTES);
  // Cannot read the transcript means cannot establish anything. "I could not
  // look" must never be reported as "I looked and it was fine", but it must
  // equally never block — this hook accuses, so it has to be certain.
  if (text === null) return null;

  const { sawSubagent, lastMainText } = scan(text);
  if (!lastMainText) return null;

  if (!VERDICT_RE.test(lastMainText)) return null;
  if (NOT_A_CLAIM.some((re) => re.test(lastMainText))) return null;

  // The claim is made. Is there any evidence behind it?
  if (sawSubagent) return null;

  // The wrapper owns the single deny channel and shapes it per event — for
  // Stop, into `decision: block`, never `continue: false`, which would end the
  // session rather than force a corrective turn. Returning a decision directly
  // from here would bypass that and be silently dropped.
  return {
    deny: {
      reason:
        'This response reports MERGE READY, but no subagent ran at any point in this session. ' +
        '/merge-ready delegates code review, security audit, build, E2E, goal-backward ' +
        'verification and doc accuracy to separate agents — a run with zero subagent ' +
        'invocations did not execute those gates, it described them. Run the gates before ' +
        'reporting a verdict. If they genuinely ran in an earlier session, or this tier skips ' +
        'them by design, set ' + ESCAPE + '=1 and say which applies. ' +
        '[deviation: rule-1 — run the gates, free]',
    },
  };
};
