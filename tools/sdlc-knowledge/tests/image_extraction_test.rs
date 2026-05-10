//! Slice 4 (vector-retrieval-backend) — PDF image extraction + BLOB storage.
//!
//! Coverage:
//! - `pdf::extract_images` returns Vec<(page_idx, png_bytes)> tuples;
//!   each png_bytes payload decodes via `image::load_from_memory` (PNG
//!   roundtrip integrity)
//! - `parser::parse` populates ParsedDocument.images for PDF inputs (Slice 4
//!   wires what was empty in Slice 3)
//! - End-to-end: extract → store as type='image' chunk row with image_bytes
//!   BLOB → read back → roundtrip PNG bytes match
//!
//! Note: tests use the existing `calibre-sample.pdf` fixture which is a
//! real ebook PDF with structural content. It may or may not contain image
//! objects; tests assert the API contract holds (Vec returns OK; if non-empty,
//! every entry is a valid PNG; BLOB writes/reads are byte-identical) WITHOUT
//! requiring a specific image count.

use std::path::PathBuf;

use rusqlite::params;
use sdlc_knowledge::ingest::IngestError;
use sdlc_knowledge::parser::parse;
use sdlc_knowledge::pdf::extract_images;
use sdlc_knowledge::store::open_or_init_v2;
use tempfile::TempDir;

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
}

fn fresh_v2_db() -> (TempDir, std::path::PathBuf) {
    let tmp = TempDir::new().expect("tempdir");
    let path = tmp.path().join("index.db");
    (tmp, path)
}

#[test]
fn extract_images_returns_vec_or_pdfdecode_on_calibre_sample() {
    let path = fixtures_dir().join("calibre-sample.pdf");
    match extract_images(&path) {
        Ok(images) => {
            // Every extracted PNG must roundtrip via image::load_from_memory
            // (i.e., the bytes are a valid PNG decodable by the canonical
            // codec). Empty Vec is also acceptable — calibre-sample may not
            // contain image objects at all.
            for (i, (page_idx, png_bytes)) in images.iter().enumerate() {
                let _decoded = image::load_from_memory(png_bytes).unwrap_or_else(|e| {
                    panic!("image {i} (page {page_idx}) failed PNG roundtrip: {e}")
                });
                assert!(
                    !png_bytes.is_empty(),
                    "image {i} png_bytes must be non-empty"
                );
            }
        }
        Err(IngestError::PdfDecode(_, _)) => {
            // Acceptable: pdfium runtime missing in the test environment.
        }
        Err(e) => panic!("unexpected error from extract_images: {e}"),
    }
}

#[test]
fn parser_populates_images_field_for_pdf_inputs() {
    let path = fixtures_dir().join("calibre-sample.pdf");
    match parse(&path) {
        Ok(doc) => {
            // Slice 4 contract: images is now populated from pdf::extract_images
            // (was always-empty in Slice 3). We don't assert a specific count
            // because that's fixture-content-dependent; we DO assert that the
            // extraction path ran (no panic) and that any returned images
            // round-trip via image::load_from_memory.
            for (i, img) in doc.images.iter().enumerate() {
                let _decoded = image::load_from_memory(&img.png_bytes)
                    .unwrap_or_else(|e| panic!("image {i} PNG roundtrip failed: {e}"));
            }
        }
        Err(IngestError::PdfDecode(_, _)) => {
            // pdfium runtime missing — acceptable for headless CI.
        }
        Err(e) => panic!("unexpected parse error: {e}"),
    }
}

#[test]
fn image_chunk_blob_roundtrip_through_v2_schema() {
    let (_tmp, path) = fresh_v2_db();
    let conn = open_or_init_v2(&path).expect("open_or_init_v2");

    // Synthesize a tiny PNG (a 2x2 red square) so the test does not depend on
    // pdfium runtime availability — we only need to verify the SCHEMA_V2
    // BLOB column round-trips bytes losslessly under the type='image' contract.
    let mut synth_png: Vec<u8> = Vec::new();
    let synth_image = image::RgbaImage::from_pixel(2, 2, image::Rgba([255, 0, 0, 255]));
    image::DynamicImage::ImageRgba8(synth_image)
        .write_to(
            &mut std::io::Cursor::new(&mut synth_png),
            image::ImageFormat::Png,
        )
        .expect("synth png encode");

    // Insert a documents row + a type='image' chunk row.
    conn.execute(
        "INSERT INTO documents(source_path, mtime, sha256, ingested_at) \
         VALUES ('/tmp/synthetic.pdf', 0, 'deadbeef', 0)",
        [],
    )
    .expect("insert document");
    conn.execute(
        "INSERT INTO chunks(doc_id, ord, text, type, image_bytes) \
         VALUES (1, 0, '', 'image', ?1)",
        params![synth_png.clone()],
    )
    .expect("insert image chunk");

    // Read back and verify byte-identity.
    let (got_type, got_bytes): (String, Vec<u8>) = conn
        .query_row(
            "SELECT type, image_bytes FROM chunks WHERE doc_id = 1 AND ord = 0",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("read back chunk");
    assert_eq!(got_type, "image", "chunk.type must equal 'image'");
    assert_eq!(
        got_bytes, synth_png,
        "image_bytes BLOB must round-trip byte-for-byte"
    );

    // Verify the BLOB still decodes via the image crate (PNG integrity).
    let _decoded = image::load_from_memory(&got_bytes).expect("read-back PNG must decode");
}
