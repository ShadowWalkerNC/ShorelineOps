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

`scripts/restore-drill.mjs` is a bounded GitHub Linux CI drill for the disposable PostgreSQL 16 service after `npm run test:postgres`. Invoke `node scripts/restore-drill.mjs <job.services.postgres.id>` in that job. It refuses custom Docker endpoints/contexts and requires the synthetic service identity. It runs the scheduled Bash backup, authenticated decryption and a real logical restore into a newly created random database; compares every public table's full-row fingerprints/counts, column/constraint/trigger definitions, resident NPO/allergen versions, EHR approval, tray events and audit records; and exercises restored audit immutability. It deletes only its own newly created restore database and temporary lab files. No production data or provider account is involved.

The emitted duration measures this tiny CI fixture only. It does not establish production recovery time, recovery point, off-host durability, signing-key escrow or clinical acceptance. A source or restore invariant failure fails the job. Current true-run evidence must come from the CI job, not this script's presence or its negative guard check.

Restore into a dedicated disposable PostgreSQL instance using the appropriate PostgreSQL version. Never point a drill at production. Verify schema, representative synthetic records, audit ordering, constraints and application startup; document measured RPO/RTO. Exercise off-host retrieval and separate-key escrow recovery, then verify failed restores cannot replace the running database. Clinical restoration acceptance requires authorized operational review. Passing artifact tests alone does not close these gates.
