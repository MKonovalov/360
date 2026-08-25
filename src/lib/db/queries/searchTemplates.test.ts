import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { select: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import { getSearchTemplateVersion } from './searchTemplates';
import { searchTemplate, searchTemplateVersion } from '../schema';

describe('searchTemplates query module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads one requested Search template version with lifecycle and current-version metadata', async () => {
    const row = {
      templateId: 7,
      templateVersionId: 71,
      templateStatus: 'active',
      templateVersionStatus: 'active',
      version: 3,
      name: 'Company Search',
      resolvedInstructions: 'Find current finance leaders.',
      buyerRoleRules: [],
      evidencePolicy: {
        minimumPublicSources: 1,
        allowedSourceKinds: [],
        requireHttps: true,
        allowPrivateSources: false,
      },
      schemaVersion: 1,
      isCurrent: true,
    };
    const where = vi.fn().mockResolvedValue([row]);
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    mocks.db.select.mockReturnValue({ from });

    const result = await getSearchTemplateVersion(71);

    expect(result).toEqual(row);
    expect(mocks.db.select).toHaveBeenCalledWith(expect.anything());
    expect(from).toHaveBeenCalledWith(searchTemplateVersion);
    expect(innerJoin).toHaveBeenCalledWith(searchTemplate, expect.anything());
    expect(where).toHaveBeenCalledWith(expect.anything());
  });

  it('returns undefined when the requested Search template version is missing', async () => {
    const where = vi.fn().mockResolvedValue([]);
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    mocks.db.select.mockReturnValue({ from });

    await expect(getSearchTemplateVersion(999)).resolves.toBeUndefined();
  });

  it('keeps current-version selection local to Search tables and the requested version', () => {
    const source = readFileSync(new URL('./searchTemplates.ts', import.meta.url), 'utf8');

    expect(source).toContain('MAX(current_version.version)');
    expect(source).toContain('eq(searchTemplateVersion.id, templateVersionId)');
    expect(source).not.toContain('analysisTemplate');
    expect(source).not.toContain('requireStaffAccess');
  });
});
