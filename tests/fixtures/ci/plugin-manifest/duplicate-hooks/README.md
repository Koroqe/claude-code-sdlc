# Fixture: the conventional hooks file declared explicitly

A complete, otherwise-valid plugin whose single defect is `"hooks":
"./hooks/hooks.json"` in `plugin.json`.

Claude Code loads `hooks/hooks.json` by convention. Naming it as well is not
harmless duplication — on 2.1.237 it is a hard failure:

    Status: ✘ failed to load
    Error: Hook load failed: Duplicate hooks file detected: ./hooks/hooks.json
           resolves to already-loaded file .../hooks/hooks.json.

The whole plugin fails. Every agent, skill and hook becomes unreachable, for
declaring by path what is discovered by convention — the identical mistake that
`agents: "./agents/"` once made, one key over. It shipped in 4.0.0–4.3.0 and was
found only by upgrading the CLI and running `claude plugin list`.

The hooks file itself EXISTS here on purpose, so this fixture isolates the
"declared the conventional file" assertion rather than tripping the separate
"named a path that is not on disk" one.
