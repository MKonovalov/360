import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import migrationArchive from '../drizzle/migration-archive.json';
import migrationJournal from '../drizzle/meta/_journal.json';
import { validateMigrationArtifacts } from './validate-drizzle-migrations';

function createMigrationFixture(): string {
  const rootDir = mkdtempSync(join(tmpdir(), 'arclumen-drizzle-validator-'));
  const drizzleDir = join(rootDir, 'drizzle');
  const metaDir = join(drizzleDir, 'meta');
  mkdirSync(metaDir, { recursive: true });
  writeFileSync(join(drizzleDir, '0001_initial.sql'), 'select 1;\n');
  writeFileSync(join(drizzleDir, '0007_custom_agent_definition.sql'), 'manual\n');
  const failedSqlPath = join(drizzleDir, 'archive', '0002_failed.sql');
  const failedSnapshotPath = join(drizzleDir, 'archive', '0002_snapshot.failed.json');
  mkdirSync(join(drizzleDir, 'archive'));
  writeFileSync(failedSqlPath, 'failed\n');
  writeFileSync(failedSnapshotPath, JSON.stringify({ id: 'failed', prevId: 'one' }));
  writeFileSync(join(metaDir, '0001_snapshot.json'), JSON.stringify({ id: 'one', prevId: '00000000-0000-0000-0000-000000000000' }));
  writeFileSync(join(metaDir, '_journal.json'), JSON.stringify({
    version: '7',
    dialect: 'postgresql',
    entries: [{ idx: 1, version: '7', when: 1, tag: '0001_initial', breakpoints: true }],
  }));
  writeFileSync(join(drizzleDir, 'migration-baseline.json'), JSON.stringify({
    version: 1,
    outOfBand: [{
      path: 'drizzle/0007_custom_agent_definition.sql',
      sha256: 'cd60ed2fa8c947cb05cb57b23884dea9390e4b6aec0add666e69bf842fc68da0',
      status: 'manual-applied',
      reason: 'Applied and verified out of band before migration tracking was added.',
    }],
  }));
  const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
  writeFileSync(join(drizzleDir, 'migration-archive.json'), JSON.stringify({
    version: 1,
    failed: [{
      sourceTag: '0002_failed',
      sqlPath: 'drizzle/archive/0002_failed.sql',
      sqlSha256: sha256(failedSqlPath),
      snapshotPath: 'drizzle/archive/0002_snapshot.failed.json',
      snapshotSha256: sha256(failedSnapshotPath),
      status: 'failed-not-applied',
      reason: 'Test fixture failed migration.',
    }],
  }));
  return rootDir;
}

describe('validateMigrationArtifacts', () => {
  it('keeps failed 0002 archived and 0008 active', () => {
    const result = validateMigrationArtifacts(process.cwd());
    const failed0002 = migrationArchive.failed.find(
      (entry) => entry.sourceTag === '0002_phase33_34_correction',
    );
    const active0008 = migrationJournal.entries.find(
      (entry) => entry.tag === '0008_phase33_34_packet_review_forward_repair',
    );

    expect(result.errors).toEqual([]);
    expect(failed0002).toMatchObject({
      sqlPath: 'drizzle/archive/0002_phase33_34_correction.failed.sql',
      snapshotPath: 'drizzle/archive/0002_snapshot.failed.json',
      status: 'failed-not-applied',
    });
    expect(active0008).toMatchObject({
      idx: 2,
      tag: '0008_phase33_34_packet_review_forward_repair',
    });
  });

  it('accepts the documented out-of-band baseline exception', () => {
    const rootDir = createMigrationFixture();

    const result = validateMigrationArtifacts(rootDir);

    expect(result.errors).toEqual([]);
  });

  it('rejects a SQL artifact that is absent from the journal and baseline', () => {
    const rootDir = createMigrationFixture();
    writeFileSync(join(rootDir, 'drizzle', '0009_untracked.sql'), 'select 9;\n');

    const result = validateMigrationArtifacts(rootDir);

    expect(result.errors).toContain('SQL migration 0009_untracked is not represented in the journal or baseline manifest');
  });
});
