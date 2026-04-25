# SQL injection-shaped filename fixture

This file's name contains the literal string `'; DROP TABLE documents; --` to verify that all SQL writes use parameterized statements. After ingest, the documents table MUST still exist and the source_path column MUST contain the literal filename verbatim.
