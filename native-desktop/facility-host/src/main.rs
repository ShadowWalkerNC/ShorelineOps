use axum::{Json, Router, extract::State, http::StatusCode, routing::get};
use serde::Serialize;
use sqlx::{
    SqlitePool,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};
use std::{
    env,
    error::Error,
    fs, io,
    net::{Ipv4Addr, SocketAddrV4},
    path::{Path, PathBuf},
    time::Duration,
};
use tokio::net::TcpListener;

const APPLICATION_ID: i64 = 0x534F_5053;
const SCHEMA_VERSION: i64 = 2;
const API_VERSION: u8 = 1;
const DEFAULT_PORT: u16 = 17_365;
const DATABASE_NAME: &str = "facility.sqlite3";
const USAGE: &str = "Usage: shorelineops-facility-host --data-dir <directory> [--port <port> | --initialize-facility <name>]";

struct Options {
    data_dir: PathBuf,
    port: u16,
    facility_name: Option<String>,
}

impl Options {
    fn from_args() -> Result<Option<Self>, io::Error> {
        let mut args = env::args_os().skip(1);
        let mut data_dir = None;
        let mut port = None;
        let mut facility_name = None;
        let invalid = || io::Error::new(io::ErrorKind::InvalidInput, USAGE);
        while let Some(arg) = args.next() {
            match arg.to_str() {
                Some("--help" | "-h") => return Ok(None),
                Some("--data-dir") if data_dir.is_none() => {
                    data_dir = Some(PathBuf::from(
                        args.next()
                            .filter(|path| !path.is_empty())
                            .ok_or_else(invalid)?,
                    ));
                }
                Some("--port") if port.is_none() => {
                    port = Some(
                        args.next()
                            .and_then(|value| value.to_str()?.parse::<u16>().ok())
                            .ok_or_else(invalid)?,
                    );
                }
                Some("--initialize-facility") if facility_name.is_none() => {
                    facility_name = Some(
                        args.next()
                            .and_then(|value| value.into_string().ok())
                            .ok_or_else(invalid)?,
                    );
                }
                _ => return Err(invalid()),
            }
        }
        if port.is_some() && facility_name.is_some() {
            return Err(invalid());
        }
        Ok(Some(Self {
            data_dir: data_dir.ok_or_else(invalid)?,
            port: port.unwrap_or(DEFAULT_PORT),
            facility_name: facility_name.map(validate_facility_name).transpose()?,
        }))
    }
}

fn validate_facility_name(name: String) -> Result<String, io::Error> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.chars().count() > 120 || name.chars().any(char::is_control) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Facility name must contain 1 to 120 characters and no control characters.",
        ));
    }
    Ok(trimmed.to_owned())
}

async fn open_database(data_dir: &Path) -> Result<SqlitePool, Box<dyn Error>> {
    fs::create_dir_all(data_dir)?;
    let options = SqliteConnectOptions::new()
        .filename(data_dir.join(DATABASE_NAME))
        .create_if_missing(true)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(5));
    let pool = SqlitePoolOptions::new()
        .max_connections(2)
        .acquire_timeout(Duration::from_secs(3))
        .connect_with(options)
        .await?;

    // The writer lock makes initialization atomic even if two starts race.
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    let app_id: i64 = sqlx::query_scalar("PRAGMA application_id")
        .fetch_one(&mut *tx)
        .await?;
    let version: i64 = sqlx::query_scalar("PRAGMA user_version")
        .fetch_one(&mut *tx)
        .await?;

    match (app_id, version) {
        (0, 0) => {
            let empty: bool = sqlx::query_scalar("SELECT NOT EXISTS (SELECT 1 FROM sqlite_schema)")
                .fetch_one(&mut *tx)
                .await?;
            if !empty {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "The facility database path contains an unrelated database.",
                )
                .into());
            }
            sqlx::query(&format!("PRAGMA application_id = {APPLICATION_ID}"))
                .execute(&mut *tx)
                .await?;
        }
        (APPLICATION_ID, 1) => {}
        (APPLICATION_ID, SCHEMA_VERSION) => {}
        _ => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "Unsupported facility database version or database type.",
            )
            .into());
        }
    }
    if version < SCHEMA_VERSION {
        sqlx::query(
            "CREATE TABLE facility (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                name TEXT NOT NULL,
                initialized_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) STRICT",
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query(&format!("PRAGMA user_version = {SCHEMA_VERSION}"))
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(pool)
}

async fn initialize_facility(pool: &SqlitePool, name: &str) -> Result<(), Box<dyn Error>> {
    let result =
        sqlx::query("INSERT INTO facility (id, name) VALUES (1, ?) ON CONFLICT(id) DO NOTHING")
            .bind(name)
            .execute(pool)
            .await?;
    if result.rows_affected() == 0 {
        return Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "This data directory already has a facility.",
        )
        .into());
    }
    Ok(())
}

#[derive(Serialize)]
struct SetupStatus {
    facility_initialized: bool,
}

async fn setup_status(State(pool): State<SqlitePool>) -> Result<Json<SetupStatus>, StatusCode> {
    let facility_initialized = tokio::time::timeout(
        Duration::from_secs(3),
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM facility WHERE id = 1)").fetch_one(&pool),
    )
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    Ok(Json(SetupStatus {
        facility_initialized,
    }))
}

#[derive(Serialize)]
struct Health {
    status: &'static str,
    api_version: u8,
}

async fn health(State(pool): State<SqlitePool>) -> (StatusCode, Json<Health>) {
    let available = matches!(
        tokio::time::timeout(
            Duration::from_secs(3),
            sqlx::query_scalar::<_, i64>("PRAGMA user_version").fetch_one(&pool),
        )
        .await,
        Ok(Ok(SCHEMA_VERSION))
    );
    let (code, status) = if available {
        (StatusCode::OK, "ok")
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, "unavailable")
    };
    (
        code,
        Json(Health {
            status,
            api_version: API_VERSION,
        }),
    )
}

fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/api/v1/health", get(health))
        .route("/api/v1/setup", get(setup_status))
        .with_state(pool)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let Some(options) = Options::from_args()? else {
        println!("{USAGE}");
        return Ok(());
    };
    if let Some(name) = options.facility_name {
        let pool = open_database(&options.data_dir).await?;
        initialize_facility(&pool, &name).await?;
        pool.close().await;
        println!("Facility initialized.");
        return Ok(());
    }
    let listener = TcpListener::bind(SocketAddrV4::new(Ipv4Addr::LOCALHOST, options.port)).await?;
    let pool = open_database(&options.data_dir).await?;

    println!(
        "ShorelineOps facility host listening on http://{}/api/v1/health",
        listener.local_addr()?
    );
    axum::serve(listener, router(pool.clone()))
        .with_graceful_shutdown(async {
            if let Err(error) = tokio::signal::ctrl_c().await {
                eprintln!("Could not install shutdown signal handler: {error}");
            }
        })
        .await?;
    pool.close().await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::Connection;

    #[tokio::test]
    async fn version_one_migrates_and_only_one_initializer_can_claim_it() {
        let data_dir = tempfile::tempdir().unwrap();
        let opts = SqliteConnectOptions::new()
            .filename(data_dir.path().join(DATABASE_NAME))
            .create_if_missing(true);
        let mut connection = sqlx::SqliteConnection::connect_with(&opts).await.unwrap();
        sqlx::query(&format!("PRAGMA application_id = {APPLICATION_ID}"))
            .execute(&mut connection)
            .await
            .unwrap();
        sqlx::query("PRAGMA user_version = 1")
            .execute(&mut connection)
            .await
            .unwrap();
        connection.close().await.unwrap();

        let pool = open_database(data_dir.path()).await.unwrap();
        assert!(
            !setup_status(State(pool.clone()))
                .await
                .unwrap()
                .0
                .facility_initialized
        );
        let (first, second) = tokio::join!(
            initialize_facility(&pool, "First facility"),
            initialize_facility(&pool, "Second facility"),
        );
        assert_ne!(first.is_ok(), second.is_ok());
        pool.close().await;

        let pool = open_database(data_dir.path()).await.unwrap();
        assert!(
            setup_status(State(pool.clone()))
                .await
                .unwrap()
                .0
                .facility_initialized
        );
        let name: String = sqlx::query_scalar("SELECT name FROM facility")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(
            name,
            if first.is_ok() {
                "First facility"
            } else {
                "Second facility"
            }
        );
    }

    #[tokio::test]
    async fn blank_database_keeps_its_identity_across_restart() {
        let data_dir = tempfile::tempdir().unwrap();
        let pool = open_database(data_dir.path()).await.unwrap();
        assert!(data_dir.path().join(DATABASE_NAME).is_file());
        pool.close().await;

        let restarted = open_database(data_dir.path()).await.unwrap();
        let app_id: i64 = sqlx::query_scalar("PRAGMA application_id")
            .fetch_one(&restarted)
            .await
            .unwrap();
        let version: i64 = sqlx::query_scalar("PRAGMA user_version")
            .fetch_one(&restarted)
            .await
            .unwrap();
        assert_eq!((app_id, version), (APPLICATION_ID, SCHEMA_VERSION));
        let (status, Json(payload)) = health(State(restarted.clone())).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(payload.api_version, API_VERSION);

        restarted.close().await;
        assert_eq!(
            health(State(restarted)).await.0,
            StatusCode::SERVICE_UNAVAILABLE
        );
    }

    #[tokio::test]
    async fn existing_unrelated_database_is_rejected() {
        let data_dir = tempfile::tempdir().unwrap();
        let opts = SqliteConnectOptions::new()
            .filename(data_dir.path().join(DATABASE_NAME))
            .create_if_missing(true);
        let mut connection = sqlx::SqliteConnection::connect_with(&opts).await.unwrap();
        sqlx::query("CREATE TABLE unrelated (id INTEGER)")
            .execute(&mut connection)
            .await
            .unwrap();
        connection.close().await.unwrap();

        assert!(open_database(data_dir.path()).await.is_err());
        let mut connection = sqlx::SqliteConnection::connect_with(&opts).await.unwrap();
        let app_id: i64 = sqlx::query_scalar("PRAGMA application_id")
            .fetch_one(&mut connection)
            .await
            .unwrap();
        assert_eq!(app_id, 0);
        connection.close().await.unwrap();
    }
}
