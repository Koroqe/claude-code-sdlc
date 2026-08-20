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
 * DELIBERATELY NARROW — BLOCKING IS, ATTRIBUTION IS NOT
 *
 * It blocks one thing: a MERGE READY verdict in a session where no subagent
 * ever ran. `/merge-ready` delegates code review, security audit, build, E2E,
 * verification and doc accuracy to six different agents — zero subagent
 * invocations is not a borderline reading of that, it is proof the gates were
 * narrated rather than run.
 *
 * It deliberately does NOT block on WHICH agents ran. On 2.1.237,
 * `SubagentStop` DOES carry `agent_type` (measured —
 * docs/findings/remeasurement-2.1.237.md §3; it was absent in the 2.1.9
 * capture, docs/findings/subagent-stop-payload.md), and
 * `subagent:stop:wave-record` records it when it passes that hook's field
 * bound. That makes per-agent attribution possible — but only as an ADVISORY
 * systemMessage on the allow path, never as a decision input. Wave-records
 * are files written on the model's side of the run: a self-report, exactly
 * the source the paragraph above rules out for blocking. So the principle
 * stands — the evidence is the transcript, not a file the model writes — and
 * a wave-record can only ADD a message: which gate agents left a same-session
 * record ("observed") and which did not ("no same-session wave-record found
 * for: ...", deliberately never "did not run"). Guessing per-agent facts into
 * a refusal would produce false blocks on honest runs, and a guard that fires
 * wrongly on correct work gets disabled, and then it protects nothing. One
 * unambiguous assertion is worth more than five fuzzy ones.
 *
 * FR-5.3's "transcript where possible" clause, resolved: the session
 * transcript's sidechain records carry no measured agent-type field, so
 * transcript-sourced TYPE attribution is not implementable without unmeasured
 * assumptions. The transcript remains the sole source of the DECISION signal
 * (sawSubagent — FR-5.7's actual requirement); wave-records are the only
 * source of the advisory type names.
 *
 * The enrichment is session-filtered and bounded: a record contributes only
 * when its own non-empty session_id strictly equals the Stop payload's
 * (measured on 2.1.237: Stop and SubagentStop share one session_id UUID per
 * session — remeasurement-2.1.237.md §5; records from prior features are
 * thereby ignored, never reported as observed). The scan is capped at
 * MAX_RECORD_FILES entries — MORE than that and enrichment is skipped
 * entirely, because a truncated scan must never name a genuinely-ran agent as
 * not-observed — and each file is stat-gated at MAX_RECORD_BYTES before any
 * read. Nothing record-derived ever reaches the output: only the four fixed
 * allowlist literals appear. Enrichment runs strictly AFTER every decision
 * guard and fails open to "no message" — no filesystem access can precede or
 * perturb the deny.
 *
 * Recovery, per the autonomy contract: the refusal names the remedy — run the
 * gates — and carries `SDLC_ALLOW_UNEVIDENCED_GATES=1` for the legitimate
 * cases (a resumed session whose gates ran in an earlier one, a tier that
 * skipped them by design). It can never dead-end a run.
 */

const fs = require('fs');
const path = require('path');

const ESCAPE = 'SDLC_ALLOW_UNEVIDENCED_GATES';
const MAX_BYTES = 8 * 1024 * 1024;

/** The only names that may ever appear in the advisory message. */
const GATE_AGENTS = ['code-reviewer', 'security-auditor', 'build-runner', 'verifier'];
const MAX_RECORD_FILES = 64;
const MAX_RECORD_BYTES = 64 * 1024;
const MAX_MESSAGE = 400;
const hasOwn = Object.prototype.hasOwnProperty;

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

/**
 * Map a record's agent_type onto the fixed allowlist, or null. At most ONE
 * leading `<prefix>:` plugin prefix is stripped, then the remainder must be
 * strictly `===` one of the four literals — never startsWith/includes/RegExp
 * over record content, so nothing hostile can partial-match its way in.
 */
function gateAgentName(value) {
  if (typeof value !== 'string') return null;
  const colon = value.indexOf(':');
  const name = colon === -1 ? value : value.slice(colon + 1);
  for (const literal of GATE_AGENTS) {
    if (name === literal) return literal;
  }
  return null;
}

/**
 * Advisory attribution from same-session wave-records. Returns
 * `{ systemMessage }` or null — NEVER a deny, and it is only ever invoked
 * from the sawSubagent === true branch, after every decision guard, so no
 * filesystem access here can precede or perturb the blocking decision. The
 * whole body fails open to null.
 */
function attribution(input) {
  try {
    // Precondition: a non-empty session_id on the Stop payload. Without it
    // the staleness filter cannot hold (undefined === undefined must never
    // admit a record), so enrichment is skipped entirely.
    const sessionId = input && hasOwn.call(input, 'session_id') ? input.session_id : undefined;
    if (typeof sessionId !== 'string' || !sessionId) return null;
    const cwd = input && hasOwn.call(input, 'cwd') ? input.cwd : undefined;
    if (typeof cwd !== 'string' || !cwd) return null;

    // Lazy require: a missing/broken lib module must degrade to "no message",
    // never take the handler — and its deny — down with it at load time.
    const { pathIsSafe } = require('../lib/accumulator');
    if (!pathIsSafe(cwd)) return null;

    // pathIsSafe covers .claude and .claude/tmp, not this subpath — so the
    // directory and every candidate file get their own lstat checks here.
    const dir = path.join(cwd, '.claude', 'debug', 'wave-results');
    const dirStat = fs.lstatSync(dir); // absent throws -> catch -> null
    if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) return null;

    const entries = fs.readdirSync(dir);
    // Over the cap: skip ENTIRELY, message and all. A truncated scan must
    // never name a genuinely-ran agent as not-observed — "could not look"
    // is not "looked and it was fine".
    if (entries.length > MAX_RECORD_FILES) return null;

    const observed = Object.create(null);
    for (const entry of entries) {
      let record;
      try {
        const file = path.join(dir, entry);
        const stat = fs.lstatSync(file);
        if (stat.isSymbolicLink() || !stat.isFile()) continue;
        if (stat.size > MAX_RECORD_BYTES) continue; // stat-gated, never read-then-truncate
        record = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (err) {
        continue; // unreadable or malformed: this record simply does not count
      }
      if (!record || typeof record !== 'object' || Array.isArray(record)) continue;

      // Own-property reads only; the record is never spread or assigned.
      const recSession = hasOwn.call(record, 'session_id') ? record.session_id : undefined;
      if (typeof recSession !== 'string' || !recSession || recSession !== sessionId) continue;
      const name = gateAgentName(hasOwn.call(record, 'agent_type') ? record.agent_type : undefined);
      if (name) observed[name] = true;
    }

    // Built EXCLUSIVELY from fixed literals — no record-derived value, no
    // counts, no filenames — and hard-capped even though every input is ours.
    const seen = GATE_AGENTS.filter((n) => observed[n] === true);
    const missing = GATE_AGENTS.filter((n) => observed[n] !== true);
    const message =
      'advisory: gate evidence observed: ' + (seen.length ? seen.join(', ') : 'none') +
      ' — no same-session wave-record found for: ' + (missing.length ? missing.join(', ') : 'none') +
      '. Wave-records are self-reports; the blocking decision comes from the transcript and is unchanged.';
    return { systemMessage: message.slice(0, MAX_MESSAGE) };
  } catch (err) {
    return null; // any enrichment failure: the handler answers as it always did
  }
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
  if (sawSubagent) return attribution(input);

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
