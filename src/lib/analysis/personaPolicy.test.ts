import { describe, expect, it } from 'vitest';

import { PHASE33_DEFERRED_POLICY } from './contracts';
import {
  classifyPersonaText,
  personaSourceRowSchema,
  redactPersonaInput,
  resolvePersonaPolicy,
} from './personaPolicy';

const persona = {
  id: 42,
  displayName: 'Example Buyer',
  title: 'Chief Financial Officer',
  seniority: 'executive',
  companyDisplayName: 'Example Company',
  email: 'buyer@example.com',
  phone: '+1 555 555 0100',
  linkedinUrl: 'https://linkedin.com/in/example',
  notes: 'private notes and api_key=secret-value',
} as const;

describe('Persona policy', () => {
  it('fails closed when policy approval is absent', () => {
    expect(resolvePersonaPolicy(PHASE33_DEFERRED_POLICY)).toEqual({
      ok: false,
      reason: 'persona_policy_unavailable',
    });
    expect(personaSourceRowSchema.safeParse({ ...persona, sessionId: 'secret' }).success).toBe(false);
  });

  it('requires retention and policy metadata for approved Persona execution', () => {
    const policy = {
      schemaVersion: 1,
      mode: 'phase33_grounded',
      executionEnabled: true,
      personaExecutionEnabled: true,
      policyVersion: 'persona-policy-test',
      limits: {
        maxAttempts: 1,
        maxToolCalls: 1,
        maxExecutionSeconds: 60,
        maxSources: 1,
        maxSourceBytes: 1_000,
        maxExcerptBytes: 500,
        maxSpendUsd: 1,
      },
      personaPolicy: {
        version: 'persona-policy-test',
        allowlistedFields: ['id', 'displayName', 'title', 'companyDisplayName'],
        redactionRules: ['email', 'phone', 'personal_url', 'secret'],
        classifications: ['public_biz'],
      },
      retention: { durationSeconds: 3_600, classification: 'public_biz' },
      evidenceStorage: 'bounded_excerpt_and_content_hash',
      auditVisibility: 'allowlisted_safe_metadata_only',
      failureReason: null,
      networkAccess: true,
      writesAllowed: false,
      effectiveMaxAttempts: 1,
      effectiveMaxToolCalls: 1,
      effectiveMaxExecutionSeconds: 60,
      effectiveMaxSpendUsd: 1,
    } as const;

    const resolved = resolvePersonaPolicy(policy);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const redacted = redactPersonaInput(resolved.policy, persona);
    expect(redacted).toMatchObject({
      id: 42,
      displayName: 'Example Buyer',
      title: 'Chief Financial Officer',
      companyDisplayName: 'Example Company',
      classification: 'public_biz',
      policyVersion: 'persona-policy-test',
    });
    expect(JSON.stringify(redacted)).not.toContain('buyer@example.com');
    expect(JSON.stringify(redacted)).not.toContain('555 555');
    expect(JSON.stringify(redacted)).not.toContain('linkedin.com');
    expect(JSON.stringify(redacted)).not.toContain('api_key');
  });

  it('classifies secrets as restricted without persisting the source value', () => {
    expect(classifyPersonaText('api_key=secret-value')).toBe('restricted');
    expect(classifyPersonaText('Chief Financial Officer')).toBe('public_biz');
  });
});
