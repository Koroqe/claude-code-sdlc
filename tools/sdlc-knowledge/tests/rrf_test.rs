//! Slice 7 (vector-retrieval-backend) — RRF correctness golden tests.
//!
//! Reciprocal Rank Fusion (Cormack/Clarke/Buttcher 2009) with k=60. Tests
//! verify the formula `score(d) = Σ_i 1/(60 + rank_i(d))` against
//! hand-computed expected outputs. Implementation correctness is critical:
//! a wrong k value or off-by-one in the rank-1 indexing silently degrades
//! recall and is impossible to detect from end-to-end behavior alone.

use sdlc_knowledge::search::{rrf_fuse, SearchHit, RRF_K};

fn synth_hit(chunk_id: i64, score: f64, mode: &str) -> SearchHit {
    SearchHit {
        chunk_id,
        source: format!("/tmp/doc.{chunk_id}.md"),
        ord: 0,
        score,
        snippet: String::new(),
        context: None,
        mode_used: Some(mode.to_string()),
        bm25_score: if mode == "lexical" { Some(score) } else { None },
        dense_score: if mode == "dense" { Some(score) } else { None },
        rrf_score: None,
    }
}

#[test]
fn rrf_k_constant_is_60_canonical() {
    assert_eq!(RRF_K, 60.0, "RRF k=60 is the Cormack 2009 canonical value");
}

#[test]
fn rrf_fuse_known_rankings_match_hand_computed() {
    // Lexical ranker: [chunk 1, chunk 2, chunk 3]
    // Dense ranker:   [chunk 3, chunk 1, chunk 4]
    //
    // Expected RRF (k=60):
    //   chunk 1: 1/(60+1) [lex rank 1] + 1/(60+2) [dense rank 2] = 0.0163934 + 0.0161290 = 0.0325224
    //   chunk 3: 1/(60+3) [lex rank 3] + 1/(60+1) [dense rank 1] = 0.0158730 + 0.0163934 = 0.0322664
    //   chunk 2: 1/(60+2) [lex rank 2 only]                       = 0.0161290
    //   chunk 4: 1/(60+3) [dense rank 3 only]                     = 0.0158730
    //
    // Expected order: 1, 3, 2, 4
    let lex = vec![
        synth_hit(1, 5.0, "lexical"),
        synth_hit(2, 4.0, "lexical"),
        synth_hit(3, 3.0, "lexical"),
    ];
    let dense = vec![
        synth_hit(3, 0.95, "dense"),
        synth_hit(1, 0.90, "dense"),
        synth_hit(4, 0.80, "dense"),
    ];
    let fused = rrf_fuse(&lex, &dense, 10);
    assert_eq!(fused.len(), 4, "all 4 unique chunk_ids should appear");
    assert_eq!(
        fused[0].chunk_id, 1,
        "chunk 1 should rank first (BOTH rankers, both top-2)"
    );
    assert_eq!(
        fused[1].chunk_id, 3,
        "chunk 3 should rank second (BOTH rankers but dense:1 + lex:3)"
    );
    assert_eq!(
        fused[2].chunk_id, 2,
        "chunk 2 should rank third (lex only, rank 2)"
    );
    assert_eq!(
        fused[3].chunk_id, 4,
        "chunk 4 should rank fourth (dense only, rank 3)"
    );

    // Numerical verification of the top-1 score.
    let chunk1_score = fused[0].score;
    let expected = 1.0 / (60.0 + 1.0) + 1.0 / (60.0 + 2.0);
    assert!(
        (chunk1_score - expected).abs() < 1e-9,
        "chunk 1 RRF score should equal {expected}; got {chunk1_score}"
    );
    // mode_used and component scores must be set.
    assert_eq!(fused[0].mode_used.as_deref(), Some("hybrid"));
    assert!(fused[0].rrf_score.is_some());
    assert!(fused[0].bm25_score.is_some());
    assert!(fused[0].dense_score.is_some());
}

#[test]
fn rrf_fuse_empty_inputs_yield_empty_output() {
    let fused = rrf_fuse(&[], &[], 10);
    assert!(fused.is_empty());
}

#[test]
fn rrf_fuse_single_ranker_only() {
    // If only the lexical ranker has hits, fused output equals the lexical
    // order with RRF scores 1/(k+1), 1/(k+2), ...
    let lex = vec![
        synth_hit(10, 5.0, "lexical"),
        synth_hit(20, 4.0, "lexical"),
        synth_hit(30, 3.0, "lexical"),
    ];
    let fused = rrf_fuse(&lex, &[], 10);
    assert_eq!(fused.len(), 3);
    assert_eq!(fused[0].chunk_id, 10);
    assert_eq!(fused[1].chunk_id, 20);
    assert_eq!(fused[2].chunk_id, 30);
    let expected_top = 1.0 / (60.0 + 1.0);
    assert!((fused[0].score - expected_top).abs() < 1e-9);
}

#[test]
fn rrf_fuse_top_k_truncation() {
    // 5 unique chunks, top_k=2 → only 2 returned.
    let lex = vec![
        synth_hit(1, 5.0, "lexical"),
        synth_hit(2, 4.0, "lexical"),
        synth_hit(3, 3.0, "lexical"),
        synth_hit(4, 2.0, "lexical"),
        synth_hit(5, 1.0, "lexical"),
    ];
    let fused = rrf_fuse(&lex, &[], 2);
    assert_eq!(fused.len(), 2, "top_k=2 should truncate to 2");
    assert_eq!(fused[0].chunk_id, 1);
    assert_eq!(fused[1].chunk_id, 2);
}
