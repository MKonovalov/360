import { describe, expect, it } from 'vitest';

import { arcAgentnetSubmitRequestSchema } from './arcAgentnetContracts';

const validFixedRequest = {
  subject: { type: 'company', id: 42 },
  practiceAreaId: 7,
  signalCategory: 'cost-pressure',
  selection: { kind: 'fixed', templateVersionId: 3 },
  idempotencyKey: 'idempotency-key-1',
};

const validCustomRequest = {
  subject: { type: 'company', id: 42 },
  practiceAreaId: 7,
  signalCategory: 'cost-pressure',
  selection: { kind: 'custom', customAgentId: 'custom-agent-1', templateVersionId: 3 },
  idempotencyKey: 'idempotency-key-1',
};

describe('arcAgentnetSubmitRequestSchema', () => {
  it('accepts a Company-only submit request with a fixed selection', () => {
    const result = arcAgentnetSubmitRequestSchema.safeParse(validFixedRequest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(validFixedRequest);
  });

  it('accepts a Company-only submit request with a custom selection', () => {
    const result = arcAgentnetSubmitRequestSchema.safeParse(validCustomRequest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(validCustomRequest);
  });

  it('rejects a fixed selection carrying a customAgentId (discrimination is exact)', () => {
    const result = arcAgentnetSubmitRequestSchema.safeParse({
      ...validFixedRequest,
      selection: { kind: 'fixed', templateVersionId: 3, customAgentId: 'not-allowed' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a custom selection missing customAgentId', () => {
    const result = arcAgentnetSubmitRequestSchema.safeParse({
      ...validCustomRequest,
      selection: { kind: 'custom', templateVersionId: 3 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unrecognized selection kind', () => {
    const result = arcAgentnetSubmitRequestSchema.safeParse({
      ...validFixedRequest,
      selection: { kind: 'dynamic', templateVersionId: 3 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a Persona subject', () => {
    const result = arcAgentnetSubmitRequestSchema.safeParse({
      ...validFixedRequest,
      subject: { type: 'persona', id: 42 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a zero or negative subject id', () => {
    expect(
      arcAgentnetSubmitRequestSchema.safeParse({ ...validFixedRequest, subject: { type: 'company', id: 0 } }).success,
    ).toBe(false);
    expect(
      arcAgentnetSubmitRequestSchema.safeParse({ ...validFixedRequest, subject: { type: 'company', id: -1 } }).success,
    ).toBe(false);
  });

  it('rejects a zero or negative practiceAreaId', () => {
    expect(arcAgentnetSubmitRequestSchema.safeParse({ ...validFixedRequest, practiceAreaId: 0 }).success).toBe(false);
    expect(arcAgentnetSubmitRequestSchema.safeParse({ ...validFixedRequest, practiceAreaId: -3 }).success).toBe(false);
  });

  it('rejects a zero or negative templateVersionId in the selection', () => {
    expect(
      arcAgentnetSubmitRequestSchema.safeParse({
        ...validFixedRequest,
        selection: { kind: 'fixed', templateVersionId: 0 },
      }).success,
    ).toBe(false);
    expect(
      arcAgentnetSubmitRequestSchema.safeParse({
        ...validCustomRequest,
        selection: { kind: 'custom', customAgentId: 'custom-agent-1', templateVersionId: -1 },
      }).success,
    ).toBe(false);
  });

  it('rejects an empty signalCategory', () => {
    expect(arcAgentnetSubmitRequestSchema.safeParse({ ...validFixedRequest, signalCategory: '' }).success).toBe(false);
  });

  it('rejects an empty idempotencyKey', () => {
    expect(arcAgentnetSubmitRequestSchema.safeParse({ ...validFixedRequest, idempotencyKey: '' }).success).toBe(false);
  });

  it('rejects an empty customAgentId', () => {
    expect(
      arcAgentnetSubmitRequestSchema.safeParse({
        ...validCustomRequest,
        selection: { kind: 'custom', customAgentId: '', templateVersionId: 3 },
      }).success,
    ).toBe(false);
  });

  it('accepts an opaque idempotency key of any non-empty shape', () => {
    expect(
      arcAgentnetSubmitRequestSchema.safeParse({ ...validFixedRequest, idempotencyKey: 'a'.repeat(64) }).success,
    ).toBe(true);
  });

  it('rejects a non-string idempotencyKey', () => {
    expect(arcAgentnetSubmitRequestSchema.safeParse({ ...validFixedRequest, idempotencyKey: 12_345 }).success).toBe(
      false,
    );
  });

  it('rejects unknown top-level keys rather than stripping them', () => {
    const result = arcAgentnetSubmitRequestSchema.safeParse({
      ...validFixedRequest,
      callbackUrl: 'https://evil.example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys nested in subject', () => {
    const result = arcAgentnetSubmitRequestSchema.safeParse({
      ...validFixedRequest,
      subject: { type: 'company', id: 42, partnerId: 'p-1' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys nested in selection', () => {
    const result = arcAgentnetSubmitRequestSchema.safeParse({
      ...validFixedRequest,
      selection: { kind: 'fixed', templateVersionId: 3, instructions: 'do something else' },
    });
    expect(result.success).toBe(false);
  });

  it.each(['credentials', 'partnerUrl', 'callbackUrl', 'transport', 'headers', 'instructions'])(
    'rejects the privileged field %s at the top level rather than silently stripping it',
    (field) => {
      const result = arcAgentnetSubmitRequestSchema.safeParse({ ...validFixedRequest, [field]: 'tampered' });
      expect(result.success).toBe(false);
    },
  );

  it('preserves whitespace in idempotencyKey rather than trimming it', () => {
    const paddedIdempotencyKey = '  idempotency-key-1  ';
    const result = arcAgentnetSubmitRequestSchema.safeParse({
      ...validFixedRequest,
      idempotencyKey: paddedIdempotencyKey,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.idempotencyKey).toBe(paddedIdempotencyKey);
  });

  it('preserves whitespace in signalCategory rather than trimming it', () => {
    const paddedSignalCategory = '  cost pressure  ';
    const result = arcAgentnetSubmitRequestSchema.safeParse({
      ...validFixedRequest,
      signalCategory: paddedSignalCategory,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.signalCategory).toBe(paddedSignalCategory);
  });

  it('preserves whitespace in customAgentId rather than trimming it', () => {
    const paddedCustomAgentId = '  custom-agent-1  ';
    const result = arcAgentnetSubmitRequestSchema.safeParse({
      ...validCustomRequest,
      selection: { kind: 'custom', customAgentId: paddedCustomAgentId, templateVersionId: 3 },
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.selection.kind === 'custom') {
      expect(result.data.selection.customAgentId).toBe(paddedCustomAgentId);
    }
  });

  it('accepts an idempotencyKey longer than the old undocumented 200-character ceiling', () => {
    const longIdempotencyKey = 'k'.repeat(500);
    const result = arcAgentnetSubmitRequestSchema.safeParse({
      ...validFixedRequest,
      idempotencyKey: longIdempotencyKey,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.idempotencyKey).toBe(longIdempotencyKey);
  });

  it('accepts a signalCategory longer than the old undocumented 200-character ceiling', () => {
    const longSignalCategory = 'c'.repeat(500);
    const result = arcAgentnetSubmitRequestSchema.safeParse({
      ...validFixedRequest,
      signalCategory: longSignalCategory,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.signalCategory).toBe(longSignalCategory);
  });

  it('accepts a customAgentId longer than the old undocumented 120-character ceiling', () => {
    const longCustomAgentId = 'a'.repeat(300);
    const result = arcAgentnetSubmitRequestSchema.safeParse({
      ...validCustomRequest,
      selection: { kind: 'custom', customAgentId: longCustomAgentId, templateVersionId: 3 },
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.selection.kind === 'custom') {
      expect(result.data.selection.customAgentId).toBe(longCustomAgentId);
    }
  });
});
