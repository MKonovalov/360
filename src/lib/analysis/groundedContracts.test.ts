import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/index', () => ({ db: { execute: vi.fn() } }));

import { PHASE33_DEFERRED_POLICY } from './contracts';
import { prepareAnalysisPacket } from '../db/queries/analysisResults';
import {
  canonicalSourceSchema,
  dedupeCanonicalSources,
  groundedPacketSchema,
  validateGroundedPacket,
} from './groundedContracts';

const source = {
  sourceId: 'source-1',
  canonicalUrl: 'https://example.com/news',
  title: 'Example announcement',
  retrievedAt: '2026-08-07T12:00:00.000Z',
  excerpt: 'The company announced a transformation program.',
  contentHash: 'a'.repeat(64),
  classification: 'public_biz',
} as const;

const finding = {
  findingId: 'finding-1',
  identity: { signalId: 7, buyerRoleId: null },
  status: 'strong',
  confidence: 'high',
  claim: 'A transformation program was announced.',
  reasoningSummary: 'The source contains the announcement.',
} as const;

const packet = {
  schemaVersion: 1,
  targetType: 'company',
  narrative: 'The selected signal is supported by a public announcement.',
  findings: [finding],
  sources: [source],
  links: [{ findingId: 'finding-1', sourceId: 'source-1', locator: 'announcement', supportRole: 'primary' }],
  audit: {
    attempt: 1,
    modelId: 'model.primary',
    modelProvider: null,
    modelChain: [],
    toolCallCount: 1,
    sourceCount: 1,
    findingCount: 1,
    durationMs: 100,
    traceId: 'trace-1',
    failureReason: null,
  },
} as const;

describe('grounded Phase 33 contracts', () => {
  it('accepts a safe packet only when finding identity is snapshotted', () => {
    expect(validateGroundedPacket(packet, [7])).toEqual(packet);
    expect(groundedPacketSchema.safeParse({ ...packet, policy: PHASE33_DEFERRED_POLICY }).success).toBe(false);
  });

  it('strips model-recited catalogue identity before accepting normalized snapshot identity', () => {
    const recitedIdentity = {
      ...finding.identity,
      signalName: 'Model-invented signal',
      signalCategory: 'Model-invented category',
    } as const;
    const prepared = prepareAnalysisPacket({
      packet: {
        ...packet,
        findings: [{ ...finding, identity: recitedIdentity }],
      },
      checklistSignalIds: [7],
    });

    expect(prepared.packet.findings[0]?.identity).toEqual(finding.identity);

    const snapshotIdentity = {
      ...finding.identity,
      signalName: 'Trusted snapshot signal',
      signalCategory: 'Trusted snapshot category',
    } as const;
    const normalized = groundedPacketSchema.parse({
      ...packet,
      findings: [{ ...finding, identity: snapshotIdentity }],
    });
    expect(normalized.findings[0]?.identity).toEqual(snapshotIdentity);
  });

  it.each([
    ['unknown finding', { ...packet, findings: [{ ...finding, identity: { ...finding.identity, signalId: 99 } }] }],
    ['duplicate links', { ...packet, links: [...packet.links, ...packet.links] }],
    ['duplicate finding IDs', { ...packet, findings: [finding, finding] }],
    ['private reasoning', { ...packet, audit: { ...packet.audit, privateReasoning: 'hidden' } }],
    ['database URL', { ...packet, sources: [{ ...source, canonicalUrl: 'https://db.example.test?DATABASE_URL=secret' }] }],
    ['Clerk/session value', { ...packet, narrative: 'clerk_session=secret' }],
  ] as const)('rejects %s', (_label, candidate) => {
    if (_label === 'unknown finding') {
      expect(() => validateGroundedPacket(candidate, [7])).toThrow('unlinked_finding');
      return;
    }
    expect(groundedPacketSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects unsupported sources, unbounded excerpts, and credentials', () => {
    expect(canonicalSourceSchema.safeParse({ ...source, canonicalUrl: 'http://example.com/news' }).success).toBe(false);
    expect(canonicalSourceSchema.safeParse({ ...source, canonicalUrl: 'https://user:pass@example.com/news' }).success).toBe(false);
    expect(canonicalSourceSchema.safeParse({ ...source, excerpt: 'x'.repeat(8_001) }).success).toBe(false);
  });

  it('keeps the first canonical source and rejects no-evidence support links', () => {
    const duplicate = { ...source, sourceId: 'source-2', canonicalUrl: 'https://EXAMPLE.com:443/news/' };
    expect(dedupeCanonicalSources([source, duplicate])).toEqual([source]);
    expect(
      groundedPacketSchema.safeParse({
        ...packet,
        findings: [{ ...finding, status: 'no_evidence' }],
      }).success,
    ).toBe(true);
    expect(() =>
      validateGroundedPacket({ ...packet, findings: [{ ...finding, status: 'no_evidence' }] }, [7]),
    ).toThrow('no_evidence_must_not_have_support');
  });

  it('allows an empty checklist only with an empty finding set', () => {
    expect(validateGroundedPacket({ ...packet, findings: [], links: [], sources: [] }, [])).toMatchObject({ findings: [] });
    expect(() => validateGroundedPacket(packet, [])).toThrow('unlinked_finding');
  });
});
