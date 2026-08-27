DO $migration$
DECLARE
  target_template_id integer;
  previous_rules jsonb;
  previous_policy jsonb;
  previous_schema_version integer;
  contract text := $search_contract$# Arc Agent Net Search Contract

## 1. TASK

Execute a **Company Key Persona Search** for the supplied Company.

Find publicly identifiable people who may influence, sponsor, own, or execute GBS, shared-services, operating-model, transformation, finance, and technology decisions.

Search only for real people connected to the supplied Company. Return one strict JSON object matching the output contract in Section 2.

### Company input

```json
{
  "id": "<company.id>",
  "name": "<company.name>",
  "domain": "<company.domain>"
}
```

### Search objectives

Search public web sources for people holding current or recently relevant positions connected to these Buyer Roles:

#### CFO

Search for:

- Chief Financial Officer
- Group CFO
- Regional CFO
- Divisional CFO
- Finance Director when operating at CFO-equivalent scope
- Chief Finance Officer
- Executive Vice President of Finance
- VP Finance where responsible for enterprise finance strategy

Relevant indicators:

- owns cost reduction or margin improvement;
- sponsors finance transformation;
- owns business-case approval;
- oversees shared services or finance operations;
- announces restructuring, efficiency, or operating-model changes;
- controls investment decisions for ERP, GBS, SSC, or transformation programmes.

Do not classify every Finance Director or Controller as a CFO. Require evidence of enterprise-level authority or CFO-equivalent scope.

#### COO

Search for:

- Chief Operating Officer
- Group COO
- Regional COO
- Chief Operations Officer
- Operations Director with enterprise operating responsibility
- EVP Operations
- President/COO where responsible for operating performance

Relevant indicators:

- owns operating model or service delivery;
- oversees business-unit or enterprise operations;
- sponsors process standardization;
- owns operational efficiency, productivity, or service-quality initiatives;
- is accountable for execution of transformation programmes;
- oversees shared services, global operations, or functional operations.

Do not classify local plant, site, or team operations managers as COO-equivalent without evidence of broader scope.

#### Head of GBS

Search for:

- Head of Global Business Services
- Head of GBS
- Global Head of Business Services
- Chief Shared Services Officer
- Head of Shared Services
- Global Shared Services Leader
- VP/Director of Global Business Services
- VP/Director of Shared Services
- Head of Global Capability Centre
- Head of Global Operations Services
- Head of Business Services Transformation when accountable for the GBS organization

Relevant indicators:

- owns or builds a GBS, SSC, GCC, or shared-services organization;
- defines service catalogue, SLAs, KPIs, governance, or operating model;
- leads transition or migration of processes into GBS/SSC;
- hires transition managers, service-delivery leaders, or continuous-improvement leaders;
- announces GBS footprint, location, capability, or maturity initiatives;
- owns finance, HR, procurement, IT, or other services delivered through GBS.

Treat “Shared Services” and “Global Business Services” as related but not automatically equivalent. Require evidence that the person owns the organization, programme, or operating model.

#### Transformation Sponsor

Search for:

- Chief Transformation Officer
- Transformation Director
- Transformation Sponsor
- Enterprise Transformation Lead
- Business Transformation Director
- Programme Sponsor
- Executive Sponsor
- Strategic Transformation Officer
- PMO Director where accountable for an enterprise programme
- M&A Integration Lead or Carve-out Lead with executive programme responsibility
- Operating Model Transformation Lead

Relevant indicators:

- sponsors or owns a named transformation programme;
- leads enterprise operating-model redesign;
- leads M&A integration, carve-out, separation, or restructuring;
- owns a PMO or transformation portfolio;
- is publicly associated with a major change programme;
- has a mandate to redesign processes, organization, technology, or service delivery.

Do not classify a generic project manager as Transformation Sponsor without evidence of executive sponsorship or programme ownership.

#### CIO

Search for:

- Chief Information Officer
- Group CIO
- Chief Digital and Information Officer
- Chief Technology and Information Officer
- Chief Information and Digital Officer
- Chief Digital Officer where technology transformation is explicit
- EVP/VP Information Technology with enterprise scope
- IT Director with enterprise technology ownership

Relevant indicators:

- owns ERP, technology, data, digital, or IT transformation;
- sponsors SAP, Oracle, Microsoft, cloud, data, or enterprise-platform programmes;
- owns technology operating-model redesign;
- leads IT shared services or global technology delivery;
- announces enterprise systems implementation or modernization;
- controls technology investment and transformation priorities.

Do not classify a narrow application owner, engineering leader, or local IT manager as CIO-equivalent without enterprise scope.

### Search behavior

1. Start with the Company name and domain.
2. Use official Company pages, leadership pages, investor-relations pages, press releases, regulatory filings, reputable news, and public professional profiles.
3. Search title variants and synonyms for all five Buyer Roles.
4. Prefer current roles. Mark recently departed or historical roles only when useful and clearly dated.
5. Resolve identity carefully:
   - match the person to the supplied Company;
   - distinguish parent, subsidiary, former employer, and similarly named companies;
   - avoid duplicate representations of the same person;
   - do not infer identity from a name alone.
6. Collect evidence for:
   - identity;
   - current title;
   - Company association;
   - Buyer Role assignment;
   - relevant mandate or signal.
7. Separate observed facts from inference.
8. Return candidates even when some optional fields are unavailable.
9. Return zero candidates when no person can be supported by public evidence.
10. Never invent a person, title, URL, company relationship, claim, source, or Buyer Role assignment.

## 2. EXPECTED OUTCOME

Return exactly one JSON object:

```json
{
  "schemaVersion": 1,
  "candidates": [
    {
      "candidateId": "candidate-001",
      "persona": {
        "firstName": "Jane",
        "lastName": "Doe",
        "fullName": "Jane Doe",
        "title": "Chief Financial Officer",
        "email": null,
        "linkedinUrl": "https://www.linkedin.com/in/jane-doe",
        "phone": null,
        "location": null,
        "department": "Finance",
        "function": "Executive",
        "seniority": "C-Level",
        "companyName": "Example Company",
        "companyDomain": "example.com",
        "bio": null,
        "photoUrl": null
      },
      "buyerRoleProposals": [
        {
          "buyerRoleId": 1,
          "buyerRoleName": "CFO",
          "matchedRuleIds": ["rule-cfo-title"],
          "confidence": "supported"
        }
      ],
      "sources": [
        {
          "sourceId": "source-001",
          "kind": "company_website",
          "url": "https://example.com/leadership/jane-doe",
          "title": "Executive Leadership",
          "providerLabel": "Example Company",
          "publishedAt": null,
          "accessedAt": "2026-08-27T00:00:00Z"
        }
      ],
      "claims": [
        {
          "claimId": "claim-001",
          "field": "persona.fullName",
          "value": "Jane Doe",
          "sourceIds": ["source-001"]
        },
        {
          "claimId": "claim-002",
          "field": "persona.title",
          "value": "Chief Financial Officer",
          "sourceIds": ["source-001"]
        }
      ]
    }
  ]
}
```

### Output rules

- No Markdown.
- No prose outside the JSON object.
- No outer `result` wrapper.
- No `priority` field.
- No checklist findings.
- No execution commentary.
- No hidden reasoning or private notes.
- No unknown fields.
- `schemaVersion` must equal `1`.
- Maximum `25` candidates.
- Candidate IDs must be unique.
- Source IDs must be unique within each candidate.
- Claim IDs must be unique within each candidate.
- A candidate may have multiple Buyer Role proposals.
- A candidate may have zero Buyer Role proposals if the identity is supported but role evidence is insufficient.
- Use `null` for unavailable Persona values.
- `persona.fullName` is mandatory.
- Do not use empty strings for unavailable nullable fields.

## 3. REQUIRED TOOLS

Use only publicly accessible sources:

- Official Company website
- Official leadership and management pages
- Investor-relations pages
- Public annual reports and regulatory filings
- Public press releases
- Reputable public news articles
- Public professional profiles
- Public business directories when identity and Company association are clear

Source requirements:

- Absolute HTTPS URL.
- No credentials in URLs.
- No localhost, private IP, internal, or unsafe host.
- Every source must contain `title` or `providerLabel`.
- Every factual claim must reference one or more source IDs.
- Do not cite search-result pages when the underlying source page is available.
- Do not use private databases, private CRM data, gated personal data, or fabricated URLs.

Allowed source kinds:

```text
company_website
news_article
press_release
professional_profile
directory_listing
regulatory_filing
other
```

## 4. MUST DO

- Search all five Buyer Role families:
  - CFO
  - COO
  - Head of GBS
  - Transformation Sponsor
  - CIO
- Include title variants, abbreviations, equivalent titles, and regional variants.
- Preserve exact observed names and titles in Persona fields.
- Normalize obvious formatting differences without changing meaning.
- Assign a Buyer Role only when the title or public mandate supports it.
- Include `matchedRuleIds` only for rules actually matched by the evidence.
- Use `confidence: "supported"` only when public evidence supports the role.
- Use `confidence: "uncertain"` when the role is plausible but insufficiently proven.
- Link every claim to valid source IDs.
- Include source evidence for:
  - person identity;
  - Company relationship;
  - title;
  - role or mandate;
  - relevant transformation/GBS/operating signal where available.
- Deduplicate people across sources.
- Prefer a smaller set of well-supported candidates over a larger speculative set.
- Return `candidates: []` when evidence is insufficient.
- Ensure the final response parses as strict JSON before returning it.

## 5. MUST NOT DO

- Do not return the legacy Analysis format:
  ```json
  {
    "result": {
      "checklistFindings": []
    },
    "priority": "low"
  }
  ```
- Do not return `checklistFindings`.
- Do not return a narrative-only answer.
- Do not invent evidence.
- Do not infer a current role from an undated or historical page without qualification.
- Do not assign all five roles to every candidate.
- Do not classify generic managers as executive Buyer Roles without scope evidence.
- Do not expose private personal data.
- Do not include personal email addresses or phone numbers unless they are explicitly public business contact details.
- Do not include unsupported Buyer Role IDs or rule IDs.
- Do not create new Buyer Roles.
- Do not write to the Company, Persona, Company Persona Role, or Buyer Role records.
- Do not approve candidates automatically.
- Do not merge candidates automatically.
- Do not include tool traces, private reasoning, or provider metadata.
- Do not exceed the candidate, source, claim, or packet limits.

## 6. CONTEXT

### Input context

```json
{
  "schemaVersion": 1,
  "analysis": {
    "subjectType": "company",
    "company": {
      "id": "<company.id>",
      "name": "<company.name>",
      "domain": "<company.domain>"
    },
    "resolvedInstructions": "<this contract>"
  }
}
```

### Partner submission envelope

360 must submit:

```json
{
  "spec_id": "6f9b69d738a24462b620a3c38968985b",
  "task": "<resolvedInstructions>",
  "context": {
    "schemaVersion": 1,
    "analysis": {
      "subjectType": "company",
      "company": {
        "id": "<company.id>",
        "name": "<company.name>",
        "domain": "<company.domain>"
      },
      "resolvedInstructions": "<this contract>"
    }
  }
}
```

### Contract identity

```text
spec_id: 6f9b69d738a24462b620a3c38968985b
spec: Company Persona Search
target: company
executor: arc-agentnet
```

### Terminal success condition

A successful run must produce:

```json
{
  "schemaVersion": 1,
  "candidates": []
}
```

or a populated `candidates` array following this contract.

The response is successful only when:

1. Arc Agent Net returns valid JSON.
2. The JSON matches the Search packet schema.
3. Candidates, sources, claims, and Buyer Role proposals pass server validation.
4. Unsupported or invented evidence is absent.
5. Candidates enter 360 as staged Reviews, not automatically approved records.$search_contract$;
BEGIN
  SELECT "id"
  INTO target_template_id
  FROM "search_template"
  WHERE "key" = 'company-buying-signal-search'
     OR "name" = 'Company Buying Signal Search'
  ORDER BY CASE WHEN "key" = 'company-buying-signal-search' THEN 0 ELSE 1 END, "id"
  LIMIT 1
  FOR UPDATE;

  IF target_template_id IS NULL THEN
    RAISE EXCEPTION 'Company Buying Signal Search template does not exist';
  END IF;

  SELECT "buyer_role_rules", "evidence_policy", "schema_version"
  INTO previous_rules, previous_policy, previous_schema_version
  FROM "search_template_version"
  WHERE "template_id" = target_template_id
  ORDER BY "version" DESC
  LIMIT 1;

  IF previous_rules IS NULL OR previous_policy IS NULL OR previous_schema_version IS NULL THEN
    RAISE EXCEPTION 'Company Buying Signal Search has no version to extend';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "search_template_version"
    WHERE "template_id" = target_template_id
      AND "resolved_instructions" = contract
  ) THEN
    INSERT INTO "search_template_version" (
      "template_id",
      "version",
      "name",
      "resolved_instructions",
      "buyer_role_rules",
      "evidence_policy",
      "schema_version",
      "status",
      "created_by"
    )
    SELECT
      target_template_id,
      COALESCE(MAX("version"), 0) + 1,
      'Company Buying Signal Search',
      contract,
      previous_rules,
      previous_policy,
      previous_schema_version,
      'active',
      'migration'
    FROM "search_template_version"
    WHERE "template_id" = target_template_id;
  END IF;
END;
$migration$;
