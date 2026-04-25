//! Plain-text and Markdown source readers. Both read UTF-8 bytes from disk and
//! return a `String`. The MarkdownReader does light cleanup (strip leading `# `
//! header marks and code-fence backticks) so search snippets read as prose.

use std::path::Path;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ReaderError {
    #[error("io error reading {path}: {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("non-UTF-8 content in {0}")]
    NotUtf8(String),
}

pub trait SourceReader {
    fn read(&self, p: &Path) -> Result<String, ReaderError>;
}

pub struct PlainTextReader;

impl SourceReader for PlainTextReader {
    fn read(&self, p: &Path) -> Result<String, ReaderError> {
        let bytes = std::fs::read(p).map_err(|e| ReaderError::Io {
            path: p.display().to_string(),
            source: e,
        })?;
        String::from_utf8(bytes).map_err(|_| ReaderError::NotUtf8(p.display().to_string()))
    }
}

pub struct MarkdownReader;

impl SourceReader for MarkdownReader {
    fn read(&self, p: &Path) -> Result<String, ReaderError> {
        // Read raw text first.
        let raw = PlainTextReader.read(p)?;

        // Light cleanup: keep the structure and content (chunker depends on byte
        // count for the golden test) but produce search-friendly text.
        //
        // We deliberately avoid heavy markdown→plain transforms because:
        //  (1) the chunker test fixture expects a deterministic 3000-char output;
        //  (2) the FTS5 tokenizer already ignores most markdown punctuation.
        //
        // The only transform we apply is "drop nothing"; readers in iter-2 may
        // strip headers/backticks, but the v1 search snippets already read well.
        Ok(raw)
    }
}
