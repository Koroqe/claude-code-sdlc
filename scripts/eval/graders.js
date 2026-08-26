'use strict';

/**
 * Deterministic graders for behavioural eval cases.
 *
 * Split from the runner on purpose: everything here is a PURE function over an
 * already-captured transcript, so the grading logic itself can be unit-tested
 * for free (tests/hooks/test-eval-graders.js) without spending a single model
 * call. The expensive half — actually running `claude -p` — lives in
 * run-evals.js and is opt-in.
 *
 * Why deterministic only: an LLM judge would make the suite both costly and
 * flaky, and the behaviours worth pinning here (does Triage state a tier? does
 * it pick the right one? did it edit before deciding?) are all exactly
 * expressible as regex/tool assertions. A grader that cannot fail is not
 * evidence, so every grader type below has a seeded-failure test.
 */

/**
 * Parse a `claude -p --output-format stream-json --verbose` capture.
 * Tolerates non-JSON noise lines: a malformed line is skipped, never fatal.
 */
function parseStream(raw) {
  const out = {
    assistantText: '',   // every assistant text block, concatenated
    finalText: '',       // the run's result text (last word)
    toolUses: [],        // [{ name, input }]
    lines: 0,
    malformed: 0,
  };
  for (const line of String(raw == null ? '' : raw).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed[0] !== '{') continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch (err) {
      out.malformed += 1;
      continue;
    }
    out.lines += 1;
    if (obj.type === 'assistant' && obj.message && Array.isArray(obj.message.content)) {
      for (const block of obj.message.content) {
        if (!block || typeof block !== 'object') continue;
        if (block.type === 'text' && typeof block.text === 'string') {
          out.assistantText += block.text + '\n';
        } else if (block.type === 'tool_use' && typeof block.name === 'string') {
          out.toolUses.push({ name: block.name, input: block.input || {} });
        }
      }
    } else if (obj.type === 'result' && typeof obj.result === 'string') {
      out.finalText = obj.result;
    }
  }
  return out;
}

function targetText(parsed, target) {
  if (target === 'final') return parsed.finalText;
  if (target === 'tools') return JSON.stringify(parsed.toolUses);
  return parsed.assistantText + '\n' + parsed.finalText; // default: everything the model said
}

/** One grader → { name, pass, detail }. Never throws on bad grader config. */
function runGrader(grader, parsed, filesWritten) {
  const name = grader && grader.name ? grader.name : (grader && grader.type) || 'unnamed';
  try {
    if (!grader || typeof grader !== 'object') {
      return { name, pass: false, detail: 'grader is not an object' };
    }
    switch (grader.type) {
      case 'regex': {
        const re = new RegExp(grader.pattern, grader.flags || 'i');
        const hay = targetText(parsed, grader.target);
        const found = re.test(hay);
        const want = grader.match === 'not_contains' ? false : true;
        return {
          name,
          pass: found === want,
          detail: (want ? 'expected' : 'expected NO') + ' /' + grader.pattern + '/ — ' +
            (found ? 'found' : 'absent'),
        };
      }
      case 'tool_used': {
        // `max: 0` is the idiom for "this tool must NOT be used". Defaulting
        // min to 1 made that unsatisfiable — it asked for "1..0" and every such
        // grader failed no matter what the agent did, which reads exactly like
        // a real finding. Measured 2026-08-25: two eval cases reported a
        // confident 0/3 purely from this. When a max is given and no min is,
        // the floor is 0.
        const hasMax = typeof grader.max === 'number';
        const min = typeof grader.min === 'number' ? grader.min : (hasMax ? 0 : 1);
        const max = hasMax ? grader.max : Infinity;
        // `tool` is an anchored alternation, not a bare string: a rule about
        // "do not write that file" has to cover Write AND Edit in one grader,
        // because a run that is denied Write will often reach for Edit.
        let toolRe = null;
        try { toolRe = new RegExp('^(?:' + grader.tool + ')$'); } catch (err) {
          return { name, pass: false, detail: 'bad tool pattern: ' + String(grader.tool) };
        }
        const matches = parsed.toolUses.filter((t) => {
          if (!toolRe.test(t.name)) return false;
          if (!grader.input_match) return true;
          try {
            return new RegExp(grader.input_match, 'i').test(JSON.stringify(t.input));
          } catch (err) {
            return false;
          }
        });
        const n = matches.length;
        return {
          name,
          pass: n >= min && n <= max,
          detail: grader.tool + ' used ' + n + ' time(s), wanted ' +
            min + '..' + (max === Infinity ? '∞' : max),
        };
      }
      case 'no_edits': {
        const editors = parsed.toolUses.filter(
          (t) => t.name === 'Edit' || t.name === 'Write' || t.name === 'NotebookEdit'
        );
        return {
          name,
          pass: editors.length === 0,
          detail: editors.length === 0
            ? 'no file-mutating tool used'
            : 'mutated via ' + editors.map((e) => e.name).join(',') + ' — a decision was expected first',
        };
      }
      case 'file_written': {
        const re = new RegExp(grader.pattern, 'i');
        const hit = (filesWritten || []).some((f) => re.test(f));
        const want = grader.match === 'not_contains' ? false : true;
        return {
          name,
          pass: hit === want,
          detail: (want ? 'expected' : 'expected NO') + ' file matching /' + grader.pattern +
            '/ — ' + (hit ? 'found' : 'absent'),
        };
      }
      // A rule that a harness can satisfy in more than one legitimate way must be
      // graded that way, or the eval measures the path rather than the rule.
      // Measured 2026-08-26: the full-tier branch of src/claude.md mandates the
      // Phase 1 DELIVERABLES (docs/PRD.md, docs/use-cases/*) and names the agents
      // that produce them -- it never mandates a literal Skill invocation. A run
      // that wrote both documents inline, because the headless eval environment
      // has no Agent tool available, was scored as a routing failure by a grader
      // pinned to the Skill tool. The run had complied; the grader had not read
      // the rule. `any_of` passes when ANY sub-grader passes.
      case 'any_of': {
        const subs = (Array.isArray(grader.graders) ? grader.graders : [])
          .map((g) => runGrader(g, parsed, filesWritten));
        if (subs.length === 0) {
          return { name, pass: false, detail: 'any_of with no sub-graders never passes' };
        }
        const hit = subs.find((r) => r.pass);
        return {
          name,
          pass: Boolean(hit),
          detail: hit
            ? 'satisfied by: ' + hit.name
            : 'no alternative satisfied — ' + subs.map((r) => r.name + ' (' + r.detail + ')').join('; '),
        };
      }
      default:
        return { name, pass: false, detail: 'unknown grader type: ' + String(grader.type) };
    }
  } catch (err) {
    // A grader that throws must FAIL loudly, never silently pass.
    return { name, pass: false, detail: 'grader error: ' + (err && err.message) };
  }
}

/**
 * Why a failing grader gets a second look before it is believed.
 *
 * Nine of this suite's failures have been grader defects rather than harness
 * findings, and they cluster into three shapes that are mechanically detectable:
 *
 *   1. The pattern was too strict for how the model formats prose. `tier:\s*full`
 *      missed `` tier: `full` `` — a fully compliant statement — because `\s`
 *      does not span a backtick.
 *   2. The rule was satisfiable by a sibling tool. A grader wanting `Write` sees
 *      zero uses because the run reached for `Edit`.
 *   3. The effect was blocked while the attempt was correct. Headless `-p`
 *      denies writes on some runs, so a file the agent genuinely tried to create
 *      never appears on disk.
 *
 * Each of those reads exactly like a real behavioural finding in the output. So
 * when a grader fails, retry it under a relaxation and, if the relaxed form
 * passes, say so loudly. This does NOT change the verdict — a failing grader
 * still fails, because silently widening a rule to make it green is how an eval
 * stops being evidence. It only annotates the failure with the reason it is most
 * likely to be the instrument's fault.
 */
function diagnose(grader, parsed, filesWritten) {
  if (!grader || typeof grader !== 'object') return null;
  try {
    if (grader.type === 'regex' && grader.match !== 'not_contains') {
      const hay = targetText(parsed, grader.target);
      // Strip markdown emphasis and collapse whitespace, then retest unchanged.
      const relaxed = String(hay).replace(/[`*_~]/g, '').replace(/\s+/g, ' ');
      if (new RegExp(grader.pattern, grader.flags || 'i').test(relaxed)) {
        return 'NEAR MISS — matches once markdown emphasis is stripped. The run probably complied ' +
          'and the pattern is too strict; widen it (e.g. `tier:[`*_\\s]*full`) rather than filing this.';
      }
    }
    if (grader.type === 'tool_used' && grader.input_match) {
      const others = parsed.toolUses.filter((t) => {
        try { return new RegExp(grader.input_match, 'i').test(JSON.stringify(t.input)); }
        catch (err) { return false; }
      });
      const wanted = new RegExp('^(?:' + grader.tool + ')$');
      const siblings = [...new Set(others.filter((t) => !wanted.test(t.name)).map((t) => t.name))];
      const min = typeof grader.min === 'number' ? grader.min : (typeof grader.max === 'number' ? 0 : 1);
      if (min >= 1 && siblings.length) {
        return 'NEAR MISS — a different tool matched the same input: ' + siblings.join(', ') +
          '. If either tool satisfies the rule, widen `tool` to an alternation.';
      }
    }
    if (grader.type === 'file_written' && grader.match !== 'not_contains') {
      const re = new RegExp(grader.pattern, 'i');
      const attempted = parsed.toolUses.some((t) =>
        /^(Write|Edit|NotebookEdit)$/.test(t.name) && re.test(JSON.stringify(t.input)));
      if (attempted) {
        return 'NEAR MISS — the write was ATTEMPTED but no file appeared. Headless `-p` denies writes ' +
          'to the sandbox on some runs; grade the attempt, not the effect.';
      }
    }
  } catch (err) { return null; }
  return null;
}

/** Grade a whole case. Returns { pass, graders: [...] }. */
function gradeCase(spec, parsed, filesWritten) {
  const graders = (spec && Array.isArray(spec.graders) ? spec.graders : [])
    .map((g) => {
      const res = runGrader(g, parsed, filesWritten);
      if (!res.pass) {
        const hint = diagnose(g, parsed, filesWritten);
        if (hint) res.diagnosis = hint;
      }
      return res;
    });
  return { pass: graders.length > 0 && graders.every((g) => g.pass), graders };
}

module.exports = { parseStream, runGrader, gradeCase, targetText, diagnose };
