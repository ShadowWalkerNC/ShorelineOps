# Encrypted backup and isolated recovery

The scheduled scripts now require encryption before dumping. Build the server first (`npm --prefix server run build`); the CLI reuses the existing SHOR_ENC1 AES-256-GCM implementation. An empty/failed dump, invalid key, failed encryption or existing output path fails without rotation. Rotation only touches encrypted artifacts; migrate historical plaintext copies deliberately rather than silently deleting them.

Generate a random key of at least 32 characters in a separate restricted file. Keep it outside the backup directory and repository, with separate secure escrow for recovery. Unix permissions must be 600; Windows allows only the current owner, Administrators and SYSTEM. Never supply key contents on a command line or use a browser environment variable.

Historical SHOR_ENC1 artifacts may have used 16-character keys. Decryption retains that compatibility for recovery; new backups and preflight reject keys shorter than 32 characters.

- Windows: `powershell -File scripts/backup.ps1 -DbUser <explicit-user> -DbName <explicit-database> -KeyFile <restricted-key-file>`.
- Unix: set explicit `DB_USER`, `DB_NAME`, `BACKUP_KEY_FILE` and run `bash scripts/backup.sh` (or the existing DATABASE_URL fallback).
- Restore artifact: `node scripts/backup-tool.mjs decrypt --key-file <restricted-key-file> <encrypted-artifact> <new-private-output-file>`.

Create a private recovery directory first (Unix 700; equivalent Windows ACL). Decryption authenticates the entire ciphertext before any output is created. Output creation is exclusive and cannot overwrite an existing file. Unix dump artifacts are gzip compressed before encryption; decompress the authenticated recovered `.gz` into that same private directory. Remove temporary recovered plaintext after the drill using platform-native deletion.

The artifact helper currently buffers the complete dump in memory, so provision adequate memory or use a vetted streaming/off-host backup system for large facilities. Encryption is not key escrow, off-host durability, database consistency validation or retention compliance.

## Acceptance still required

Restore into a dedicated disposable PostgreSQL instance using the appropriate PostgreSQL version. Never point a drill at production. Verify schema, representative synthetic records, audit ordering, constraints and application startup; document measured RPO/RTO. Exercise off-host retrieval and separate-key escrow recovery, then verify failed restores cannot replace the running database. Clinical restoration acceptance requires authorized operational review. Passing artifact tests alone does not close these gates.
