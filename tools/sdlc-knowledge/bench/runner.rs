//! claudeknows-bench — Slice 9 of vector-retrieval-backend.
//!
//! Runs a golden query set (bench/golden/queries.jsonl) through every
//! search mode (lexical / dense / hybrid) and emits a Markdown report
//! with Recall@K, MRR, and latency p50/p95.
//!
//! Source-level relevance: a returned hit counts as relevant when its
//! `source` basename is listed in the query's `relevant_sources` array.
//! See bench/golden/README.md for the rationale.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

use sdlc_knowledge::{cli, encoder, search, store};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct GoldenQuery {
    id: String,
    query: String,
    lang: String,
    category: String,
    relevant_sources: Vec<String>,
}

#[derive(Debug, Serialize)]
struct PerQueryResult {
    id: String,
    query: String,
    lang: String,
    category: String,
    /// Was at least one of the top-K results from a relevant source.
    hit_at_5: bool,
    hit_at_10: bool,
    /// 1-based rank of the first relevant hit, or 0 if none in top-K.
    first_relevant_rank: usize,
    latency_ms: f64,
    top_sources: Vec<String>,
}

#[derive(Debug, Default, Serialize)]
struct ModeMetrics {
    queries: Vec<PerQueryResult>,
}

impl ModeMetrics {
    fn recall_at(&self, k: usize) -> f64 {
        if self.queries.is_empty() {
            return 0.0;
        }
        let hits = self
            .queries
            .iter()
            .filter(|q| {
                q.first_relevant_rank > 0 && q.first_relevant_rank <= k
            })
            .count();
        hits as f64 / self.queries.len() as f64
    }

    fn mrr(&self) -> f64 {
        if self.queries.is_empty() {
            return 0.0;
        }
        let sum: f64 = self
            .queries
            .iter()
            .map(|q| {
                if q.first_relevant_rank == 0 {
                    0.0
                } else {
                    1.0 / q.first_relevant_rank as f64
                }
            })
            .sum();
        sum / self.queries.len() as f64
    }

    fn latency_p(&self, percentile: f64) -> f64 {
        if self.queries.is_empty() {
            return 0.0;
        }
        let mut latencies: Vec<f64> = self.queries.iter().map(|q| q.latency_ms).collect();
        latencies.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let idx = ((latencies.len() as f64 - 1.0) * percentile).round() as usize;
        latencies[idx.min(latencies.len() - 1)]
    }
}

fn run_query(
    conn: &rusqlite::Connection,
    query: &str,
    mode: cli::SearchMode,
    top_k: u32,
) -> Result<Vec<search::SearchHit>, search::SearchError> {
    match mode {
        cli::SearchMode::Lexical => search::search(conn, query, top_k, 0),
        cli::SearchMode::Dense => {
            let v = encoder::encode_query(query)
                .map_err(|e| search::SearchError::FtsSyntax(format!("encoder: {e}")))?;
            search::dense_search(conn, &v, top_k)
        }
        cli::SearchMode::Hybrid => {
            let v = encoder::encode_query(query)
                .map_err(|e| search::SearchError::FtsSyntax(format!("encoder: {e}")))?;
            search::hybrid_search(conn, query, &v, top_k)
        }
    }
}

fn evaluate_query(
    conn: &rusqlite::Connection,
    q: &GoldenQuery,
    mode: cli::SearchMode,
    top_k: u32,
) -> PerQueryResult {
    let start = Instant::now();
    let hits = match run_query(conn, &q.query, mode, top_k) {
        Ok(h) => h,
        Err(e) => {
            eprintln!("WARN: query {} mode {:?} failed: {e}", q.id, mode);
            Vec::new()
        }
    };
    let latency_ms = start.elapsed().as_secs_f64() * 1000.0;

    let top_sources: Vec<String> = hits
        .iter()
        .map(|h| {
            std::path::Path::new(&h.source)
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| h.source.clone())
        })
        .collect();

    let first_relevant_rank = top_sources
        .iter()
        .enumerate()
        .find_map(|(idx, src)| {
            if q.relevant_sources.iter().any(|r| r == src) {
                Some(idx + 1)
            } else {
                None
            }
        })
        .unwrap_or(0);

    PerQueryResult {
        id: q.id.clone(),
        query: q.query.clone(),
        lang: q.lang.clone(),
        category: q.category.clone(),
        hit_at_5: first_relevant_rank > 0 && first_relevant_rank <= 5,
        hit_at_10: first_relevant_rank > 0 && first_relevant_rank <= 10,
        first_relevant_rank,
        latency_ms,
        top_sources,
    }
}

fn parse_args() -> (PathBuf, Vec<cli::SearchMode>, u32, PathBuf) {
    let mut args = std::env::args().skip(1);
    let mut queries_path: Option<PathBuf> = None;
    let mut modes_str: Option<String> = None;
    let mut top_k: u32 = 10;
    let mut report_path: Option<PathBuf> = None;
    while let Some(a) = args.next() {
        match a.as_str() {
            "--queries" => queries_path = args.next().map(PathBuf::from),
            "--modes" => modes_str = args.next(),
            "--top-k" => top_k = args.next().and_then(|s| s.parse().ok()).unwrap_or(10),
            "--report" => report_path = args.next().map(PathBuf::from),
            _ => {}
        }
    }
    let queries_path = queries_path.expect("--queries required");
    let modes: Vec<cli::SearchMode> = modes_str
        .unwrap_or_else(|| "lexical,dense,hybrid".to_string())
        .split(',')
        .map(|s| match s.trim() {
            "lexical" => cli::SearchMode::Lexical,
            "dense" => cli::SearchMode::Dense,
            "hybrid" => cli::SearchMode::Hybrid,
            other => panic!("unknown mode: {other}"),
        })
        .collect();
    let report_path = report_path
        .unwrap_or_else(|| PathBuf::from("bench/reports/local-run.md"));
    (queries_path, modes, top_k, report_path)
}

fn render_report(
    by_mode: &BTreeMap<String, ModeMetrics>,
    queries: &[GoldenQuery],
    top_k: u32,
) -> String {
    let mut s = String::new();
    s.push_str("# Vector-retrieval-backend benchmark report\n\n");
    s.push_str(&format!("**Date:** {}\n\n", chrono_today()));
    s.push_str(&format!("**Queries:** {} (golden set)\n", queries.len()));
    s.push_str(&format!("**Top-K:** {top_k}\n"));
    s.push_str(
        "**Relevance:** source-level — a hit is counted when at least one returned chunk's \
         source basename is listed in the query's `relevant_sources` array.\n\n",
    );

    s.push_str("## Aggregate metrics\n\n");
    s.push_str(
        "| Mode | Recall@1 | Recall@3 | Recall@5 | Recall@10 | MRR | Latency p50 (ms) | Latency p95 (ms) |\n",
    );
    s.push_str("|------|----------|----------|----------|-----------|-----|------------------|------------------|\n");
    for (mode, m) in by_mode {
        s.push_str(&format!(
            "| {} | {:.3} | {:.3} | {:.3} | {:.3} | {:.3} | {:.1} | {:.1} |\n",
            mode,
            m.recall_at(1),
            m.recall_at(3),
            m.recall_at(5),
            m.recall_at(10),
            m.mrr(),
            m.latency_p(0.50),
            m.latency_p(0.95),
        ));
    }
    s.push('\n');

    s.push_str("## Per-query side-by-side\n\n");
    for q in queries {
        s.push_str(&format!(
            "### {} ({}, {}) — {:?}\n\n",
            q.id, q.lang, q.category, q.query
        ));
        s.push_str(&format!(
            "Relevant sources: {}\n\n",
            q.relevant_sources.join(", ")
        ));
        s.push_str("| Mode | Hit@5 | Hit@10 | First relevant rank | Latency (ms) | Top-3 sources |\n");
        s.push_str("|------|-------|--------|---------------------|--------------|---------------|\n");
        for (mode, m) in by_mode {
            if let Some(r) = m.queries.iter().find(|r| r.id == q.id) {
                let top3 = r
                    .top_sources
                    .iter()
                    .take(3)
                    .cloned()
                    .collect::<Vec<_>>()
                    .join(", ");
                s.push_str(&format!(
                    "| {} | {} | {} | {} | {:.1} | {} |\n",
                    mode,
                    if r.hit_at_5 { "✓" } else { "✗" },
                    if r.hit_at_10 { "✓" } else { "✗" },
                    if r.first_relevant_rank == 0 {
                        "—".to_string()
                    } else {
                        r.first_relevant_rank.to_string()
                    },
                    r.latency_ms,
                    top3
                ));
            }
        }
        s.push('\n');
    }

    s.push_str("## Methodology\n\n");
    s.push_str(
        "Each query runs in lexical, dense, and hybrid modes against the same project-local \
         index.db. Relevance is source-level (see bench/golden/README.md). Hybrid mode uses \
         RRF k=60 (Cormack et al. 2009). Dense uses sqlite-vec K-NN with `embedding MATCH ? \
         AND k = ?`. Encoder is e5-multilingual-small (384-dim L2-normalized) loaded via fastembed-rs.\n",
    );

    s
}

fn chrono_today() -> String {
    // Avoid pulling chrono dep — produce a YYYY-MM-DD via std::time + manual format.
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    // Days since 1970-01-01.
    let days = now / 86_400;
    // Civil-from-days algorithm (Hinnant 2013).
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{:04}-{:02}-{:02}", y, m, d)
}

fn main() -> std::process::ExitCode {
    let (queries_path, modes, top_k, report_path) = parse_args();

    // Load queries.
    let raw = match fs::read_to_string(&queries_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("error: cannot read queries file {queries_path:?}: {e}");
            return std::process::ExitCode::from(1);
        }
    };
    let queries: Vec<GoldenQuery> = raw
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| serde_json::from_str::<GoldenQuery>(l).expect("valid golden JSON"))
        .collect();
    eprintln!("loaded {} queries from {queries_path:?}", queries.len());

    // Open project-local DB.
    let cwd = std::env::current_dir().expect("cwd");
    let db_path = cwd.join(".claude").join("knowledge").join("index.db");
    let conn = match store::open_or_init_v2(&db_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("error: cannot open index.db at {db_path:?}: {e}");
            return std::process::ExitCode::from(1);
        }
    };

    // Run all (mode, query) pairs.
    let mut by_mode: BTreeMap<String, ModeMetrics> = BTreeMap::new();
    for &mode in &modes {
        let mode_name = match mode {
            cli::SearchMode::Lexical => "lexical",
            cli::SearchMode::Dense => "dense",
            cli::SearchMode::Hybrid => "hybrid",
        };
        eprintln!("running mode={mode_name}");
        let mut metrics = ModeMetrics::default();
        for q in &queries {
            let r = evaluate_query(&conn, q, mode, top_k);
            eprintln!(
                "  {} ({}): hit@5={} hit@10={} rank={} latency={:.1}ms",
                q.id, mode_name, r.hit_at_5, r.hit_at_10, r.first_relevant_rank, r.latency_ms
            );
            metrics.queries.push(r);
        }
        by_mode.insert(mode_name.to_string(), metrics);
    }

    // Render + write report.
    let report = render_report(&by_mode, &queries, top_k);
    if let Some(parent) = Path::new(&report_path).parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Err(e) = fs::write(&report_path, &report) {
        eprintln!("error: cannot write report to {report_path:?}: {e}");
        return std::process::ExitCode::from(1);
    }
    eprintln!("report written to {report_path:?}");
    std::process::ExitCode::SUCCESS
}
