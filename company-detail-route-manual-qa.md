# Company detail route-state artifact

Captured after the lazy tab route implementation and before the final verification pass.

## Canonical URL smoke

Command:

```sh
npx tsx -e "import { buildCompanyCanonicalPath } from './src/lib/params/companyRoute'; const states = [['general', buildCompanyCanonicalPath(42, 'general')], ['personas', buildCompanyCanonicalPath(42, 'personas')], ['knowledge', buildCompanyCanonicalPath(42, 'knowledge')], ['analysis', buildCompanyCanonicalPath(42, 'analysis')]]; for (const [tab, path] of states) console.log(tab + ' -> ' + path);"
```

Observed:

```text
general -> /companies/42
personas -> /companies/42?tab=personas
knowledge -> /companies/42?tab=knowledge
analysis -> /companies/42?tab=analysis
```

## Active-tab query boundary matrix

| URL state | Shared query | Active content query | Inactive content queries |
| --- | --- | --- | --- |
| `/companies/42` | `getCompanyById` | signals + pending proposal count | personas, Arcpedia, analysis, offerings |
| `/companies/42?tab=personas` | `getCompanyById` | linked personas | signals, proposal count, Arcpedia, analysis, offerings |
| `/companies/42?tab=knowledge` | `getCompanyById` | Arcpedia search | signals, proposal count, personas, analysis, offerings |
| `/companies/42?tab=analysis` | `getCompanyById` | analysis history + candidate offerings | signals, proposal count, personas, Arcpedia |

The matrix is asserted by `src/components/companies/company-detail.test.tsx`; route normalization is asserted by `src/app/companies/[id]/page.test.tsx`.

## QA note

The route is staff-authenticated and its content requires the configured database. This artifact therefore records the deterministic route-state and query-boundary smoke rather than a live browser screenshot; the production build was verified with placeholder environment values and did not contact external services.
