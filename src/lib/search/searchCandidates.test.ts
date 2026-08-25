import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { PersonaMatchRecord } from './searchMatching';
import { processSearchTerminalResult } from './searchCandidates';

const persona = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  fullName: 'Ada Lovelace',
  title: 'CFO',
  email: 'ada@example.com',
  linkedinUrl: 'https://www.linkedin.com/in/ada',
  phone: null,
  location: 'London',
  department: 'Finance',
  function: 'Transformation',
  seniority: 'c_level',
  companyName: 'Acme',
  companyDomain: 'acme.example',
  bio: null,
  photoUrl: null,
};

const source = {
  sourceId: 'source-1',
  kind: 'company_website' as const,
  url: 'https://acme.example/about',
  title: 'About Acme',
};

const candidate = {
  candidateId: 'candidate-1',
  persona,
  buyerRoleProposals: [
    {
      buyerRoleId: 7,
      buyerRoleName: 'CFO',
      matchedRuleIds: ['rule-finance'],
      confidence: 'supported' as const,
    },
    {
      buyerRoleId: 11,
      buyerRoleName: 'Transformation Lead',
      matchedRuleIds: ['rule-transformation'],
      confidence: 'uncertain' as const,
    },
  ],
  sources: [source],
  claims: [
    {
      claimId: 'claim-1',
      field: 'persona.title',
      value: 'CFO',
      sourceIds: ['source-1'],
    },
  ],
};

function createRun() {
  return {
    id: 101,
    initiatingUserId: 'user_360',
    companyId: 42,
    status: 'succeeded' as const,
    packetHash: null as string | null,
    packetSchemaVersion: null as number | null,
    companySnapshot: { id: 42, name: 'Acme', domain: 'acme.example' },
    templateSnapshot: {
      buyerRoleRules: [
        {
          ruleId: 'rule-finance',
          label: 'Finance',
          buyerRoleIds: [7],
          roleNames: ['CFO'],
          departments: [],
          functions: [],
          seniority: [],
          geographies: [],
          match: 'any_selector' as const,
          required: true,
        },
        {
          ruleId: 'rule-transformation',
          label: 'Transformation',
          buyerRoleIds: [],
          roleNames: ['Transformation Lead'],
          departments: [],
          functions: [],
          seniority: [],
          geographies: [],
          match: 'any_selector' as const,
          required: false,
        },
      ],
      evidencePolicy: {
        minimumPublicSources: 1,
        allowedSourceKinds: ['company_website'],
        requireHttps: true,
        allowPrivateSources: false,
      },
    },
    buyerRoleSnapshot: [
      { id: 7, name: 'CFO' },
      { id: 11, name: 'Transformation Lead' },
    ],
    buyerRoleEvidenceSnapshot: [
      {
        buyerRoleId: 7,
        buyerRoleName: 'CFO',
        matchedRules: [
          {
            ruleId: 'rule-finance',
            label: 'Finance',
            required: true,
            match: 'any_selector' as const,
            matchedSelectors: [{ kind: 'explicit_id' as const, value: '7' }],
          },
        ],
      },
      {
        buyerRoleId: 11,
        buyerRoleName: 'Transformation Lead',
        matchedRules: [
          {
            ruleId: 'rule-transformation',
            label: 'Transformation',
            required: false,
            match: 'any_selector' as const,
            matchedSelectors: [{ kind: 'role_name' as const, value: 'Transformation Lead' }],
          },
        ],
      },
    ],
  };
}

type TestRun = Omit<ReturnType<typeof createRun>, 'buyerRoleEvidenceSnapshot'> & {
  readonly buyerRoleEvidenceSnapshot: unknown;
};

function createStore(run: TestRun, personas: readonly PersonaMatchRecord[] = []) {
  return {
    getRun: vi.fn().mockResolvedValue(run),
    listPersonasForCompany: vi.fn().mockResolvedValue(personas),
    persistCandidates: vi.fn().mockResolvedValue(undefined),
    updateRunPacket: vi.fn().mockImplementation(async ({ packetHash, packetSchemaVersion }: { packetHash: string; packetSchemaVersion: number }) => {
      run.packetHash = packetHash;
      run.packetSchemaVersion = packetSchemaVersion;
      return true;
    }),
  };
}

function packet(candidates: readonly unknown[] = [candidate]) {
  return { schemaVersion: 1, candidates };
}

describe('processSearchTerminalResult', () => {
  it('persists one pending candidate with multiple Buyer Roles, claims, and source support', async () => {
    const run = createRun();
    const store = createStore(run);

    const result = await processSearchTerminalResult(
      { searchRunId: run.id, userId: run.initiatingUserId, packet: packet() },
      store,
    );

    expect(result).toMatchObject({ kind: 'applied', normalizedCandidateCount: 1 });
    expect(store.persistCandidates).toHaveBeenCalledTimes(1);
    expect(store.persistCandidates.mock.calls[0]?.[0].candidates).toEqual([
      expect.objectContaining({
        packetCandidateId: 'candidate-1',
        status: 'pending',
        buyerRoleSnapshot: [
          expect.objectContaining({ buyerRoleId: 7, matchedRuleIds: ['rule-finance'] }),
          expect.objectContaining({ buyerRoleId: 11, matchedRuleIds: ['rule-transformation'] }),
        ],
        claimsSnapshot: [expect.objectContaining({ claimId: 'claim-1', sourceIds: ['source-1'] })],
        sources: [expect.objectContaining({ packetSourceId: 'source-1', supports: ['claim-1'] })],
      }),
    ]);
  });

  it('derives inconclusive and ambiguous states while dropping invalid candidates from Reviews', async () => {
    const run = createRun();
    run.templateSnapshot.evidencePolicy.minimumPublicSources = 2;
    const store = createStore(run, [
      { id: 17, name: 'Ada Lovelace', email: 'ada@example.com', linkedinUrl: null, companyDomain: 'acme.example' },
      { id: 18, name: 'Ada Lovelace', email: 'ada@example.com', linkedinUrl: null, companyDomain: 'acme.example' },
    ]);

    const result = await processSearchTerminalResult(
      {
        searchRunId: run.id,
        userId: run.initiatingUserId,
        packet: packet([
          candidate,
          { ...candidate, candidateId: 'invalid-1', persona: { ...persona, fullName: '' } },
        ]),
      },
      store,
    );

    expect(result).toMatchObject({ kind: 'applied', normalizedCandidateCount: 1 });
    expect(result).toMatchObject({ diagnostics: [expect.objectContaining({ code: 'invalid_candidate', candidateId: 'invalid-1' })] });
    expect(store.persistCandidates.mock.calls[0]?.[0].candidates).toEqual([
      expect.objectContaining({
        packetCandidateId: 'candidate-1',
        status: 'ambiguous_match',
        matchSnapshot: { kind: 'ambiguous', personaIds: [17, 18], matchedBy: 'email' },
        eligibilitySnapshot: {
          eligible: false,
          deficiencies: ['ambiguous_match:email:17,18'],
        },
      }),
    ]);
  });

  it('rejects a proposal for an unknown Buyer Role even when its rule is known', async () => {
    const run = createRun();
    const store = createStore(run);
    const unknownRoleCandidate = {
      ...candidate,
      buyerRoleProposals: [{ ...candidate.buyerRoleProposals[0], buyerRoleId: 999 }],
    };

    const result = await processSearchTerminalResult(
      { searchRunId: run.id, userId: run.initiatingUserId, packet: packet([unknownRoleCandidate]) },
      store,
    );

    expect(result).toMatchObject({ kind: 'applied', normalizedCandidateCount: 0 });
    expect(result).toMatchObject({
      diagnostics: [expect.objectContaining({ code: 'invalid_buyer_role_proposal', candidateId: 'candidate-1' })],
    });
    expect(store.persistCandidates.mock.calls[0]?.[0].candidates).toEqual([]);
  });

  it.each([
    'null evidence',
    'null matchedRules',
    'undeclared evidence field',
    'stale same-id rule metadata',
  ] as const)('rejects %s before authorizing a Buyer Role proposal', async (caseName) => {
    const baseRun = createRun();
    const firstEvidence = baseRun.buyerRoleEvidenceSnapshot[0];
    if (!firstEvidence) throw new Error('expected Buyer Role evidence fixture');

    let evidence: unknown;
    switch (caseName) {
      case 'null evidence':
        evidence = null;
        break;
      case 'null matchedRules':
        evidence = [{ ...firstEvidence, matchedRules: null }, baseRun.buyerRoleEvidenceSnapshot[1]];
        break;
      case 'undeclared evidence field':
        evidence = [{ ...firstEvidence, unexpectedField: 'partner-controlled' }, baseRun.buyerRoleEvidenceSnapshot[1]];
        break;
      case 'stale same-id rule metadata':
        evidence = [
          {
            ...firstEvidence,
            matchedRules: firstEvidence.matchedRules.map((rule) => ({
              ...rule,
              label: 'Old Finance Rule',
              matchedSelectors: rule.matchedSelectors.map((selector) => ({ ...selector, value: 'Old selector' })),
            })),
          },
          baseRun.buyerRoleEvidenceSnapshot[1],
        ];
        break;
    }

    const run = { ...baseRun, buyerRoleEvidenceSnapshot: evidence };
    const store = createStore(run);
    const result = await processSearchTerminalResult(
      { searchRunId: run.id, userId: run.initiatingUserId, packet: packet() },
      store,
    );

    expect(result).toMatchObject({ kind: 'applied', normalizedCandidateCount: 0 });
    expect(result).toMatchObject({
      diagnostics: [expect.objectContaining({ code: 'invalid_buyer_role_proposal', candidateId: 'candidate-1' })],
    });
    expect(store.persistCandidates.mock.calls[0]?.[0].candidates).toEqual([]);
  });

  it('drops zero-proposal candidates when stored Buyer Role evidence is malformed', async () => {
    const baseRun = createRun();
    const run = { ...baseRun, buyerRoleEvidenceSnapshot: null };
    const store = createStore(run);
    const zeroProposalCandidate = { ...candidate, buyerRoleProposals: [] };

    const result = await processSearchTerminalResult(
      { searchRunId: run.id, userId: run.initiatingUserId, packet: packet([zeroProposalCandidate]) },
      store,
    );

    expect(result).toMatchObject({ kind: 'applied', normalizedCandidateCount: 0 });
    expect(result).toMatchObject({
      diagnostics: [expect.objectContaining({ code: 'invalid_buyer_role_proposal', candidateId: 'candidate-1' })],
    });
    expect(store.persistCandidates.mock.calls[0]?.[0].candidates).toEqual([]);
  });

  it('replays an identical terminal packet without duplicate candidates and conflicts on changed packets', async () => {
    const run = createRun();
    const store = createStore(run);
    const input = { searchRunId: run.id, userId: run.initiatingUserId, packet: packet() };

    await expect(processSearchTerminalResult(input, store)).resolves.toMatchObject({ kind: 'applied' });
    await expect(processSearchTerminalResult(input, store)).resolves.toMatchObject({ kind: 'replayed' });
    expect(store.persistCandidates).toHaveBeenCalledTimes(1);

    await expect(
      processSearchTerminalResult(
        { ...input, packet: packet([{ ...candidate, persona: { ...persona, title: 'COO' } }]) },
        store,
      ),
    ).resolves.toMatchObject({ kind: 'conflict' });
    expect(store.persistCandidates).toHaveBeenCalledTimes(1);
  });

  it('marks a succeeded zero-candidate packet processed without creating a Review row', async () => {
    const run = createRun();
    const store = createStore(run);
    const input = { searchRunId: run.id, userId: run.initiatingUserId, packet: packet([]) };

    await expect(processSearchTerminalResult(input, store)).resolves.toMatchObject({
      kind: 'applied',
      normalizedCandidateCount: 0,
    });
    expect(store.persistCandidates.mock.calls[0]?.[0].candidates).toEqual([]);
    await expect(processSearchTerminalResult(input, store)).resolves.toMatchObject({ kind: 'replayed' });
  });
});
