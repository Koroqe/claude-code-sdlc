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
        const min = typeof grader.min === 'number' ? grader.min : 1;
        const max = typeof grader.max === 'number' ? grader.max : Infinity;
        const matches = parsed.toolUses.filter((t) => {
          if (t.name !== grader.tool) return false;
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
      default:
        return { name, pass: false, detail: 'unknown grader type: ' + String(grader.type) };
    }
  } catch (err) {
    // A grader that throws must FAIL loudly, never silently pass.
    return { name, pass: false, detail: 'grader error: ' + (err && err.message) };
  }
}

/** Grade a whole case. Returns { pass, graders: [...] }. */
function gradeCase(spec, parsed, filesWritten) {
  const graders = (spec && Array.isArray(spec.graders) ? spec.graders : [])
    .map((g) => runGrader(g, parsed, filesWritten));
  return { pass: graders.length > 0 && graders.every((g) => g.pass), graders };
}

module.exports = { parseStream, runGrader, gradeCase, targetText };
