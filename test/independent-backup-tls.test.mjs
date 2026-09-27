import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const runner = resolve('scripts/independent-postgres-backup.mjs');

test('pg_dump uses libpq TLS mode rather than unsupported CLI flag', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'backup-tls-test-'));
  try {
    const bin = join(dir, 'bin');
    const marker = join(dir, 'pg-dump-observed');
    await mkdir(bin);
    await writeFile(join(bin, 'aws'), '#!/bin/sh\nprintf \'%s\\n\' \'{"host":"fixture.invalid","username":"fixture","password":"fixture-only"}\'\n', { mode: 0o755 });
    await writeFile(join(bin, 'pg_dump'), '#!/bin/sh\nfor arg in "$@"; do [ "$arg" != "--sslmode=require" ] || exit 91; done\n[ "$PGSSLMODE" = "require" ] || exit 92\nprintf "TLS mode passed\\n" > "$BACKUP_TLS_MARKER"\nexit 99\n', { mode: 0o755 });
    const result = spawnSync(process.execPath, [runner, 'create'], {
      cwd: resolve('.'), encoding: 'utf8',
      env: {
        PATH: `${bin}:${process.env.PATH}`, HOME: dir,
        BACKUP_DB_SECRET_ID: 'fixture-id', BACKUP_OUTPUT_DIR: join(dir, 'output'),
        BACKUP_SOURCE_INSTANCE: 'fixture', BACKUP_MIGRATION_REVISION: 'test',
        BACKUP_ENCRYPTION_KEY_ID: 'test-key', BACKUP_S3_URI: 's3://fixture-bucket/backups',
        BACKUP_TLS_MARKER: marker
      }
    });
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stderr.includes('pg_dump exited 91'), false, result.stderr);
    assert.equal(await readFile(marker, 'utf8'), 'TLS mode passed\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});