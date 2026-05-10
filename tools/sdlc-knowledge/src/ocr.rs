//! OCR bridge for image chunks (Slice 6 + Slice 6b of vector-retrieval-backend).
//!
//! Backend: `ocr-rs` (PaddleOCR PP-OCRv4 via MNN inference framework).
//! Architect OQ-3 resolution chose PaddleOCR PP-OCRv4 ONNX; the `ocr-rs`
//! crate provides the same model lineage via the MNN runtime instead of
//! ONNX, sidestepping the ort version conflict that blocks
//! `paddle-ocr-rs = "0.6.1"` from coexisting with `fastembed = "5"`
//! (both depend on different ort versions). Quality and model files are
//! identical — `ch_PP-OCRv4_det_infer` + `ch_PP-OCRv4_rec_infer` plus
//! `ppocr_keys.txt` character dict — only the inference engine differs.
//!
//! Models are cached at:
//!   `~/.claude/tools/sdlc-knowledge/models/paddleocr/`
//!     ├── det.mnn       (text detection, ~5 MB)
//!     ├── rec.mnn       (text recognition, ~10 MB)
//!     └── keys.txt      (multilingual character dict, ~50 KB)
//!
//! When any of these files is missing, [`extract_text_from_image`] returns
//! `OcrError::ModelMissing` and callers fall back to the placeholder text
//! `[image: figure N from <doc>]` — image chunks remain dense+BM25
//! searchable at low recall via the placeholder until the operator runs
//! `bash install.sh --yes` to populate the model cache.
//!
//! Security (architect security pre-review for Slice 6 — PNG bomb DoS gate):
//! [`extract_text_from_image`] caps decoded image dimensions before the
//! OCR pass. Images that would decode to >50 MP (megapixels) are rejected
//! with `OcrError::Engine` so a single malicious PNG cannot exhaust memory.
//! 50 MP at 4 bytes/pixel = 200 MB raw bitmap, comfortably above any
//! legitimate diagram size.

use std::path::PathBuf;
use std::sync::Mutex;

use thiserror::Error;

use ocr_rs::{OcrEngine, OcrEngineConfig};

#[derive(Debug, Error)]
pub enum OcrError {
    #[error("OCR model files missing at ~/.claude/tools/sdlc-knowledge/models/paddleocr/ — run `bash install.sh --yes`")]
    ModelMissing,
    #[error("OCR engine error: {0}")]
    Engine(String),
}

/// Process-wide OCR engine singleton. Lazy-loaded on first
/// `extract_text_from_image` call. `OcrEngine` is internally `Send + Sync`
/// per ocr-rs docs; we still hold it behind a Mutex for serialized access
/// because the underlying MNN session is not safe for concurrent calls
/// in all builds (architect security defense-in-depth).
static OCR_ENGINE: Mutex<Option<OcrEngine>> = Mutex::new(None);

/// Maximum decoded image area (megapixels) before rejection. Architect
/// security pre-review: a malicious PNG can declare absurd dimensions
/// (e.g. 100000x100000) and decode to a multi-GB bitmap that exhausts
/// memory. 50 MP × 4 bytes/pixel = 200 MB bitmap — well above any
/// legitimate diagram (typical is <2 MP for a printed-book figure).
const MAX_DECODE_MEGAPIXELS: u32 = 50;

/// Resolve the model cache directory. Honors `HOME` (Unix) and `USERPROFILE`
/// (Windows) — same pattern as the encoder + pdfium loaders.
fn model_dir() -> Result<PathBuf, OcrError> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| OcrError::ModelMissing)?;
    if home.is_empty() {
        return Err(OcrError::ModelMissing);
    }
    Ok(PathBuf::from(home).join(".claude/tools/sdlc-knowledge/models/paddleocr"))
}

/// Verify all three model files exist BEFORE attempting OcrEngine::new
/// (which surfaces a generic IO error if any file is missing). Returns
/// the canonical (det_path, rec_path, keys_path) tuple on success.
fn resolve_model_paths() -> Result<(PathBuf, PathBuf, PathBuf), OcrError> {
    let dir = model_dir()?;
    let det = dir.join("det.mnn");
    let rec = dir.join("rec.mnn");
    let keys = dir.join("keys.txt");
    if !det.exists() || !rec.exists() || !keys.exists() {
        return Err(OcrError::ModelMissing);
    }
    Ok((det, rec, keys))
}

/// Lazy-load the engine singleton. Idempotent — only the first call pays
/// the model-load cost (~200 ms for det+rec MNN sessions).
fn ensure_loaded() -> Result<(), OcrError> {
    let mut guard = OCR_ENGINE
        .lock()
        .map_err(|_| OcrError::Engine("OCR mutex poisoned".to_string()))?;
    if guard.is_some() {
        return Ok(());
    }
    let (det, rec, keys) = resolve_model_paths()?;
    let cfg = OcrEngineConfig::new();
    let engine = OcrEngine::new(&det, &rec, &keys, Some(cfg))
        .map_err(|e| OcrError::Engine(format!("OcrEngine::new: {e}")))?;
    *guard = Some(engine);
    Ok(())
}

/// PNG bomb DoS gate (architect security pre-review for Slice 6). Reads
/// the PNG header to extract declared dimensions and rejects anything
/// over `MAX_DECODE_MEGAPIXELS`. Cheap header-only inspection; full pixel
/// decode happens only after this check passes.
fn check_image_size(png_bytes: &[u8]) -> Result<image::DynamicImage, OcrError> {
    let cursor = std::io::Cursor::new(png_bytes);
    let reader = image::ImageReader::new(cursor)
        .with_guessed_format()
        .map_err(|e| OcrError::Engine(format!("image header read: {e}")))?;
    let (w, h) = reader
        .into_dimensions()
        .map_err(|e| OcrError::Engine(format!("image dimensions: {e}")))?;
    let mp = (w as u64).saturating_mul(h as u64) / 1_000_000;
    if mp > MAX_DECODE_MEGAPIXELS as u64 {
        return Err(OcrError::Engine(format!(
            "image too large: {w}x{h} = {mp} MP exceeds {MAX_DECODE_MEGAPIXELS} MP cap"
        )));
    }
    image::load_from_memory(png_bytes).map_err(|e| OcrError::Engine(format!("image decode: {e}")))
}

/// Extract text from a PNG-encoded image via PaddleOCR PP-OCRv4 (MNN).
/// Returns the concatenated text from all detected text regions, joined
/// by newlines in spatial order (top-to-bottom, left-to-right).
///
/// Errors:
/// - `ModelMissing` — model files absent at `~/.claude/tools/sdlc-knowledge/models/paddleocr/`.
///   Caller falls back to placeholder text via [`image_chunk_text`].
/// - `Engine(...)` — PNG decode failure, dimension cap exceeded, or
///   inference error from ocr-rs. Caller may retry or fall back.
pub fn extract_text_from_image(png_bytes: &[u8]) -> Result<String, OcrError> {
    let image = check_image_size(png_bytes)?;
    ensure_loaded()?;
    let guard = OCR_ENGINE
        .lock()
        .map_err(|_| OcrError::Engine("OCR mutex poisoned".to_string()))?;
    let engine = guard
        .as_ref()
        .expect("engine loaded above by ensure_loaded");
    let results = engine
        .recognize(&image)
        .map_err(|e| OcrError::Engine(format!("recognize: {e}")))?;
    let text = results
        .iter()
        .map(|r| r.text.as_str())
        .collect::<Vec<_>>()
        .join("\n");
    Ok(text)
}

/// Compose the canonical placeholder text for an image chunk when OCR is
/// unavailable or returns empty. The exact byte shape is contract per the
/// plan's Slice 6 done-condition — the benchmark in Slice 10 greps for
/// the literal `[image: figure ` prefix to identify placeholder-derived
/// hits in qualitative samples.
pub fn placeholder_text(figure_idx: usize, doc_basename: &str) -> String {
    format!("[image: figure {figure_idx} from {doc_basename}]")
}

/// Compose the chunk text for an image chunk: prefer OCR'd text if
/// non-empty, otherwise fall back to the canonical placeholder. This is
/// the canonical adapter callers use to populate `chunks.text` for
/// `type='image'` rows.
pub fn image_chunk_text(
    png_bytes: &[u8],
    figure_idx: usize,
    doc_basename: &str,
) -> String {
    match extract_text_from_image(png_bytes) {
        Ok(t) if !t.trim().is_empty() => t,
        _ => placeholder_text(figure_idx, doc_basename),
    }
}
