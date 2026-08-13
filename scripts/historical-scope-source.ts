import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const SCOPE_AUDIT_MODES = {
  historical: 'historical',
  workingTree: 'working-tree',
} as const;

export type ScopeAuditMode = (typeof SCOPE_AUDIT_MODES)[keyof typeof SCOPE_AUDIT_MODES];

export interface HistoricalScopeRefs {
  readonly targetRef: string;
  readonly baseRef: string;
}

export interface ScopeSource {
  readonly mode: ScopeAuditMode;
  readonly targetRef: string;
  readonly baseRef: string;
  readonly files: readonly string[];
  readonly changedFiles: ReadonlySet<string>;
  readFile(filePath: string): string;
  readBaseFile(filePath: string): string;
}

const FULL_COMMIT_REF_PATTERN = /^[0-9a-f]{40}$/;

function git(rootDir: string, args: readonly string[]): string {
  return execFileSync('git', [...args], {
    cwd: rootDir,
    encoding: 'utf8',
    env: { ...process.env, GIT_MASTER: '1' },
    maxBuffer: 32 * 1024 * 1024,
  });
}

function gitBytes(rootDir: string, args: readonly string[], input: string): Buffer {
  return execFileSync('git', [...args], {
    cwd: rootDir,
    input,
    env: { ...process.env, GIT_MASTER: '1' },
    maxBuffer: 32 * 1024 * 1024,
  });
}

function splitNullSeparated(output: string): readonly string[] {
  return output.split('\0').filter((filePath) => filePath.length > 0);
}

function assertSafeRef(ref: string): void {
  if (!FULL_COMMIT_REF_PATTERN.test(ref)) {
    throw new Error(`scope audit ref is not a full commit SHA: ${ref}`);
  }
}

function assertSafeRepoPath(filePath: string): void {
  if (filePath.startsWith('/') || filePath.split('/').includes('..') || filePath.includes('\0')) {
    throw new Error(`scope audit returned an unsafe repository path: ${filePath}`);
  }
}

function readWorkingTreeFile(rootDir: string, filePath: string): string {
  assertSafeRepoPath(filePath);
  return readFileSync(resolve(rootDir, filePath), 'utf8');
}

function readHistoricalFile(rootDir: string, ref: string, filePath: string): string {
  assertSafeRef(ref);
  assertSafeRepoPath(filePath);
  return git(rootDir, ['show', `${ref}:${filePath}`]);
}

function historicalFileContents(rootDir: string, ref: string, files: readonly string[]): ReadonlyMap<string, string> {
  const treeEntries = git(rootDir, ['ls-tree', '-r', '-z', '--format=%(objectname)%x09%(path)', ref, '--'])
    .split('\0')
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const separatorIndex = entry.indexOf('\t');
      const objectId = entry.slice(0, separatorIndex);
      const filePath = entry.slice(separatorIndex + 1);
      assertSafeRepoPath(filePath);
      return { filePath, objectId };
    })
    .filter(({ filePath }) => files.includes(filePath));
  const contents = new Map<string, string>();
  if (treeEntries.length === 0) return contents;

  const batchOutput = gitBytes(
    rootDir,
    ['cat-file', '--batch'],
    `${treeEntries.map(({ objectId }) => objectId).join('\n')}\n`,
  );
  let offset = 0;
  for (const { filePath } of treeEntries) {
    const headerEnd = batchOutput.indexOf(0x0a, offset);
    if (headerEnd === -1) throw new Error(`invalid git object header for ${filePath}`);
    const header = batchOutput.toString('utf8', offset, headerEnd).split(' ');
    const size = Number(header[2]);
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    contents.set(filePath, batchOutput.toString('utf8', contentStart, contentEnd));
    offset = contentEnd + 1;
  }
  return contents;
}

export function createHistoricalScopeSource(rootDir: string, refs: HistoricalScopeRefs): ScopeSource {
  assertSafeRef(refs.targetRef);
  assertSafeRef(refs.baseRef);

  const files = splitNullSeparated(git(rootDir, ['ls-tree', '-r', '--name-only', '-z', refs.targetRef, '--']));
  const changedFiles = new Set(
    splitNullSeparated(git(rootDir, ['diff', '--name-only', '-z', refs.baseRef, refs.targetRef, '--'])),
  );
  const targetContents = historicalFileContents(rootDir, refs.targetRef, files);

  return {
    mode: SCOPE_AUDIT_MODES.historical,
    targetRef: refs.targetRef,
    baseRef: refs.baseRef,
    files,
    changedFiles,
    readFile: (filePath) => {
      const content = targetContents.get(filePath);
      if (content === undefined) throw new Error(`historical file was not found: ${filePath}`);
      return content;
    },
    readBaseFile: (filePath) => readHistoricalFile(rootDir, refs.baseRef, filePath),
  };
}

export function createWorkingTreeScopeSource(rootDir: string): ScopeSource {
  const headRef = git(rootDir, ['rev-parse', 'HEAD']).trim();
  assertSafeRef(headRef);
  const files = splitNullSeparated(git(rootDir, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']));
  const changedFiles = new Set([
    ...splitNullSeparated(git(rootDir, ['diff', '--name-only', '-z', 'HEAD', '--'])),
    ...splitNullSeparated(git(rootDir, ['ls-files', '--others', '--exclude-standard', '-z'])),
  ]);

  return {
    mode: SCOPE_AUDIT_MODES.workingTree,
    targetRef: SCOPE_AUDIT_MODES.workingTree,
    baseRef: headRef,
    files,
    changedFiles,
    readFile: (filePath) => readWorkingTreeFile(rootDir, filePath),
    readBaseFile: (filePath) => readHistoricalFile(rootDir, headRef, filePath),
  };
}

export function createScopeSource(
  rootDir: string,
  mode: ScopeAuditMode,
  historicalRefs: HistoricalScopeRefs,
): ScopeSource {
  switch (mode) {
    case SCOPE_AUDIT_MODES.historical:
      return createHistoricalScopeSource(rootDir, historicalRefs);
    case SCOPE_AUDIT_MODES.workingTree:
      return createWorkingTreeScopeSource(rootDir);
    default: {
      const unreachableMode: never = mode;
      throw new Error(`unknown scope audit mode: ${unreachableMode}`);
    }
  }
}
