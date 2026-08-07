import { describe, expect, it, vi } from 'vitest';

import { GroundedExecutionAdapter } from './execution';
import { PHASE33_DEFERRED_POLICY } from './contracts';

describe('GroundedExecutionAdapter', () => {
  it('fails closed before model or tool dispatch when policy approval is deferred', async () => {
    const runAgent = vi.fn();
    const instantiateChain = vi.fn();
    const adapter = new GroundedExecutionAdapter({ runAgent, instantiateChain });

    const result = await adapter.execute({
      runId: 42,
      targetType: 'company',
      subjectId: 7,
      subjectDisplayName: 'Acme Corp',
      checklistSignalIds: [1, 2],
      policy: PHASE33_DEFERRED_POLICY,
    });

    expect(result.ok).toBe(false);
    expect(result.failureReason).toBe('policy_unavailable');
    expect(runAgent).not.toHaveBeenCalled();
    expect(instantiateChain).not.toHaveBeenCalled();
  });

  it('does not accept Persona input while the approved policy is unavailable', async () => {
    const adapter = new GroundedExecutionAdapter({
      runAgent: vi.fn(),
      instantiateChain: vi.fn(),
    });

    const result = await adapter.execute({
      runId: 42,
      targetType: 'persona',
      subjectId: 7,
      subjectDisplayName: 'Jane Doe',
      checklistSignalIds: [1],
      policy: PHASE33_DEFERRED_POLICY,
    });

    expect(result).toMatchObject({ ok: false, failureReason: 'persona_policy_unavailable' });
  });
});
