//! sdlc-knowledge — local knowledge base CLI for SDLC agents.
//!
//! Wires `clap` argument parsing to the per-subcommand runners
//! (`Ingest`, `Search`, `List`, `Status`, `Delete`). The path-canonicalization
//! security backbone in `cli::resolve_project_root` runs BEFORE any subcommand
//! body so every filesystem-touching subcommand receives a canonical project
//! root (Phase 1.5 Security MUST #3 + #4 + #7).

use clap::Parser;

use sdlc_knowledge::cli::{self, Cli, Command};
use sdlc_knowledge::{encoder, ingest, migrations, output, search, store};

fn main() -> std::process::ExitCode {
    let cli = Cli::parse();

    // Resolve project_root for ALL subcommands BEFORE any subcommand-specific work.
    // This is the load-bearing FS-access gate (Phase 1.5 Security MUST #3 + #4 + #7).
    let project_root_arg = match &cli.command {
        Command::Ingest(a) => a.project_root.as_deref(),
        Command::Search(a) => a.project_root.as_deref(),
        Command::List(a) => a.project_root.as_deref(),
        Command::Status(a) => a.project_root.as_deref(),
        Command::Delete(a) => a.project_root.as_deref(),
        // Warmup does not touch project filesystem — encoder cache is in $HOME.
        // resolve_project_root still runs (to keep the path-canonicalization
        // gate uniform for all subcommands) but the resolved root is unused.
        Command::Warmup(_) => None,
        Command::Compare(a) => a.project_root.as_deref(),
    };

    let root = match cli::resolve_project_root(project_root_arg) {
        Ok(p) => p,
        Err(_) => {
            // Uniform error mapping: every canonicalize failure prints the same
            // literal stderr and exits 2 (Phase 1.5 Security MUST #4 + #6).
            eprintln!("error: project-root must resolve under current working directory");
            return std::process::ExitCode::from(2);
        }
    };

    match cli.command {
        Command::Ingest(args) => run_ingest(&root, &args),
        Command::Search(args) => run_search(&root, &args),
        Command::List(args) => run_list(&root, &args),
        Command::Status(args) => run_status(&root, &args),
        Command::Delete(args) => run_delete(&root, &args),
        Command::Warmup(args) => run_warmup(&args),
        Command::Compare(args) => run_compare(&root, &args),
    }
}

/// `compare <query> [--top-k N] [--max-chars N] [--json]` — A/B test all
/// three search modes side-by-side with FULL chunk text. Surfaces exactly
/// what an LLM would receive as RAG context-augmentation input.
fn run_compare(root: &std::path::Path, args: &cli::CompareArgs) -> std::process::ExitCode {
    let (conn, _db_path) = match open_and_validate(root) {
        Ok(t) => t,
        Err(code) => return code,
    };
    let top_k = args.top_k as u32;

    // Run all three modes. Encoder failures fall back to empty results
    // for that specific mode (NOT to lexical) — the whole point of
    // `compare` is to see what each mode actually produces.
    let lex_hits = match search::search(&conn, &args.query, top_k, 0) {
        Ok(h) => h,
        Err(e) => {
            eprintln!("warning: lexical search failed: {e}");
            Vec::new()
        }
    };
    let (dense_hits, hybrid_hits) = match encoder::encode_query(&args.query) {
        Ok(emb) => {
            let d = search::dense_search(&conn, &emb, top_k).unwrap_or_else(|e| {
                eprintln!("warning: dense search failed: {e}");
                Vec::new()
            });
            let h = search::hybrid_search(&conn, &args.query, &emb, top_k).unwrap_or_else(|e| {
                eprintln!("warning: hybrid search failed: {e}");
                Vec::new()
            });
            (d, h)
        }
        Err(e) => {
            eprintln!(
                "warning: encoder unavailable ({e}); dense + hybrid columns will be empty. \
                 Run `bash install.sh --yes` to install the e5-multilingual-small model."
            );
            (Vec::new(), Vec::new())
        }
    };

    if args.json {
        let value = serde_json::json!({
            "query": &args.query,
            "top_k": args.top_k,
            "context_radius": args.context,
            "modes": {
                "lexical": expand_full_text(&conn, &lex_hits, args.context, args.max_chars),
                "dense": expand_full_text(&conn, &dense_hits, args.context, args.max_chars),
                "hybrid": expand_full_text(&conn, &hybrid_hits, args.context, args.max_chars),
            }
        });
        println!("{}", serde_json::to_string_pretty(&value).unwrap_or_default());
        return std::process::ExitCode::SUCCESS;
    }

    // Human-readable side-by-side: vertical sections per mode with FULL text.
    println!("============================================================");
    println!("QUERY: {}", &args.query);
    println!("TOP-K: {}  CONTEXT: ±{} chunks per hit", args.top_k, args.context);
    println!("============================================================");
    print_compare_section(&conn, "LEXICAL (BM25)", &lex_hits, args.context, args.max_chars);
    print_compare_section(&conn, "DENSE (sqlite-vec)", &dense_hits, args.context, args.max_chars);
    print_compare_section(&conn, "HYBRID (RRF k=60)", &hybrid_hits, args.context, args.max_chars);
    std::process::ExitCode::SUCCESS
}

/// Pretty-print one mode's hits with full chunk text + ±context neighbors
/// fetched from the DB. When `context_radius` > 0, each hit shows ~one
/// page of text instead of just the matched chunk.
fn print_compare_section(
    conn: &rusqlite::Connection,
    label: &str,
    hits: &[search::SearchHit],
    context_radius: usize,
    max_chars: usize,
) {
    println!();
    println!("──── MODE: {label} ────");
    if hits.is_empty() {
        println!("(no results)");
        return;
    }
    for (idx, hit) in hits.iter().enumerate() {
        let basename = std::path::Path::new(&hit.source)
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| hit.source.clone());
        println!();
        println!(
            "[{}] chunk_id={} ord={} score={:.4} source={}",
            idx + 1,
            hit.chunk_id,
            hit.ord,
            hit.score,
            basename
        );
        // Optional component scores when present (hybrid + dense modes).
        if let (Some(b), Some(d), Some(r)) =
            (hit.bm25_score, hit.dense_score, hit.rrf_score)
        {
            println!(
                "    bm25={:.4}  dense={:.4}  rrf={:.4}",
                b, d, r
            );
        }
        let full_text = fetch_chunk_with_context(conn, hit.chunk_id, context_radius)
            .unwrap_or_else(|_| {
                // Fallback to the FTS5 snippet if the lookup fails.
                hit.snippet.clone()
            });
        let char_count = full_text.chars().count();
        let preview = if max_chars > 0 && char_count > max_chars {
            let mut s: String = full_text.chars().take(max_chars).collect();
            s.push_str("…");
            s
        } else {
            full_text
        };
        // Indent each line of chunk text for readability.
        for line in preview.lines() {
            println!("    {}", line);
        }
    }
}

/// Look up the full `chunks.text` for a chunk_id. Used by `compare` to show
/// exactly what an LLM would see as RAG input rather than the FTS5 snippet.
fn fetch_chunk_text(conn: &rusqlite::Connection, chunk_id: i64) -> Result<String, rusqlite::Error> {
    conn.query_row(
        "SELECT text FROM chunks WHERE id = ?1",
        rusqlite::params![chunk_id],
        |r| r.get::<_, String>(0),
    )
}

/// Fetch the matched chunk PLUS ±`radius` neighbor chunks from the same
/// document, joined into one ~page-sized blob. When radius=0, this is
/// equivalent to `fetch_chunk_text`. Neighbors are joined with a literal
/// `\n\n--- chunk break ---\n\n` separator so the LLM (and human reader)
/// can see chunk boundaries.
///
/// Boundary clipping: requested ord values that fall outside the
/// document's actual ord range simply don't return rows — the SQL
/// `BETWEEN` is silently bounded by what exists. So a hit at ord=0 with
/// radius=2 returns chunks at ord ∈ {0,1,2} (3 chunks instead of 5).
fn fetch_chunk_with_context(
    conn: &rusqlite::Connection,
    chunk_id: i64,
    radius: usize,
) -> Result<String, rusqlite::Error> {
    if radius == 0 {
        return fetch_chunk_text(conn, chunk_id);
    }
    // 1. Look up the (doc_id, ord) of the matched chunk.
    let (doc_id, ord): (i64, i64) = conn.query_row(
        "SELECT doc_id, ord FROM chunks WHERE id = ?1",
        rusqlite::params![chunk_id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    // 2. Cap radius at search::MAX_CONTEXT_RADIUS (10) for safety.
    let r = (radius as u32).min(search::MAX_CONTEXT_RADIUS) as i64;
    let lo = ord - r;
    let hi = ord + r;
    // 3. Fetch the window in ascending ord order.
    let mut stmt = conn.prepare(
        "SELECT text FROM chunks \
         WHERE doc_id = ?1 AND ord BETWEEN ?2 AND ?3 \
         ORDER BY ord",
    )?;
    let texts: Vec<String> = stmt
        .query_map(rusqlite::params![doc_id, lo, hi], |r| {
            r.get::<_, String>(0)
        })?
        .filter_map(Result::ok)
        .collect();
    if texts.is_empty() {
        // Fallback: matched chunk vanished between ranking and context fetch
        // (concurrent delete?). Return just the matched chunk's snippet via
        // the simple lookup.
        return fetch_chunk_text(conn, chunk_id);
    }
    Ok(texts.join("\n\n--- chunk break ---\n\n"))
}

/// JSON-output helper: hydrate hits with full chunk text + ±context
/// neighbors + truncate per max_chars. Returns serde_json::Value array.
fn expand_full_text(
    conn: &rusqlite::Connection,
    hits: &[search::SearchHit],
    context_radius: usize,
    max_chars: usize,
) -> Vec<serde_json::Value> {
    hits.iter()
        .map(|h| {
            let basename = std::path::Path::new(&h.source)
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| h.source.clone());
            let full = fetch_chunk_with_context(conn, h.chunk_id, context_radius)
                .unwrap_or_else(|_| h.snippet.clone());
            let truncated = if max_chars > 0 && full.chars().count() > max_chars {
                let mut s: String = full.chars().take(max_chars).collect();
                s.push_str("…");
                s
            } else {
                full
            };
            serde_json::json!({
                "chunk_id": h.chunk_id,
                "ord": h.ord,
                "score": h.score,
                "bm25_score": h.bm25_score,
                "dense_score": h.dense_score,
                "rrf_score": h.rrf_score,
                "source": basename,
                "text": truncated,
            })
        })
        .collect()
}

/// `warmup [--quiet]` — Slice 11 install-time encoder pre-load.
///
/// Triggers fastembed to download + cache the e5-multilingual-small ONNX
/// model into `~/.claude/tools/sdlc-knowledge/models/` so the FIRST
/// `claudeknows ingest` or `claudeknows search --mode hybrid` doesn't pay
/// a 30-second cold-start stall. Idempotent — fastembed checks the cache
/// before redownloading; subsequent calls are <1 s. Network failures
/// (offline install, HF rate limit) are warnings, NOT errors — the
/// fallback path is fastembed's lazy download on first real use.
fn run_warmup(args: &cli::WarmupArgs) -> std::process::ExitCode {
    if !args.quiet {
        eprintln!(
            "warmup: pre-loading e5-multilingual-small encoder into ~/.claude/tools/sdlc-knowledge/models/ ..."
        );
    }
    match encoder::encode_query("warmup") {
        Ok(v) => {
            if !args.quiet {
                eprintln!("warmup: ok — encoder ready ({} dims)", v.len());
            }
            std::process::ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!(
                "warmup: WARN — encoder pre-load failed ({e}); fastembed will retry on first real use"
            );
            // Exit 0 even on failure — warmup is best-effort. install.sh
            // proceeds; fastembed lazy-downloads on first ingest.
            std::process::ExitCode::SUCCESS
        }
    }
}

/// Open the index DB at `<root>/.claude/knowledge/index.db`, run migrations
/// (so a freshly-created DB has its `schema_version=1` row), and run the
/// corrupt-index gate (`validate_schema`). Any failure prints the literal
/// AC-7 user-facing stderr and returns `Err(ExitCode 1)`.
///
/// Running migrations on the read path is safe and idempotent — it inserts
/// the `schema_version` row only when missing — and lets reads against a
/// brand-new project (where `ingest` has never run) return empty results
/// instead of falsely flagging "corrupt".
fn open_and_validate(
    root: &std::path::Path,
) -> Result<(rusqlite::Connection, std::path::PathBuf), std::process::ExitCode> {
    let db_path = root.join(".claude").join("knowledge").join("index.db");
    // Tech-debt #4 wiring: use the v2 entry point so fresh DBs are stamped
    // with schema_version=2 and the chunks_vec virtual table is created.
    // Existing v1 DBs are left at v1 (open_or_init_v2 does NOT auto-migrate
    // — that is migrate_v1_to_v2's destructive-confirmation contract). This
    // means new ingests on fresh DBs populate chunks_vec; pre-existing v1
    // ingests continue to work as before until the user opts into migration.
    let mut conn = match store::open_or_init_v2(&db_path) {
        Ok(c) => c,
        Err(_) => {
            // open_or_init_v2 also creates parent dirs; a failure here means
            // the file exists but isn't a valid SQLite database. Map to AC-7.
            eprintln!("error: index database invalid; re-ingest required");
            return Err(std::process::ExitCode::from(1));
        }
    };
    if migrations::run_migrations(&mut conn).is_err() {
        // A migration failure on a freshly-opened DB also signals corruption.
        eprintln!("error: index database invalid; re-ingest required");
        return Err(std::process::ExitCode::from(1));
    }
    if store::validate_schema(&conn).is_err() {
        eprintln!("error: index database invalid; re-ingest required");
        return Err(std::process::ExitCode::from(1));
    }
    Ok((conn, db_path))
}

fn run_ingest(root: &std::path::Path, args: &cli::IngestArgs) -> std::process::ExitCode {
    // The user-supplied path may be relative; resolve against root.
    let target = if args.path.is_absolute() {
        args.path.clone()
    } else {
        root.join(&args.path)
    };

    let db_path = root.join(".claude").join("knowledge").join("index.db");

    // Tech-debt #4 wiring: ingest opens with v2 entry point so fresh DBs get
    // chunks_vec + type/image_bytes columns. Pre-existing v1 DBs continue to
    // work but skip the chunks_vec hook silently (architect-resolved
    // migration UX is destructive opt-in via migrate_v1_to_v2).
    let mut conn = match store::open_or_init_v2(&db_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("error: failed to open index database: {e}");
            return std::process::ExitCode::from(1);
        }
    };
    if let Err(e) = migrations::run_migrations(&mut conn) {
        eprintln!("error: migration failed: {e}");
        return std::process::ExitCode::from(1);
    }

    let result = match ingest::ingest(root, &target, &mut conn) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("error: ingest failed: {e}");
            return std::process::ExitCode::from(1);
        }
    };

    if args.json {
        // Minimal JSON shape for downstream Slice 3 / agent consumers.
        let succeeded: Vec<String> =
            result.succeeded.iter().map(|p| p.display().to_string()).collect();
        let failed: Vec<serde_json::Value> = result
            .failed
            .iter()
            .map(|(p, msg)| {
                serde_json::json!({ "path": p.display().to_string(), "error": msg })
            })
            .collect();
        let unchanged: Vec<String> =
            result.unchanged.iter().map(|p| p.display().to_string()).collect();
        let payload = serde_json::json!({
            "succeeded": succeeded,
            "failed": failed,
            "unchanged": unchanged,
            "succeeded_count": result.succeeded.len(),
            "failed_count": result.failed.len(),
            "unchanged_count": result.unchanged.len(),
        });
        println!("{}", serde_json::to_string_pretty(&payload).unwrap());
    } else {
        for p in &result.succeeded {
            println!("ingested: {}", p.display());
        }
        for p in &result.unchanged {
            println!("unchanged: {}", p.display());
        }
        for (p, e) in &result.failed {
            println!("failed: {} — {}", p.display(), e);
        }
        println!(
            "summary: {} succeeded, {} unchanged, {} failed",
            result.succeeded.len(),
            result.unchanged.len(),
            result.failed.len()
        );
    }

    // Per FR-2.6: batch continues; return 0 even when some files failed.
    std::process::ExitCode::SUCCESS
}

/// `search <query> [--top-k N] [--mode lexical|dense|hybrid] [--json]`.
///
/// Mode dispatch (Slice 7 + technical-debt CLI wiring):
/// - `lexical` (iter-1 baseline): FTS5 BM25 only, works on v1 + v2 schemas
///   without requiring the e5 encoder model
/// - `dense`: sqlite-vec K-NN, requires v2 schema (chunks_vec) AND e5 model
/// - `hybrid` (default): BM25 ⊕ dense fused via RRF k=60; falls back to
///   lexical with a stderr warning when encoder unavailable OR chunks_vec
///   missing on a v1 DB
///
/// Corrupt-DB (AC-7) handling is uniform across modes — open + validate
/// happens BEFORE any mode-specific dispatch so a truncated index.db
/// always exits 1 with the canonical literal stderr message.
fn run_search(root: &std::path::Path, args: &cli::SearchArgs) -> std::process::ExitCode {
    let top_k = args.top_k as u32;
    let context_radius = args.context as u32;

    // Step 1: open + validate. Use the v1 entry point regardless of mode so
    // a truncated index.db trips AC-7 (`index database invalid; re-ingest
    // required`) BEFORE any vector-search dispatch attempts to query
    // chunks_vec. This preserves the corrupt-index test contract for
    // lexical, dense, AND hybrid modes uniformly.
    let (conn, _db_path) = match open_and_validate(root) {
        Ok(t) => t,
        Err(code) => return code,
    };

    let hits_result = match args.mode {
        cli::SearchMode::Lexical => search::search(&conn, &args.query, top_k, context_radius),
        cli::SearchMode::Dense | cli::SearchMode::Hybrid => {
            run_search_with_encoder(&conn, args, top_k, context_radius)
        }
    };

    let hits = match hits_result {
        Ok(h) => h,
        Err(search::SearchError::FtsSyntax(msg)) => {
            eprintln!("error: invalid search query: {msg}");
            return std::process::ExitCode::from(1);
        }
        Err(search::SearchError::Db(e)) => {
            eprintln!("error: search failed: {e}");
            return std::process::ExitCode::from(1);
        }
    };

    if args.json {
        println!("{}", output::render_search_json(&hits));
    } else {
        print!("{}", output::render_search_human(&hits));
    }
    std::process::ExitCode::SUCCESS
}

/// Dense / hybrid search dispatch with graceful fallback to lexical.
///
/// Caller has already opened + validated the connection; this function
/// owns the encoder + vec-query lifecycle plus the two fallback paths:
/// 1. `encoder::encode_query` produces the 384-dim query vector. Failure
///    (model missing / runtime error) → fall back to lexical with stderr
///    warning. Most common during initial install before
///    `bash install.sh --yes` has populated `~/.claude/tools/sdlc-knowledge/models/`.
/// 2. `dense_search` or `hybrid_search` runs the vector query. Failure
///    (chunks_vec missing on a v1 DB / SQLite error) → fall back to
///    lexical with a stderr warning. Most common when the user has a
///    pre-existing v1 corpus and hasn't yet re-ingested under v2.
fn run_search_with_encoder(
    conn: &rusqlite::Connection,
    args: &cli::SearchArgs,
    top_k: u32,
    context_radius: u32,
) -> Result<Vec<search::SearchHit>, search::SearchError> {
    let embedding = match encoder::encode_query(&args.query) {
        Ok(v) => v,
        Err(e) => {
            eprintln!(
                "warning: encoder unavailable ({e}); falling back to lexical mode. Run `bash install.sh --yes` to install the e5-multilingual-small model."
            );
            return search::search(conn, &args.query, top_k, context_radius);
        }
    };

    let result = match args.mode {
        cli::SearchMode::Dense => search::dense_search(conn, &embedding, top_k),
        cli::SearchMode::Hybrid => search::hybrid_search(conn, &args.query, &embedding, top_k),
        cli::SearchMode::Lexical => unreachable!("lexical handled by caller"),
    };

    match result {
        Ok(h) => Ok(h),
        Err(search::SearchError::Db(e)) => {
            // Most likely "no such table: chunks_vec" on a v1 DB OR
            // sqlite-vec extension not registered (auto-extension load
            // race with the v1-only open path). Fall back to lexical
            // with a clear warning explaining the migration path.
            eprintln!(
                "warning: vector search failed ({e}); falling back to lexical mode. Run `claudeknows ingest <path>` to populate the v2 schema with embeddings."
            );
            search::search(conn, &args.query, top_k, context_radius)
        }
        Err(other) => Err(other),
    }
}

/// `list [--json]` — list ingested documents with chunk counts.
fn run_list(root: &std::path::Path, args: &cli::ListArgs) -> std::process::ExitCode {
    let (conn, _db_path) = match open_and_validate(root) {
        Ok(t) => t,
        Err(code) => return code,
    };

    let docs = match store::list_documents(&conn) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("error: list failed: {e}");
            return std::process::ExitCode::from(1);
        }
    };

    if args.json {
        println!("{}", output::render_list_json(&docs));
    } else {
        print!("{}", output::render_list_human(&docs));
    }
    std::process::ExitCode::SUCCESS
}

/// `status [--json]` — schema_version + counts + db_path.
fn run_status(root: &std::path::Path, args: &cli::StatusArgs) -> std::process::ExitCode {
    let (conn, db_path) = match open_and_validate(root) {
        Ok(t) => t,
        Err(code) => return code,
    };

    let info = match store::status_summary(&conn, &db_path) {
        Ok(i) => i,
        Err(e) => {
            eprintln!("error: status failed: {e}");
            return std::process::ExitCode::from(1);
        }
    };

    if args.json {
        println!("{}", output::render_status_json(&info));
    } else {
        print!("{}", output::render_status_human(&info));
    }
    std::process::ExitCode::SUCCESS
}

/// `delete --by-id <int>` OR `delete <source-path>` — mutually exclusive per
/// FR-4.1 (Slice 2). The two branches differ in their security posture:
///   - `--by-id` operates on the integer primary key, which never originated
///     from a user-controlled file path. The DB-open project-root canonicalize
///     gate (in `cli::resolve_project_root`) is the load-bearing security
///     boundary; no additional path check is needed (FR-4.3).
///   - The positional `<source-path>` branch (legacy iter-1 form) keeps the
///     Slice 1 cross-slice canonicalize-and-prefix-check in place verbatim.
fn run_delete(root: &std::path::Path, args: &cli::DeleteArgs) -> std::process::ExitCode {
    // FR-4.1 mutual exclusion — checked BEFORE opening the DB so a malformed
    // invocation never side-effects on the index.
    match (&args.by_id, &args.source_path) {
        (Some(_), Some(_)) => {
            eprintln!("error: --by-id and <source-path> are mutually exclusive");
            return std::process::ExitCode::from(2);
        }
        (None, None) => {
            eprintln!("error: --by-id or <source-path> required");
            return std::process::ExitCode::from(2);
        }
        _ => {}
    }

    let (mut conn, _db_path) = match open_and_validate(root) {
        Ok(t) => t,
        Err(code) => return code,
    };

    // --by-id branch (FR-4.4 transactional via store helper, FR-4.5 JSON shape).
    if let Some(id) = args.by_id {
        let summary = match store::delete_by_id_with_summary(&mut conn, id) {
            Ok(Some(s)) => s,
            Ok(None) => {
                // FR-4.2: literal stderr + exit 1; transaction already rolled back.
                eprintln!("error: no document with id {id}");
                return std::process::ExitCode::from(1);
            }
            Err(e) => {
                eprintln!("error: delete failed: {e}");
                return std::process::ExitCode::from(1);
            }
        };
        if args.json {
            println!("{}", output::render_delete_by_id_json(&summary));
        } else {
            println!(
                "deleted: id={} source={} chunks={}",
                summary.deleted_id, summary.source_path, summary.chunks_removed
            );
        }
        return std::process::ExitCode::SUCCESS;
    }

    // Positional <source-path> branch — preserve iter-1 canonicalize-and-prefix
    // check verbatim. We unwrap because the mutual-exclusion check above
    // guarantees exactly one of (by_id, source_path) is Some at this point.
    let source_arg = args
        .source_path
        .as_ref()
        .expect("mutual exclusion guarantees source_path is Some here");

    // String path branch — canonicalize-and-prefix-check first (Slice 1
    // cross-slice security flag). The DB stores the path string EXACTLY as
    // ingest emitted it (`p.display().to_string()` from the canonical path),
    // so for the DELETE to match, we use the same canonical string here.
    let raw = std::path::Path::new(source_arg);
    let candidate: std::path::PathBuf = if raw.is_absolute() {
        raw.to_path_buf()
    } else {
        root.join(raw)
    };
    let canonical = match std::fs::canonicalize(&candidate) {
        Ok(p) => p,
        Err(_) => {
            // The file may have already been deleted from disk — fall back to
            // a verbatim string match against documents.source_path.
            // We still ENFORCE the prefix-check by requiring the raw string
            // to be either absolute-under-root or relative (which we resolved
            // against root above). A path that escapes root (`/etc/passwd`)
            // resolves to an absolute path NOT under root and is rejected.
            let not_canonical = candidate.clone();
            if !not_canonical.starts_with(root) {
                eprintln!(
                    "error: source path must resolve under project root: {}",
                    source_arg
                );
                return std::process::ExitCode::from(2);
            }
            not_canonical
        }
    };
    if !canonical.starts_with(root) {
        eprintln!(
            "error: source path must resolve under project root: {}",
            source_arg
        );
        return std::process::ExitCode::from(2);
    }

    // Match the exact form ingest stored: `canonical.display().to_string()`.
    let key = canonical.display().to_string();
    let n = match store::delete_by_source_path(&conn, &key) {
        Ok(n) => n,
        Err(e) => {
            eprintln!("error: delete failed: {e}");
            return std::process::ExitCode::from(1);
        }
    };
    if args.json {
        let escaped = serde_json::to_string(&key).unwrap_or_else(|_| "\"\"".to_string());
        println!(
            "{{\"deleted\": {n}, \"by\": \"source_path\", \"source_path\": {escaped}}}"
        );
    } else {
        println!("deleted {n} document(s) by source_path={key}");
    }
    std::process::ExitCode::SUCCESS
}

