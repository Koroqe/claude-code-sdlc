//! Slice 1 tests for the pdfium-render integration.
//!
//! Coverage:
//! - TC-AAI-1 (Cargo.toml grep — `pdf-extract` removed, `pdfium-render` present)
//! - TC-SEC-2.1 (panic during pdfium extraction is contained as IngestError::PdfDecode)
//! - TC-SEC-2.3 (HOME unset → IngestError, no panic, no silent CWD-fallback)
//! - TC-SEC-2.4 (world-writable pdfium/lib dir → IngestError, refuse to load)
//! - TC-SEC-2.5 (FORBIDDEN-symbol grep — `bind_to_system_library` is NOT used in src/pdf.rs)
//! - TC-SEC-2.6 (subprocess env-var hijack on macOS SIP — env-cleared child still loads
//!   from canonical path; gated `#[ignore]` until Slice 3 installs pdfium)
//! - TC-SEC-2.7 (corrupt.pdf yields per-document IngestError, not panic)
//! - TC-FR-6.2 (calibre-sample fixture round-trip — ≥ 1 000 chars, alphabetic word
//!   ≥ 5 chars present; gated `#[ignore]` until Slice 3 installs pdfium)
//!
//! See `.claude/scratchpad.md` "Phase 1.5 Pre-Review Findings" for the
//! security-auditor remediation list this file codifies.

use std::path::PathBuf;

use sdlc_knowledge::ingest::IngestError;
use sdlc_knowledge::pdf::{extract_via_closure_for_test, read};

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
}

fn manifest_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

// ---------------------------------------------------------------------------
// TC-SEC-2.5 — FORBIDDEN-symbol grep on src/pdf.rs.
//
// Architect STRUCTURAL action item #1: `Pdfium::bind_to_system_library` and
// `Pdfium::bind_to_statically_linked_library` are forbidden because they
// open the LD_LIBRARY_PATH / DYLD_LIBRARY_PATH hijack surface. Only the
// explicit-path API `bind_to_library(<absolute-path>)` is allowed.
// ---------------------------------------------------------------------------

#[test]
fn pdf_rs_does_not_use_bind_to_system_library() {
    let pdf_rs = manifest_dir().join("src").join("pdf.rs");
    let body = std::fs::read_to_string(&pdf_rs).expect("read src/pdf.rs");
    assert!(
        !body.contains("bind_to_system_library"),
        "src/pdf.rs MUST NOT reference Pdfium::bind_to_system_library \
         (architect STRUCTURAL action item #1 — eliminates LD_LIBRARY_PATH \
         / DYLD_LIBRARY_PATH hijack)"
    );
    assert!(
        !body.contains("bind_to_statically_linked_library"),
        "src/pdf.rs MUST NOT reference Pdfium::bind_to_statically_linked_library \
         (iter-2 dynamic-load contract; static linking is out of scope)"
    );
}

// ---------------------------------------------------------------------------
// TC-AAI-1 — Cargo.toml dep swap is grep-verifiable.
// ---------------------------------------------------------------------------

#[test]
fn cargo_toml_pdf_extract_removed_pdfium_render_added() {
    let cargo = manifest_dir().join("Cargo.toml");
    let body = std::fs::read_to_string(&cargo).expect("read Cargo.toml");

    // Match a real dep declaration, not a comment mention. The dep declaration
    // form is `<name> = "..."` at the start of a line (allowing only
    // whitespace before the name).
    let has_pdf_extract_dep = body
        .lines()
        .any(|l| l.trim_start().starts_with("pdf-extract") && l.contains('='));
    assert!(
        !has_pdf_extract_dep,
        "Cargo.toml MUST NOT declare `pdf-extract` (FR-2.1 dep removal)"
    );

    let has_pdfium_render_dep = body
        .lines()
        .any(|l| l.trim_start().starts_with("pdfium-render") && l.contains('='));
    assert!(
        has_pdfium_render_dep,
        "Cargo.toml MUST declare `pdfium-render` (FR-2.1 dep addition)"
    );
}

// ---------------------------------------------------------------------------
// TC-SEC-2.1 — Panic during extraction is contained as IngestError::PdfDecode.
//
// `extract_via_closure_for_test` exposes the catch_unwind boundary. We inject
// a panicking closure and assert that the panic is mapped to an IngestError
// with the iter-2 panic-category message ("panic during pdfium-render
// extraction") instead of unwinding into the caller.
// ---------------------------------------------------------------------------

#[test]
fn extract_panic_contained_as_pdf_decode_error() {
    // Use an existing fixture so std::fs::read inside extract_via_closure
    // succeeds and the panicking closure is actually reached.
    let path = fixtures_dir().join("sample.pdf");
    let result = extract_via_closure_for_test(&path, |_bytes| -> Result<String, String> {
        panic!("simulated panic from inside pdfium-render");
    });

    let err = result.expect_err("panicking closure must yield Err");
    let msg = format!("{err}");
    assert!(
        msg.contains("panic during pdfium-render extraction"),
        "expected PdfDecode with iter-2 panic-category message; got: {msg}"
    );
}

// ---------------------------------------------------------------------------
// TC-SEC-2.3 — HOME unset → IngestError::PdfDecode, no panic, no silent
// CWD-fallback.
//
// Security-auditor HIGH remediation #1: `std::env::var("HOME").unwrap_or_default()`
// would silently coerce a missing HOME to the empty string and resolve a
// CWD-relative library path, opening a hijack surface. We must reject the
// missing-HOME case explicitly.
//
// Note: Rust `std::env::set_var` is unsafe in 2024 edition for multi-threaded
// programs. We use `std::env::remove_var` only inside this single-threaded
// test process (cargo runs each #[test] in its own thread but we restore HOME
// before yielding). For robustness we serialize HOME mutations behind a Mutex.
// ---------------------------------------------------------------------------

use std::sync::Mutex;
static HOME_MUTEX: Mutex<()> = Mutex::new(());

#[test]
fn home_unset_returns_pdf_decode_error_not_panic() {
    let _guard = HOME_MUTEX.lock().unwrap();
    let saved = std::env::var_os("HOME");
    // SAFETY: single-threaded mutation via HOME_MUTEX serialization.
    unsafe {
        std::env::remove_var("HOME");
    }

    let pdf_path = fixtures_dir().join("calibre-sample.pdf");
    let result = read(&pdf_path);

    // Restore HOME before any assertion that could panic.
    if let Some(h) = saved {
        // SAFETY: single-threaded restore inside the same guard.
        unsafe {
            std::env::set_var("HOME", h);
        }
    }

    let err = result.expect_err("HOME unset must yield Err");
    let msg = format!("{err}");
    assert!(
        msg.contains("HOME"),
        "expected error message to mention HOME; got: {msg}"
    );
    // Verify we got the typed IngestError::PdfDecode, not some other variant.
    match err {
        IngestError::PdfDecode(_, _) => {}
        other => panic!("expected IngestError::PdfDecode; got {other:?}"),
    }
}

// ---------------------------------------------------------------------------
// TC-SEC-2.4 — World-writable pdfium/lib dir → IngestError, refuse to load.
//
// Security-auditor HIGH remediation #2: directory-mode safety check on
// `~/.claude/tools/sdlc-knowledge/pdfium/lib/` rejects mode bits with the
// world-writable bit set (`mode & 0o002`). Mitigates TOCTOU swap between
// canonicalize and dlopen.
//
// We point HOME at a temp dir and create
// `<tmp>/.claude/tools/sdlc-knowledge/pdfium/lib/` with mode 0o777.
// ---------------------------------------------------------------------------

#[test]
fn world_writable_lib_dir_rejected() {
    let _guard = HOME_MUTEX.lock().unwrap();
    let saved = std::env::var_os("HOME");

    let tmp = tempfile::tempdir().expect("tempdir");
    let lib_dir = tmp
        .path()
        .join(".claude")
        .join("tools")
        .join("sdlc-knowledge")
        .join("pdfium")
        .join("lib");
    std::fs::create_dir_all(&lib_dir).expect("create lib dir");

    // chmod 0o777 (world-writable).
    use std::os::unix::fs::PermissionsExt;
    let mut perms = std::fs::metadata(&lib_dir).unwrap().permissions();
    perms.set_mode(0o777);
    std::fs::set_permissions(&lib_dir, perms).expect("chmod 0777");

    // SAFETY: single-threaded mutation via HOME_MUTEX serialization.
    unsafe {
        std::env::set_var("HOME", tmp.path());
    }

    let pdf_path = fixtures_dir().join("calibre-sample.pdf");
    let result = read(&pdf_path);

    // Restore HOME first.
    if let Some(h) = saved {
        unsafe {
            std::env::set_var("HOME", h);
        }
    } else {
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    let err = result.expect_err("world-writable lib dir must yield Err");
    let msg = format!("{err}");
    assert!(
        msg.contains("world-writable"),
        "expected error message to mention 'world-writable'; got: {msg}"
    );
    match err {
        IngestError::PdfDecode(_, _) => {}
        other => panic!("expected IngestError::PdfDecode; got {other:?}"),
    }
}

// ---------------------------------------------------------------------------
// TC-SEC-2.7 — corrupt.pdf yields a per-document IngestError, not a panic.
//
// The existing iter-1 corrupt.pdf fixture (100 bytes, header-only) must still
// fail gracefully under pdfium-render. Since this test depends on the pdfium
// dynamic library being installed, it is gated `#[ignore]` until Slice 3
// runs `bash install.sh --yes`.
// ---------------------------------------------------------------------------

#[test]
#[ignore = "requires pdfium dynamic library installed by Slice 3 (bash install.sh --yes)"]
fn corrupt_pdf_returns_per_doc_pdf_decode_error() {
    let pdf_path = fixtures_dir().join("corrupt.pdf");
    let result = read(&pdf_path);
    let err = result.expect_err("corrupt.pdf must yield Err");
    match err {
        IngestError::PdfDecode(_, _) => {}
        other => panic!("expected IngestError::PdfDecode for corrupt.pdf; got {other:?}"),
    }
}

// ---------------------------------------------------------------------------
// TC-FR-6.2 — calibre-sample.pdf round-trip: extracts ≥ 1 000 chars including
// at least one alphabetic word ≥ 5 characters. Demonstrates pdfium handles
// the calibre Type0/CID-font failure mode that defeated `pdf-extract` in
// iter-1.
//
// Gated `#[ignore]` until Slice 3 installs the pdfium dynamic library.
// ---------------------------------------------------------------------------

#[test]
#[ignore = "requires pdfium dynamic library installed by Slice 3 (bash install.sh --yes)"]
fn calibre_fixture_roundtrip_extracts_real_text() {
    let pdf_path = fixtures_dir().join("calibre-sample.pdf");
    assert!(
        pdf_path.exists(),
        "calibre-sample.pdf fixture missing at {}",
        pdf_path.display()
    );

    let text = read(&pdf_path).expect("calibre-sample.pdf must extract OK");
    assert!(
        text.chars().count() >= 1000,
        "expected ≥ 1 000 chars from calibre fixture; got {} chars: {:?}",
        text.chars().count(),
        text.chars().take(80).collect::<String>()
    );
    let has_long_word = text
        .split(|c: char| !c.is_alphabetic())
        .any(|w| w.chars().count() >= 5);
    assert!(
        has_long_word,
        "expected at least one alphabetic word ≥ 5 chars in calibre fixture extract"
    );
}

// ---------------------------------------------------------------------------
// TC-SEC-2.6 — subprocess env-var hijack mitigation.
//
// Run a child `sdlc-knowledge ingest <calibre-sample.pdf>` with
// `DYLD_LIBRARY_PATH=/tmp/empty-bogus` and `LD_LIBRARY_PATH=/tmp/empty-bogus`
// in the child's env. The explicit-path `bind_to_library(<absolute-canonical>)`
// in pdf.rs uses dlopen with an absolute path, which by libloading/dlopen
// contract bypasses LD_LIBRARY_PATH / DYLD_LIBRARY_PATH lookup. Therefore the
// child must succeed exit 0, proving the hijack vector is closed.
//
// Gated `#[ignore]` until Slice 3 installs the pdfium dynamic library.
// ---------------------------------------------------------------------------

#[test]
#[ignore = "requires pdfium dynamic library installed by Slice 3 (bash install.sh --yes)"]
fn subprocess_env_var_hijack_does_not_redirect_pdfium() {
    use std::process::Command;
    let bin = env!("CARGO_BIN_EXE_sdlc-knowledge");
    let pdf_path = fixtures_dir().join("calibre-sample.pdf");
    let tmp = tempfile::tempdir().expect("tempdir");

    let home = std::env::var("HOME").expect("HOME");

    let output = Command::new(bin)
        .env_clear()
        .env("HOME", &home)
        .env("PATH", "/usr/bin:/bin")
        .env("DYLD_LIBRARY_PATH", "/tmp/empty-bogus-pdfium-test")
        .env("LD_LIBRARY_PATH", "/tmp/empty-bogus-pdfium-test")
        .arg("ingest")
        .arg(&pdf_path)
        .arg("--project-root")
        .arg(tmp.path())
        .output()
        .expect("spawn sdlc-knowledge");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "expected child to exit 0 despite hostile DYLD_LIBRARY_PATH; \
         stdout=\n{stdout}\nstderr=\n{stderr}"
    );
}
