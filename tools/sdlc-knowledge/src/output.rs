//! JSON + human-readable output rendering for `search`, `list`, `status`.
//!
//! JSON shape per FR-3.3:
//!   - search:  `[{source, chunk_id, ord, score, snippet}, ...]`
//!   - list:    `[{source_path, chunk_count, ingested_at}, ...]`
//!   - status:  `{schema_version, doc_count, chunk_count, db_path}`
//!
//! Empty results render as `[]` (JSON) / `"no results"` (human) per FR-3.4.

use serde::Serialize;

use crate::search::SearchHit;

/// One row in the `list --json` output.
#[derive(Debug, Clone, Serialize)]
pub struct DocumentSummary {
    pub source_path: String,
    pub chunk_count: i64,
    pub ingested_at: i64,
}

/// Status payload returned by `status --json`.
#[derive(Debug, Clone, Serialize)]
pub struct StatusInfo {
    pub schema_version: i64,
    pub doc_count: i64,
    pub chunk_count: i64,
    pub db_path: String,
}

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

pub fn render_search_json(hits: &[SearchHit]) -> String {
    serde_json::to_string(hits).unwrap_or_else(|_| "[]".to_string())
}

pub fn render_search_human(hits: &[SearchHit]) -> String {
    if hits.is_empty() {
        return "no results".to_string();
    }
    let mut s = String::new();
    for (i, h) in hits.iter().enumerate() {
        // Format: 1. score=0.42 [ord 3] [page 17] /abs/path/source.md
        //          <snippet>
        //          [+context if present, indented under "context:" label]
        let page_label = match (h.page_start, h.page_end) {
            (Some(a), Some(b)) if a == b => format!(" [page {a}]"),
            (Some(a), Some(b)) => format!(" [pages {a}-{b}]"),
            _ => String::new(),
        };
        s.push_str(&format!(
            "{}. score={:.4} [ord {}]{} doc_id={} {}\n   {}\n",
            i + 1,
            h.score,
            h.ord,
            page_label,
            h.doc_id,
            h.source,
            h.snippet
        ));
        if let Some(ctx) = &h.context {
            s.push_str("   context:\n");
            for line in ctx.lines() {
                s.push_str(&format!("     {line}\n"));
            }
        }
    }
    s
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

pub fn render_list_json(docs: &[DocumentSummary]) -> String {
    serde_json::to_string(docs).unwrap_or_else(|_| "[]".to_string())
}

pub fn render_list_human(docs: &[DocumentSummary]) -> String {
    if docs.is_empty() {
        return "no results".to_string();
    }
    let mut s = String::new();
    for d in docs {
        s.push_str(&format!(
            "{}\n  chunks: {}  ingested_at: {}\n",
            d.source_path, d.chunk_count, d.ingested_at
        ));
    }
    s
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

pub fn render_status_json(info: &StatusInfo) -> String {
    serde_json::to_string(info).unwrap_or_else(|_| "{}".to_string())
}

pub fn render_status_human(info: &StatusInfo) -> String {
    format!(
        "schema_version: {}\ndoc_count: {}\nchunk_count: {}\ndb_path: {}\n",
        info.schema_version, info.doc_count, info.chunk_count, info.db_path
    )
}

// ---------------------------------------------------------------------------
// delete --by-id (FR-4.5)
// ---------------------------------------------------------------------------

/// FR-4.5 — `{"deleted_id": N, "source_path": "...", "chunks_removed": M}`.
/// Serializes via the `serde::Serialize` derive on `store::DeleteByIdSummary`.
pub fn render_delete_by_id_json(summary: &crate::store::DeleteByIdSummary) -> String {
    serde_json::to_string(summary).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
}

// ---------------------------------------------------------------------------
// page (full-text page lookup; v2)
// ---------------------------------------------------------------------------

pub fn render_page_json(rec: &crate::store::PageRecord) -> String {
    serde_json::to_string(rec).unwrap_or_else(|_| "{}".to_string())
}

pub fn render_page_human(rec: &crate::store::PageRecord) -> String {
    // Header line lets a human eyeball confirm they got the right page back;
    // the body is the raw extracted text exactly as stored.
    format!(
        "source: {}\ndoc_id: {}\npage: {}\n---\n{}\n",
        rec.source_path, rec.doc_id, rec.page_no, rec.text
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::search::SearchHit;

    #[test]
    fn search_empty_renders_empty_array() {
        assert_eq!(render_search_json(&[]), "[]");
        assert_eq!(render_search_human(&[]), "no results");
    }

    #[test]
    fn list_empty_renders_empty_array() {
        assert_eq!(render_list_json(&[]), "[]");
        assert_eq!(render_list_human(&[]), "no results");
    }

    #[test]
    fn search_json_contains_required_fields() {
        let hit = SearchHit {
            source: "/p/x.md".to_string(),
            doc_id: 1,
            chunk_id: 7,
            ord: 0,
            score: 1.5,
            snippet: "the cat".to_string(),
            page_start: None,
            page_end: None,
            context: None,
            mode_used: None,
            bm25_score: None,
            dense_score: None,
            rrf_score: None,
        };
        let s = render_search_json(&[hit]);
        for f in ["source", "chunk_id", "ord", "score", "snippet", "doc_id"] {
            assert!(s.contains(f), "missing field {f} in {s}");
        }
        // context / page_* with None must be omitted via skip_serializing_if
        assert!(!s.contains("context"), "context should be absent when None: {s}");
        assert!(!s.contains("page_start"), "page_start should be absent when None: {s}");
        assert!(!s.contains("page_end"), "page_end should be absent when None: {s}");
    }

    #[test]
    fn search_json_includes_context_when_present() {
        let hit = SearchHit {
            source: "/p/x.md".to_string(),
            doc_id: 1,
            chunk_id: 7,
            ord: 0,
            score: 1.5,
            snippet: "the cat".to_string(),
            page_start: None,
            page_end: None,
            context: Some("para1\npara2\npara3".to_string()),
            mode_used: None,
            bm25_score: None,
            dense_score: None,
            rrf_score: None,
        };
        let s = render_search_json(&[hit]);
        assert!(s.contains("\"context\""), "context field must appear: {s}");
        assert!(s.contains("para1"), "context value must be serialized: {s}");
    }

    #[test]
    fn search_json_includes_page_when_present() {
        let hit = SearchHit {
            source: "/books/a.pdf".to_string(),
            doc_id: 5,
            chunk_id: 42,
            ord: 10,
            score: 2.1,
            snippet: "matching text".to_string(),
            page_start: Some(17),
            page_end: Some(17),
            context: None,
            mode_used: None,
            bm25_score: None,
            dense_score: None,
            rrf_score: None,
        };
        let s = render_search_json(&[hit]);
        assert!(s.contains("\"page_start\":17"), "page_start must serialize: {s}");
        assert!(s.contains("\"page_end\":17"), "page_end must serialize: {s}");
        assert!(s.contains("\"doc_id\":5"), "doc_id must serialize: {s}");
    }

    #[test]
    fn search_human_renders_page_label() {
        let hit = SearchHit {
            source: "/books/a.pdf".to_string(),
            doc_id: 5,
            chunk_id: 42,
            ord: 10,
            score: 2.1,
            snippet: "matching text".to_string(),
            page_start: Some(17),
            page_end: Some(17),
            context: None,
            mode_used: None,
            bm25_score: None,
            dense_score: None,
            rrf_score: None,
        };
        let out = render_search_human(&[hit]);
        assert!(out.contains("[page 17]"), "human output must show page label: {out}");
    }

    #[test]
    fn status_json_contains_required_fields() {
        let info = StatusInfo {
            schema_version: 1,
            doc_count: 2,
            chunk_count: 16,
            db_path: "/abs/index.db".to_string(),
        };
        let s = render_status_json(&info);
        for f in ["schema_version", "doc_count", "chunk_count", "db_path"] {
            assert!(s.contains(f), "missing {f} in {s}");
        }
    }
}
