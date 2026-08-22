import { describe, expect, it } from 'vitest';
import { z as zodV4 } from 'zod';
import { z as zodV3 } from 'zod/v3';

import {
  GroundedExecutionValidationError,
  groundedModelOutputSchema,
} from './executionValidation';

describe('grounded execution validation failures', () => {
  it('keeps Zod v3 output rejection at the validation boundary', () => {
    const error = groundedModelOutputSchema.safeParse({ narrative: 42, findings: [] });

    expect(error.success).toBe(false);
    if (error.success) throw new Error('expected Zod v3 output rejection');

    const classified = new GroundedExecutionValidationError('invalid_packet', error.error);
    expect(classified.failureStage).toBe('validation');
    expect(classified.originalError).toBeInstanceOf(zodV3.ZodError);
  });

  it('keeps Zod v4 custom-output rejection at the validation boundary', () => {
    const error = zodV4.object({ score: zodV4.number() }).safeParse({ score: 'not-a-number' });

    expect(error.success).toBe(false);
    if (error.success) throw new Error('expected Zod v4 custom-output rejection');

    const classified = new GroundedExecutionValidationError('invalid_packet', error.error);
    expect(classified.failureStage).toBe('validation');
    expect(classified.originalError).toBeInstanceOf(zodV4.ZodError);
  });
});
