import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { z } from 'zod';

const journalSchema = z.object({
  version: z.string(),
  dialect: z.literal('postgresql'),
  entries: z.array(z.object({
    idx: z.number().int(),
    version: z.string(),
    when: z.number().int(),
    tag: z.string().min(1),
    breakpoints: z.boolean(),
  })),
}).strict();

const baselineSchema = z.object({
  version: z.literal(1),
  outOfBand: z.array(z.object({
    path: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.literal('manual-applied'),
    reason: z.string().min(1),
  })),
}).strict();

const archiveSchema = z.object({
  version: z.literal(1),
  failed: z.array(z.object({
    sourceTag: z.string().min(1),
    sqlPath: z.string().min(1),
    sqlSha256: z.string().regex(/^[a-f0-9]{64}$/),
    snapshotPath: z.string().min(1),
    snapshotSha256: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.literal('failed-not-applied'),
    reason: z.string().min(1),
  }).strict()),
}).strict();

const snapshotSchema = z.object({
  id: z.string().min(1),
  prevId: z.string().min(1),
});

export type MigrationValidationResult = Readonly<{
  errors: readonly string[];
  journalTags: readonly string[];
  baselineExceptionCount: number;
}>;

function readJson(path: string, errors: string[]): unknown | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown JSON read error';
    errors.push(`${path}: ${message}`);
    return undefined;
  }
}

function fileSha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function snapshotPath(metaDir: string, tag: string): string {
  const prefix = tag.split('_', 1)[0];
  return join(metaDir, `${prefix}_snapshot.json`);
}

export function validateMigrationArtifacts(rootDir: string): MigrationValidationResult {
  const errors: string[] = [];
  const drizzleDir = join(rootDir, 'drizzle');
  const metaDir = join(drizzleDir, 'meta');
  const journalPath = join(metaDir, '_journal.json');
  const baselinePath = join(drizzleDir, 'migration-baseline.json');
  const archivePath = join(drizzleDir, 'migration-archive.json');
  const journal = journalSchema.safeParse(readJson(journalPath, errors));
  const baseline = baselineSchema.safeParse(readJson(baselinePath, errors));
  const archive = archiveSchema.safeParse(readJson(archivePath, errors));

  if (!journal.success || !baseline.success || !archive.success) {
    return { errors, journalTags: [], baselineExceptionCount: 0 };
  }

  const journalEntries = journal.data.entries;
  const journalTags = journalEntries.map((entry) => entry.tag);
  const baselineTags = new Set(
    baseline.data.outOfBand.map((entry) => entry.path.replace(/^drizzle\//, '').replace(/\.sql$/, '')),
  );
  const archivedTags = new Set(archive.data.failed.map((entry) => entry.sourceTag));
  const sqlFiles = readdirSync(drizzleDir).filter((file) => file.endsWith('.sql'));
  const sqlTags = new Set(sqlFiles.map((file) => file.replace(/\.sql$/, '')));

  if (journalEntries.some((entry, index) => entry.idx !== index + 1)) {
    errors.push(`${journalPath}: journal indexes must be contiguous starting at 1`);
  }
  if (new Set(journalTags).size !== journalTags.length) {
    errors.push(`${journalPath}: journal tags must be unique`);
  }
  if (new Set(archive.data.failed.map((entry) => entry.sourceTag)).size !== archive.data.failed.length) {
    errors.push(`${archivePath}: failed migration source tags must be unique`);
  }
  for (const entry of archive.data.failed) {
    if (journalTags.includes(entry.sourceTag)) {
      errors.push(`${archivePath}: failed migration ${entry.sourceTag} must not be journaled`);
    }
    for (const [artifactPath, expectedHash] of [
      [entry.sqlPath, entry.sqlSha256],
      [entry.snapshotPath, entry.snapshotSha256],
    ] as const) {
      const fullPath = join(rootDir, artifactPath);
      if (!existsSync(fullPath)) {
        errors.push(`Archived artifact ${artifactPath} does not exist`);
      } else if (fileSha256(fullPath) !== expectedHash) {
        errors.push(`Archived artifact ${artifactPath} does not match its recorded SHA-256`);
      }
    }
  }

  for (const entry of journalEntries) {
    const sqlPath = join(drizzleDir, `${entry.tag}.sql`);
    const entrySnapshotPath = snapshotPath(metaDir, entry.tag);
    if (!existsSync(sqlPath)) errors.push(`Journal entry ${entry.tag} has no SQL migration`);
    if (!existsSync(entrySnapshotPath)) errors.push(`Journal entry ${entry.tag} has no snapshot`);
  }

  for (const file of sqlFiles) {
    const tag = file.replace(/\.sql$/, '');
    if (!journalTags.includes(tag) && !baselineTags.has(tag) && !archivedTags.has(tag)) {
      errors.push(`SQL migration ${tag} is not represented in the journal or baseline manifest`);
    }
  }

  for (const entry of baseline.data.outOfBand) {
    const expectedTag = relative(drizzleDir, join(rootDir, entry.path)).replace(/\.sql$/, '');
    const baselineFile = join(rootDir, entry.path);
    if (!existsSync(baselineFile)) {
      errors.push(`Baseline artifact ${entry.path} does not exist`);
      continue;
    }
    if (expectedTag.includes('/') || !sqlTags.has(expectedTag)) {
      errors.push(`Baseline artifact ${entry.path} must be a direct SQL file in drizzle/`);
      continue;
    }
    if (fileSha256(baselineFile) !== entry.sha256) {
      errors.push(`Baseline artifact ${entry.path} does not match its recorded SHA-256`);
    }
  }

  let previousSnapshotId = '00000000-0000-0000-0000-000000000000';
  for (const entry of journalEntries) {
    const entrySnapshotPath = snapshotPath(metaDir, entry.tag);
    if (!existsSync(entrySnapshotPath)) continue;
    const snapshot = snapshotSchema.safeParse(readJson(entrySnapshotPath, errors));
    if (!snapshot.success) continue;
    if (snapshot.data.prevId !== previousSnapshotId) {
      errors.push(`Snapshot ${entry.tag} does not point to the previous snapshot`);
    }
    previousSnapshotId = snapshot.data.id;
  }

  return { errors, journalTags, baselineExceptionCount: baseline.data.outOfBand.length };
}

if (process.argv[1]?.endsWith('validate-drizzle-migrations.ts')) {
  const result = validateMigrationArtifacts(process.cwd());
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log(`Drizzle migration artifacts valid (${result.journalTags.length} journaled, ${result.baselineExceptionCount} documented baseline exceptions).`);
  }
}
