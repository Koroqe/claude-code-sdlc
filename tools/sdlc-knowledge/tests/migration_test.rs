//! Slice 2 (vector-retrieval-backend) — v1→v2 destructive migration tests.
//!
//! Coverage:
//! - TC-VR-3.2: opening v1 fixture DB triggers migration prompt path
//! - TC-VR-3.3: `CLAUDEKNOWS_AUTO_REINGEST=1` env var skips prompt and migrates
//! - Headless without env var: migration declined (default-deny)
//! - Already-v2 DB: AlreadyV2 outcome, no-op
//! - Fresh DB (no schema_version row): Fresh outcome, no-op (caller initializes)

use std::sync::Mutex;

use sdlc_knowledge::migrations::{current_version, migrate_v1_to_v2, MigrationOutcome};
use sdlc_knowledge::store::{open_or_init, open_or_init_v2};
use tempfile::TempDir;

// Tests serialize on env-var manipulation (CLAUDEKNOWS_AUTO_REINGEST is process-global).
static ENV_MUTEX: Mutex<()> = Mutex::new(());

fn fresh_v1_db() -> (TempDir, std::path::PathBuf) {
    let tmp = TempDir::new().expect("tempdir");
    let path = tmp.path().join("index.db");
    // open_or_init applies SCHEMA_V1 but does NOT stamp schema_version.
    // Stamp version=1 manually so this looks like a real iter-1 DB.
    let conn = open_or_init(&path).expect("v1 init");
    conn.execute(
        "INSERT INTO schema_version(version) VALUES (?1)",
        rusqlite::params![1i64],
    )
    .expect("stamp v1");
    drop(conn);
    (tmp, path)
}

#[test]
fn migrate_v1_to_v2_with_auto_reingest_env_succeeds() {
    let _guard = ENV_MUTEX.lock().unwrap();
    let saved = std::env::var_os("CLAUDEKNOWS_AUTO_REINGEST");
    // SAFETY: single-threaded mutation behind ENV_MUTEX guard.
    unsafe {
        std::env::set_var("CLAUDEKNOWS_AUTO_REINGEST", "1");
    }

    let (_tmp, path) = fresh_v1_db();
    let mut conn = rusqlite::Connection::open(&path).expect("open v1 db");
    let outcome = migrate_v1_to_v2(&mut conn).expect("migrate");

    // Restore env BEFORE asserting (so panicking assertions don't leak state).
    unsafe {
        if let Some(v) = saved {
            std::env::set_var("CLAUDEKNOWS_AUTO_REINGEST", v);
        } else {
            std::env::remove_var("CLAUDEKNOWS_AUTO_REINGEST");
        }
    }

    assert_eq!(outcome, MigrationOutcome::Migrated, "expected Migrated");
    // After migration, schema_version row is empty (deleted) — caller re-runs
    // open_or_init_v2 to apply v2 schema and stamp version=2.
    let v_after_migrate = current_version(&conn);
    assert_eq!(
        v_after_migrate, 0,
        "schema_version row should be cleared post-migration; got {v_after_migrate}"
    );
    drop(conn);

    // Verify the canonical re-init flow: open_or_init_v2 sees fresh-DB shape
    // (no schema_version row), applies SCHEMA_V2_DELTA, stamps version=2.
    let conn2 = open_or_init_v2(&path).expect("re-open v2");
    let v: i64 = conn2
        .query_row("SELECT version FROM schema_version", [], |r| r.get(0))
        .expect("v2 stamp");
    // open_or_init_v2 now applies SCHEMA_V2_DELTA + SCHEMA_V3_DELTA on a
    // fresh DB and stamps version=3 (Slice 12 page-level addressing).
    assert_eq!(v, 3, "post-migration re-init should stamp version=3");
}

#[test]
fn migrate_v1_to_v2_headless_without_env_declines() {
    let _guard = ENV_MUTEX.lock().unwrap();
    let saved = std::env::var_os("CLAUDEKNOWS_AUTO_REINGEST");
    unsafe {
        std::env::remove_var("CLAUDEKNOWS_AUTO_REINGEST");
    }

    let (_tmp, path) = fresh_v1_db();
    let mut conn = rusqlite::Connection::open(&path).expect("open v1 db");
    let outcome = migrate_v1_to_v2(&mut conn).expect("migrate (declined path)");

    // Restore env.
    unsafe {
        if let Some(v) = saved {
            std::env::set_var("CLAUDEKNOWS_AUTO_REINGEST", v);
        }
    }

    // cargo test runs without TTY → confirm_destructive_migration default-denies.
    assert_eq!(outcome, MigrationOutcome::Declined, "expected Declined");
    // schema_version row still says 1 (no destructive action ran).
    let v = current_version(&conn);
    assert_eq!(v, 1, "schema_version should remain 1 when migration declined");
}

#[test]
fn migrate_already_v2_returns_already_v2() {
    let (_tmp, path) = fresh_v1_db();
    // Manually stamp version=2 to simulate an already-migrated DB.
    {
        let conn = rusqlite::Connection::open(&path).expect("open");
        conn.execute("UPDATE schema_version SET version = 2", [])
            .expect("set v2");
    }
    let mut conn = rusqlite::Connection::open(&path).expect("open");
    let outcome = migrate_v1_to_v2(&mut conn).expect("migrate");
    assert_eq!(outcome, MigrationOutcome::AlreadyV2);
}

#[test]
fn migrate_fresh_db_returns_fresh() {
    let tmp = TempDir::new().expect("tempdir");
    let path = tmp.path().join("index.db");
    // Open a raw connection without any schema → schema_version row absent.
    let conn_init = rusqlite::Connection::open(&path).expect("open");
    conn_init
        .execute("CREATE TABLE schema_version(version INTEGER NOT NULL)", [])
        .expect("create empty schema_version");
    drop(conn_init);

    let mut conn = rusqlite::Connection::open(&path).expect("re-open");
    let outcome = migrate_v1_to_v2(&mut conn).expect("migrate");
    assert_eq!(
        outcome,
        MigrationOutcome::Fresh,
        "empty schema_version should report Fresh"
    );
}
