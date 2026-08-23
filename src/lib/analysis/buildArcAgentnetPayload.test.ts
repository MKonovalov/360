import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  ARC_AGENTNET_PAYLOAD_LIMITS,
  buildBoundedArcAgentnetInput,
} from './buildArcAgentnetPayload';
import type {
  BoundedArcAgentnetInput,
  BoundedTemplateMetadata,
  ResolvedCompanyAnalysisForArcAgentnet,
} from './arcAgentnetContracts';

const fixedTemplate: BoundedTemplateMetadata = {
  kind: 'fixed',
  templateId: 10,
  templateVersionId: 42,
  templateKey: 'company-buying-signal-analysis',
  templateName: 'Company Buying Signal Analysis',
  templateVersion: 3,
  targetType: 'company',
  customAgentId: null, customAgentName: null, customAgentVersion: null,
};

const baseInput: ResolvedCompanyAnalysisForArcAgentnet = {
  company: {
    id: 123,
    name: 'Example Holdings',
    domain: 'HTTPS://WWW.Example.com',
    profile: {
      industry: 'Business services',
      headcount: 1200,
      headquarters: 'Chicago, IL',
      description: 'Public company providing business services',
    },
  },
  practiceArea: { id: 7, name: 'Finance Transformation', shortCode: 'FIN' },
  buyingSignalCategory: ' Cost pressure ',
  template: fixedTemplate,
  resolvedInstruction: ' Server-resolved instructions. ',
  checklist: [
    { id: 1001, label: 'Assess evidence of financial cost pressure', required: true },
    { id: 1002, label: 'Check for an active transformation programme', required: false },
  ],
  publicEvidenceUrls: [
    'https://example.com/investor-update',
    'https://example.com/investor-update',
    'https://example.com/investor-update#fragment',
    'https://example.com/other/',
    'http://example.com/insecure',
    'https://user:password@example.com/credentialed',
    'https://localhost/private',
    'https://127.0.0.1/private',
    'https://[::1]/private',
    'https://service.example.local/private',
    'https://service.example.internal/private',
  ],
};

const expectedPayload = {
  schemaVersion: 1,
  analysis: {
    subjectType: 'company',
    company: {
      id: 123,
      name: 'Example Holdings',
      domain: 'example.com',
      profile: {
        industry: 'Business services',
        headcount: 1200,
        headquarters: 'Chicago, IL',
        description: 'Public company providing business services',
      },
    },
    practiceArea: { id: 7, name: 'Finance Transformation', shortCode: 'FIN' },
    buyingSignalCategory: 'Cost pressure',
    template: fixedTemplate,
    resolvedInstructions: 'Server-resolved instructions.',
    checklist: [
      { id: 1001, label: 'Assess evidence of financial cost pressure', required: true },
      { id: 1002, label: 'Check for an active transformation programme', required: false },
    ],
    publicEvidenceUrls: ['https://example.com/investor-update', 'https://example.com/other'],
  },
} satisfies BoundedArcAgentnetInput;

const expectedNullProfilePayload = {
  ...expectedPayload,
  analysis: {
    ...expectedPayload.analysis,
    company: {
      ...expectedPayload.analysis.company,
      domain: null,
      profile: { industry: null, headcount: null, headquarters: null, description: null },
    },
  },
} satisfies BoundedArcAgentnetInput;

function payloadOf(result: ReturnType<typeof buildBoundedArcAgentnetInput>): BoundedArcAgentnetInput {
  expect('ok' in result).toBe(false);
  if ('ok' in result) throw new Error('expected a bounded payload');
  return result;
}

describe('buildBoundedArcAgentnetInput', () => {
  it('builds the exact fixed-template allowlisted payload', () => {
    expect(payloadOf(buildBoundedArcAgentnetInput(baseInput))).toEqual(expectedPayload);
  });

  it('supports server-resolved custom template metadata without inventing a partner template', () => {
    const customTemplate: BoundedTemplateMetadata = {
      kind: 'custom',
      templateId: 11,
      templateVersionId: 43,
      templateKey: 'custom-finance-review',
      templateName: 'Finance signal reviewer',
      templateVersion: 5,
      targetType: 'company',
      customAgentId: 'opaque-custom-agent-id',
      customAgentName: 'Finance signal reviewer',
      customAgentVersion: 5,
    };

    const result = buildBoundedArcAgentnetInput({ ...baseInput, template: customTemplate });

    expect(payloadOf(result).analysis.template).toEqual(customTemplate);
  });

  it('normalizes missing profile fields to null and excludes private or arbitrary fields', () => {
    const pollutedInput = {
      ...baseInput,
      company: {
        ...baseInput.company,
        domain: null,
        profile: { industry: null, headcount: null, headquarters: null, description: null },
        privateNotes: 'never send this',
        authClaims: { userId: 'staff-user' },
        providerResponse: { apiKey: 'never send this' },
      },
      credentials: 'never send this',
      callbackUrl: 'https://attacker.example/callback',
      arbitraryField: 'never send this',
    };

    const result = buildBoundedArcAgentnetInput(pollutedInput);

    expect(result).toEqual(expectedNullProfilePayload);
  });

  it.each([
    'https://example.com/with#fragment', 'http://example.com/not-https', 'https://user:password@example.com/credentials',
    'https://localhost/private', 'https://127.0.0.1/private', 'https://[::1]/private', 'https://service.example.local/private',
    'https://service.example.internal/private', 'https://service.example.test/private', 'not a URL',
  ])('omits unsafe evidence URL %s', (unsafeUrl) => {
    const result = buildBoundedArcAgentnetInput({
      ...baseInput,
      publicEvidenceUrls: [unsafeUrl, 'https://example.com/public'],
    });

    expect(payloadOf(result).analysis.publicEvidenceUrls).toEqual(['https://example.com/public']);
  });

  it.each([
    'https://user:password@example.com',
    'https://example.com/path',
    'https://example.com/path#fragment',
    'ftp://example.com',
    'localhost',
  ])('omits unsafe company domain %s', (domain) => {
    const result = buildBoundedArcAgentnetInput({ ...baseInput, company: { ...baseInput.company, domain } });

    expect(payloadOf(result).analysis.company.domain).toBeNull();
  });

  it.each([
    '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1',
    '127.0.0.1', '0.0.0.0', '224.0.0.1', '198.18.0.0', '198.18.0.1', '198.19.255.254',
    '198.19.255.255', '::1', '::', 'ff02::1', '2001:db8::1', 'fc00::1', 'fe80::1',
    '::ffff:10.0.0.1', '[::1]', '[::]', '[ff02::1]', '[2001:db8::1]', '[fc00::1]',
    '[fe80::1]', '[::ffff:10.0.0.1]',
  ])('rejects private or non-routable domain literal %s', (domain) => {
    const result = buildBoundedArcAgentnetInput({ ...baseInput, company: { ...baseInput.company, domain } });

    expect(payloadOf(result).analysis.company.domain).toBeNull();
  });

  it.each([
    ['example.com', 'example.com'],
    ['8.8.8.8', '8.8.8.8'],
    ['2001:4860:4860::8888', '2001:4860:4860::8888'],
    ['[2001:4860:4860::8888]', '2001:4860:4860::8888'],
  ])('preserves public domain or IP literal %s', (domain, expectedDomain) => {
    const result = buildBoundedArcAgentnetInput({ ...baseInput, company: { ...baseInput.company, domain } });

    expect(payloadOf(result).analysis.company.domain).toBe(expectedDomain);
  });

  it('rejects instructions over the configured template bound', () => {
    const result = buildBoundedArcAgentnetInput({
      ...baseInput,
      resolvedInstruction: 'i'.repeat(ARC_AGENTNET_PAYLOAD_LIMITS.maxInstructionLength + 1),
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
  });

  it('rejects oversized checklist items instead of truncating server instructions', () => {
    const result = buildBoundedArcAgentnetInput({
      ...baseInput,
      checklist: [
        {
          id: 1001,
          label: 'l'.repeat(ARC_AGENTNET_PAYLOAD_LIMITS.maxChecklistLabelLength + 1),
          required: true,
        },
      ],
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
  });

  it('rejects a checklist over the fixed count bound', () => {
    const result = buildBoundedArcAgentnetInput({
      ...baseInput,
      checklist: Array.from({ length: ARC_AGENTNET_PAYLOAD_LIMITS.maxChecklistItems + 1 }, (_, index) => ({
        id: index + 1,
        label: `Check ${index + 1}`,
        required: false,
      })),
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
  });

  it('bounds checklist count and evidence URL count and length', () => {
    const checklist = Array.from({ length: ARC_AGENTNET_PAYLOAD_LIMITS.maxChecklistItems + 1 }, (_, index) => ({
      id: index + 1,
      label: `Check ${index + 1}`,
      required: false,
    }));
    const evidenceUrl = `https://example.com/${'u'.repeat(ARC_AGENTNET_PAYLOAD_LIMITS.maxEvidenceUrlLength)}`;

    const result = buildBoundedArcAgentnetInput({
      ...baseInput,
      checklist: checklist.slice(0, ARC_AGENTNET_PAYLOAD_LIMITS.maxChecklistItems),
      publicEvidenceUrls: [evidenceUrl, ...Array.from(
        { length: ARC_AGENTNET_PAYLOAD_LIMITS.maxEvidenceUrls },
        (_, index) => `https://example.com/evidence-${index}`,
      )],
    });

    const payload = payloadOf(result);
    expect(payload.analysis.checklist).toHaveLength(ARC_AGENTNET_PAYLOAD_LIMITS.maxChecklistItems);
    expect(payload.analysis.publicEvidenceUrls).toHaveLength(ARC_AGENTNET_PAYLOAD_LIMITS.maxEvidenceUrls);
    expect(payload.analysis.publicEvidenceUrls).not.toContain(evidenceUrl);
  });

  it('rejects a serialized payload over 1 MB before partner submission', () => {
    const result = buildBoundedArcAgentnetInput({
      ...baseInput,
      company: {
        ...baseInput.company,
        profile: { ...baseInput.company.profile, description: 'd'.repeat(ARC_AGENTNET_PAYLOAD_LIMITS.maxRequestBytes) },
      },
    });

    expect(result).toEqual({ ok: false, reason: 'payload_too_large' });
  });

  it('rejects any individual input value over 25 MB', () => {
    const result = buildBoundedArcAgentnetInput({
      ...baseInput,
      company: {
        ...baseInput.company,
        profile: {
          ...baseInput.company.profile,
          description: 'd'.repeat(ARC_AGENTNET_PAYLOAD_LIMITS.maxIndividualValueBytes + 1),
        },
      },
    });

    expect(result).toEqual({ ok: false, reason: 'payload_too_large' });
  });
});
