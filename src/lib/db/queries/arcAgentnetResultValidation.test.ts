import { describe, expect, it } from 'vitest';

import { serializeArcAgentnetProjection } from './arcAgentnetResultValidation';

const packet = {
  schemaVersion: 1,
  targetType: 'company',
  targetId: 'molgroup.info',
  findings: [{ findingId: 'F-298', status: 'not_supported', confidence: 'high', claim: 'Observed: bill-to entity named in GTC.' }],
  sources: [{ sourceId: 'S01', title: 'GTC', url: 'https://molgroup.info', contentHash: 'abc' }],
  links: [{ findingId: 'F-298', sourceId: 'S01', supportRole: 'contradicts' }],
};

// Mirrors the real analyze job: final packet as a JSON string inside run telemetry.
function workflowResult(text: string, transcriptText = 'agent turn') {
  return {
    output: {
      output: { text, transcript: [{ speaker: 'Mike', text: transcriptText }] },
      json_ok: false,
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, prompt_tokens_details: {}, completion_tokens_details: {} },
      workflow: { mode: 'workflow', agents: ['Mike', 'Anna', 'Bob', '360 Finalizer'] },
      mcp_calls: [{ phase: 'call', tool_name: 'exa_search', correlation_id: 'c1', status: 'verified', redacted_args: { argument_keys: ['query'] }, error_code: null }],
      jev_escalations: [],
    },
    guest_results: {},
  };
}

describe('serializeArcAgentnetProjection', () => {
  it('keeps the final packet from workflow telemetry and drops usage, mcp_calls and transcripts', () => {
    const result = serializeArcAgentnetProjection(workflowResult(JSON.stringify(packet)));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected a valid projection');
    expect(result.projection).toEqual({
      jsonOk: false,
      workflow: { mode: 'workflow', agents: ['Mike', 'Anna', 'Bob', '360 Finalizer'] },
      packet,
    });
    expect(result.serialized).not.toContain('prompt_tokens');
    expect(result.serialized).not.toContain('transcript');
  });

  it('is not defeated by agent transcripts longer than the string limit', () => {
    expect(serializeArcAgentnetProjection(workflowResult(JSON.stringify(packet), 'x'.repeat(40_000))).ok).toBe(true);
  });

  it('stores bounded raw text when the final answer is not valid JSON', () => {
    const result = serializeArcAgentnetProjection(workflowResult(`not json ${'y'.repeat(30_000)}`));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected a valid projection');
    expect(result.projection).toMatchObject({ jsonOk: false });
    expect(String(result.projection.unparsedText).length).toBe(20_000);
    expect(result.projection).not.toHaveProperty('packet');
  });

  it('is idempotent over an already-normalized projection', () => {
    const first = serializeArcAgentnetProjection(workflowResult(JSON.stringify(packet)));
    if (!first.ok) throw new Error('expected a valid projection');
    const second = serializeArcAgentnetProjection(first.projection);

    expect(second.ok && second.hash).toBe(first.hash);
  });

  it('leaves other result shapes untouched', () => {
    const legacy = { result: { checklistFindings: [{ id: 1, label: 'x' }] } };
    const result = serializeArcAgentnetProjection(legacy);

    expect(result.ok && result.projection).toEqual(legacy);
  });

  it('still rejects restricted keys outside the recognised workflow wrapper', () => {
    expect(serializeArcAgentnetProjection({ usage: { prompt_tokens: 1 } }).ok).toBe(false);
    expect(serializeArcAgentnetProjection({ result: { api_key: 'x' } }).ok).toBe(false);
  });
});
