# Tool Limitation Awareness

Claude Code's tools have silent truncation behaviors. These rules prevent you from working with incomplete data.

## File Reading (2,000-Line Cap)

- The Read tool returns at most 2,000 lines per call
- For files over 500 lines: use `offset` and `limit` parameters to read in sequential chunks
- NEVER assume a single read captured the entire file unless you confirmed the total line count is under 500
- If the last line number in a read result is a round number (2000): there is more content — read the next chunk
- For code review and security audit: check file length before reading; if over 500 lines, read in sections

## Search and Command Output Truncation

- Grep results and Bash output exceeding ~50,000 characters are silently truncated to a short preview
- The agent receives the preview and does NOT know results were cut — it will report incomplete findings as complete
- When `git diff` output is large: diff individual files or directories rather than the entire branch
- When grep returns suspiciously few results: re-run with narrower scope (single directory, stricter glob) to verify completeness
- If any search seems to return fewer results than expected: state that truncation may have occurred and re-run with tighter filters

## Grep is Text Matching, Not an AST

- Grep finds text patterns — it has no understanding of code semantics
- It cannot distinguish a function call from a comment, or identical names from different modules
- When renaming or changing any function, type, variable, or file, you MUST search separately for:
  1. Direct calls and references (whole-word match)
  2. Type-level references (interfaces, generics, type annotations)
  3. String literals containing the name (error messages, logging, dynamic references)
  4. Dynamic imports and `require()` calls
  5. Re-exports and barrel/index file entries
  6. Test files and mocks that reference the symbol
  7. Configuration files (tsconfig paths, webpack aliases, package.json scripts)
- After all renames: run the project's typecheck command — type errors reveal missed references
- Do NOT assume a single grep caught everything
