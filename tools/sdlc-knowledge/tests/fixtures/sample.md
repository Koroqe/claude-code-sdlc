# SDLC Knowledge Sample Document

This is a fixture file used by the chunker golden test in the sdlc-knowledge crate. The content is deliberately authored to land on exactly eight chunks under the 500/100 sliding-window chunker; modifying the file size will break TC-5.1 and TC-AAI-4. The text mixes prose paragraphs with code fences and headers so the chunker traverses heterogeneous Markdown content.

## Section One

The chunker uses a 500-character sliding window with 100 characters of overlap between adjacent chunks. Adjacent chunks share a 100-character overlap so search snippets crossing chunk boundaries do not strand a query phrase between two chunks. The cursor advances by 400 characters per step.

```rust
fn chunk(text: &str) -> Vec<Chunk> {
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    let mut start = 0usize;
    let mut ord = 0usize;
    while start < chars.len() {
        let end = (start + 500).min(chars.len());
        let slice: String = chars[start..end].iter().collect();
        out.push(Chunk { ord, text: slice });
        ord += 1;
        if end == chars.len() { break; }
        start += 400;
    }
    out
}
```

## Section Two

The store layer wraps rusqlite with FTS5 virtual tables. Each ingest opens a per-document transaction with BEGIN IMMEDIATE, deletes prior chunks for the document id, inserts the new chunks (FTS5 triggers fire), and commits. On any error the transaction drops and rollback is automatic. Fresh ingest of the same file with unchanged sha256 plus mtime is a no-op and prints unchanged: path.

## Section Three

The PDF reader wraps pdf_extract::extract_text inside std::panic::catch_unwind so a malformed PDF raising an internal panic surfaces as IngestError::PdfDecode and the batch loop continues with the next file. A 50 MB byte budget rejects oversize extracts before they hit SQLite. The walker skips symlinks and canonicalizes every discovered path against the project root prefix so escape attempts are dropped with a WARN log. End of fixture body content for chunker test golden.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 
