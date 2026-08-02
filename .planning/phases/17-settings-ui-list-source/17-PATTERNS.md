# Phase 17: Settings UI + List Source - Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 12 new/modified files (6 modified + 4 new + 2 consumed-as-is)
**Analogs found:** 12 / 12 (every file has an exact or role-match analog — zero "no analog" cases)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/nav.ts` (mod) | utility (pure) | request-response (route match) | itself (current file, `src/lib/nav.ts`) | exact (self-mod) |
| `src/lib/nav.test.ts` (mod) | test | — | itself (`src/lib/nav.test.ts`, 11-case suite) | exact |
| `src/lib/sidebar-collapse.ts` (mod) | utility (pure) | — | itself (`src/lib/sidebar-collapse.ts`) | exact |
| `src/lib/sidebar-collapse.test.ts` (mod) | test | — | itself (`src/lib/sidebar-collapse.test.ts`) | exact |
| `src/components/layout/app-sidebar.tsx` (mod) | component | request-response (nav) | Reviews `SidebarMenuItem` in same file (lines 172-199) | exact |
| `src/app/companies/page.tsx` (mod) | page (server) | request-response | itself (line 28 `ExplorerMenu` call) | exact |
| `src/app/personas/page.tsx` (mod) | page (server) | request-response | itself (line 26 `ExplorerMenu` call) | exact |
| `src/lib/models/catalog.ts` + `catalog.test.ts` (mod, D-01) | config/utility | — | itself (current file + test) | exact |
| `src/app/(dashboard)/settings/page.tsx` (NEW) | page (server) | request-response + CRUD read | `src/app/(dashboard)/reviews/page.tsx` | exact |
| `src/components/settings/model-settings-form.tsx` (NEW) | component (client) | request-response (form) | `src/components/reviews/review-queue.tsx` | role-match |
| `src/app/actions/settings.ts` (NEW) | action (controller) | CRUD write | `src/app/actions/reviews.ts` | exact |
| `src/app/actions/settings.test.ts` (NEW) | test | — | `src/app/actions/reviews.test.ts` | exact |
| `src/lib/db/queries/userModelSettings.ts` (consumed as-is) | query module | CRUD read/write | itself — do NOT modify | exact |
| `src/lib/models/catalog.ts` + `catalog.json` (consumed as picker source) | config/data | — | itself — read-only for the page | exact |

---

## Pattern Assignments

### `src/lib/nav.ts` (utility, pure — MODIFIED)

**Analog:** itself. `NavKey` union is the single source of truth for every nav surface (sidebar + tooltip map).

**Current union + guard discipline** (`src/lib/nav.ts:6-15` — the sibling-prefix guard is contract-locked, QLTY-01/Pitfall 7):
```typescript
export type NavKey = 'start' | 'companies' | 'personas' | 'reviews';   // line 6

export function getActiveNavKey(pathname: string): NavKey | null {
  if (pathname === '/') return 'start'; // exact — every route is a prefix match for '/'
  if (pathname === '/companies' || pathname.startsWith('/companies/')) return 'companies';
  if (pathname === '/personas' || pathname.startsWith('/personas/')) return 'personas';
  if (pathname === '/reviews' || pathname.startsWith('/reviews/')) return 'reviews';
  return null; // /sign-in, '', unknown
}
```

**Change to make (UI-SPEC §Nav wiring item 1, `17-UI-SPEC.md:143`):**
- Union line 6: add `'settings'` → `export type NavKey = 'start' | 'companies' | 'personas' | 'reviews' | 'settings';`
- In `getActiveNavKey`, add an **exact-match-only** branch: `if (pathname === '/settings') return 'settings';` — /settings is a leaf page with no detail routes, so do NOT use the `startsWith('/settings/')` form (keep the sibling-prefix guard discipline; there is no `/settings/...` child to highlight).

**Test to add** (`src/lib/nav.test.ts` — follow the 11-case shape, lines 29-35 are the closest precedent):
```typescript
it("returns 'reviews' for the reviews index", () => {           // template
  expect(getActiveNavKey('/reviews')).toBe('reviews');
});
```
Add: `getActiveNavKey('/settings')` → `'settings'`, and (boundary guard) `getActiveNavKey('/settings-archive')` → `null` if the planner wants the guard pinned.

---

### `src/lib/sidebar-collapse.ts` (utility, pure — MODIFIED)

**Analog:** itself.

**Current label map** (`src/lib/sidebar-collapse.ts:14-16` — copy contract is test-locked):
```typescript
export function getNavTooltipLabel(key: NavKey, pendingCount: number): string {
  if (key === 'reviews') return pendingCount > 0 ? `Reviews (${pendingCount})` : 'Reviews';
  return { start: 'Start', companies: 'Companies', personas: 'Key Personas' }[key];
}
```

**Change to make (UI-SPEC item 2):** add `settings: 'Settings'` to the object literal on line 16. The `reviews` special-case branch stays untouched (pending-count is Reviews-only).

**Test to add** (`src/lib/sidebar-collapse.test.ts:4-15` is the template — plain keys ignore the count):
```typescript
it("returns the verbatim 'Key Personas' label for the personas key, ignoring the count", () => {
  expect(getNavTooltipLabel('personas', 0)).toBe('Key Personas');
});
```
Add: `getNavTooltipLabel('settings', 0)` → `'Settings'` (and `('settings', 3)` → `'Settings'` — count ignored for non-reviews keys).

---

### `src/components/layout/app-sidebar.tsx` (component — MODIFIED)

**Analog:** the Reviews `SidebarMenuItem` in the Manage group, same file `src/components/layout/app-sidebar.tsx:172-183` (the new Settings item goes **below** it in the same `SidebarMenu`).

**Reviews item template (lines 172-183):**
```tsx
<SidebarMenuItem>
  <SidebarMenuButton
    asChild
    isActive={activeKey === 'reviews'}
    tooltip={getNavTooltipLabel('reviews', pendingCount)}
    className="h-[30px] p-0 px-2 gap-2.5 rounded-[4px] text-[15px] font-normal"
  >
    <Link href="/reviews">
      <Inbox />
      <span>Reviews</span>
    </Link>
  </SidebarMenuButton>
  {/* lines 184-198: pendingCount > 0 badge block — DO NOT copy for Settings */}
</SidebarMenuItem>
```

**Settings item change (UI-SPEC item 3, `17-UI-SPEC.md:145`):**
- Copy the item verbatim but: icon `<Settings />` (from lucide-react), `isActive={activeKey === 'settings'}`, `tooltip={getNavTooltipLabel('settings', pendingCount)}`, `<Link href="/settings">`, `<span>Settings</span>`.
- **No badge** — the `SidebarMenuBadge` + dot block (lines 184-198) is Reviews-only; omit it entirely.
- Add `Settings` to the lucide import on line 6: `import { Building2, Inbox, LayoutDashboard, Mail, PanelLeftClose, PanelLeftOpen, Settings, Users } from 'lucide-react';`
- The icon renders at 16px via the vendored `[&_svg]:size-4` — no explicit size class needed (UI-SPEC `17-UI-SPEC.md:145`).

**Sidebar anatomy context (do not touch):** the Manage group is `src/components/layout/app-sidebar.tsx:169-201` — `<SidebarGroup className="-mt-1">` with `<SidebarGroupLabel ...>Manage</SidebarGroupLabel>`. Insert the Settings item inside the existing `<SidebarMenu>` after the Reviews `</SidebarMenuItem>` (line 199).

---

### `src/app/companies/page.tsx` + `src/app/personas/page.tsx` (server pages — MODIFIED)

**Analog:** each file's own `ExplorerMenu` call.

**Current call** (`src/app/companies/page.tsx:28`, `src/app/personas/page.tsx:26` — identical shape, only the href differs):
```tsx
<ExplorerMenu variant="labeled" items={[{ label: 'Import', href: '/companies/import' }]} />
```

**Change to make (UI-SPEC item 4, `17-UI-SPEC.md:146`):** append the Settings item after Import — no `ExplorerMenu` component change:
```tsx
<ExplorerMenu
  variant="labeled"
  items={[
    { label: 'Import', href: '/companies/import' },
    { label: 'Settings', href: '/settings' },
  ]}
/>
```
(personas page: href stays `/personas/import` for Import; the Settings entry is identical `{ label: 'Settings', href: '/settings' }`.)

**`ExplorerMenu` items prop contract** (`src/components/explorer/explorer-menu.tsx:16-22`):
```tsx
items: { label: string; disabled?: boolean; href?: string }[];
```
`DropdownMenuItem` renders as `<Link href={item.href}>` when `href && !disabled` (lines 39-42). A plain href item needs no other wiring.

---

### `src/lib/models/catalog.ts` + `catalog.test.ts` (config/utility — MODIFIED only if D-01 re-verify passes)

**Analog:** itself. This is the allowlist gate + picker source; the page consumes it read-only.

**Constants to consume** (`src/lib/models/catalog.ts:13,24,30-32,43-47`):
```typescript
export const ANTHROPIC_ALLOWLIST: readonly string[] = ['claude-sonnet-4-6'];  // line 13 — D-01: may gain 'claude-haiku-4-5'
export const FAST_MODEL_ID = 'claude-sonnet-4-6';                              // line 24 — default primary when no config saved

export function getModelDisplayName(id: string): string {
  return catalogJson.models.find((m) => m.id === id)?.name ?? id;              // lines 30-32 — D-06 fallback to raw id
}

export function getAllowlistedServableIds(catalog: ModelCatalog): string[] {   // lines 43-47 — THE picker source (SET-07)
  return catalog.models
    .filter((m) => m.providerID === 'anthropic' && m.status !== 'deprecated')
    .map((m) => m.id)
    .filter((id): id is string => ANTHROPIC_ALLOWLIST.includes(id));
}
```

**D-01 roster re-verify (standing maintenance):** re-run the Phase 15 `GET /v1/models` check for the **undated** `claude-haiku-4-5`. If present → add `'claude-haiku-4-5'` to `ANTHROPIC_ALLOWLIST` (line 13). If absent → ship sonnet-only (D-02), no dated IDs ever (Phase 15 D-02 no-invented/dated-IDs rule — requires explicit user override). The snapshot already contains the undated anthropic entry (`catalog.json` line 1487, "Claude Haiku 4.5 (latest)", cost 1/5) — but the **snapshot is the menu, the allowlist is the gate** (Phase 15 D-03); snapshot presence alone is NOT enough.

**Catalog fixture + gate tests to extend** (`src/lib/models/catalog.test.ts` — the inline-fixture pattern, lines 14-58, and the D-02 gate test, lines 84-89):
```typescript
describe('ANTHROPIC_ALLOWLIST', () => {
  it('contains only roster-verified undated raw IDs per the D-02 gate (sonnet-only default)', () => {
    expect(ANTHROPIC_ALLOWLIST).toEqual(['claude-sonnet-4-6']);
    expect(ANTHROPIC_ALLOWLIST.every((id) => !/-20\d{6}/.test(id))).toBe(true);   // no-invented/dated-IDs rule pinned
  });
});
```
The fixture is deliberately decoupled from the committed `catalog.json` (comment lines 11-13) — if `getAllowlistedServableIds` fixture expectations change with the D-01 allowlist growth, update the fixture's expected array.

**Cost caption data (D-03 picker rows, UI-SPEC `17-UI-SPEC.md:183`):** read from the snapshot's **anthropic** entry by id, matching `getModelDisplayName`-style first-match lookup:
- `claude-sonnet-4-6` (anthropic, `catalog.json:1753-1770`): name "Claude Sonnet 4.6", cost input **3** / output **15** → `Claude Sonnet 4.6 · $3 / $15 per MTok`
- `claude-haiku-4-5` (anthropic, `catalog.json:1487-1504`): name "Claude Haiku 4.5 (latest)", cost input **1** / output **5** → `Claude Haiku 4.5 · $1 / $5 per MTok` (only if D-01 lands)
- `generatedAt`: `"2026-08-02T09:33:54.568Z"` (`catalog.json:2`) → footer `Catalog synced Aug 2, 2026`

---

### `src/app/(dashboard)/settings/page.tsx` (NEW — server page)

**Analog:** `src/app/(dashboard)/reviews/page.tsx` (verbatim structural template).

**Page template to copy** (`src/app/(dashboard)/reviews/page.tsx:13-41`):
```tsx
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { listPendingProposals } from '@/lib/db/queries/proposals';
import { ReviewQueue } from '@/components/reviews/review-queue';

export default async function ReviewsPage() {
  await requireStaffAccess();          // belt-and-suspenders alongside (dashboard) layout gate

  let proposals: Awaited<ReturnType<typeof listPendingProposals>>;
  try {
    proposals = await listPendingProposals();
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">Couldn't load proposals</p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12 p-8">
      <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">Review Proposals</h1>
      <ReviewQueue proposals={proposals} />
    </div>
  );
}
```

**Settings page deltas (UI-SPEC §Page, `17-UI-SPEC.md:149-154`):**
- Route: `src/app/(dashboard)/settings/page.tsx` — inside the group so `(dashboard)/layout.tsx` (`src/app/(dashboard)/layout.tsx:8-12`, `requireStaffAccess` + `<AppShellLayout>`) wraps it. Keep the in-page `await requireStaffAccess()` anyway (belt-and-suspenders, reviews precedent).
- Page container: `flex flex-col gap-8 p-8` (NOT `gap-12` — the form card is the only major block, UI-SPEC line 44).
- `<h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">Settings</h1>` — reviews h1 class verbatim.
- Error card: same class list verbatim, copy swapped to heading `Couldn't load your settings` (UI-SPEC line 124); body copy stays verbatim `Something went wrong fetching this data. Try refreshing the page.`
- Data (server-rendered, never client-fetched — UI-SPEC line 152):
  - `const { userId } = await requireStaffAccess();`
  - `settings = await getModelSettingsForUser(userId)` → `{ primaryModel, fallbackModels } | undefined` (wrapped in the same `try/catch → error card`)
  - `const servableIds = getAllowlistedServableIds(catalog)` — **never raw catalog rows** (SET-07 / Phase 15 D-03)
  - per-model `{ id, name, costInput, costOutput }` from the snapshot's **anthropic** entries by id (first-match lookup like `getModelDisplayName`)
  - `catalog.generatedAt` for the footer
- Render `<ModelSettingsForm ... />` (new client component) with those props + `catalog.generatedAt`.

**Consumed query module (do NOT modify — `src/lib/db/queries/userModelSettings.ts:9-13`):**
```typescript
export async function getModelSettingsForUser(userId: string) {
  return db.query.userModelSettings.findFirst({
    where: eq(userModelSettings.userId, userId),
  });
}
```
Row shape (`src/lib/db/schema.ts:288-296`): `userId: text PK`, `primaryModel: text notNull`, `fallbackModels: text[] notNull default []`, `createdAt`, `updatedAt`. Absence = `undefined` (REG-05: "use the default chain"), never a throw; no try/catch in the query module — **the page owns the catch**.

---

### `src/components/settings/model-settings-form.tsx` (NEW — client form)

**Analog:** `src/components/reviews/review-queue.tsx` (useState + useTransition draft staging, inline status copy, `Button` pending pattern).

**Client scaffolding to copy** (`src/components/reviews/review-queue.tsx:1-3, 49-76`):
```tsx
'use client';

import { useState, useTransition } from 'react';
// ... imports for the action + primitives

export function ReviewQueue({ proposals }: { proposals: PendingProposal[] }) {
  const [cardStates, setCardStates] = useState<Record<number, CardState>>({});
  const [, startTransition] = useTransition();
  const router = useRouter();               // NOTE: settings form does NOT need useRouter — see below

  function handleAccept(proposal: PendingProposal) {
    setCard(proposal.id, { status: 'accepting' });
    startTransition(async () => {
      const result = await acceptProposalAction(proposal.id);
      if (result.ok) {
        setCard(proposal.id, { status: 'accepted' });
      } else {
        const retryable = result.reason === 'action_failed';
        setCard(proposal.id, {
          status: 'error',
          message: ERROR_COPY[result.reason] ?? ERROR_COPY.action_failed,
          retryable,
        });
      }
    });
  }
  ...
}
```

**Settings form deltas (UI-SPEC §Form card + §Fallback section + §Save lifecycle, `17-UI-SPEC.md:156-192`):**
- Draft state: `const [primary, setPrimary] = useState<string>(saved?.primaryModel ?? FAST_MODEL_ID)` + `const [fallbacks, setFallbacks] = useState<string[]>(saved?.fallbackModels ?? [])` — all edits stage locally (D-07), nothing persists until Save (D-12).
- Save handler mirrors `handleAccept`: `startTransition(async () => { const result = await saveSettingsAction({ primaryModel: primary, fallbacks }); ... })`. **D-13: on failure the draft is preserved verbatim — never reset the `useState`.** No `router.refresh()` on success (UI-SPEC line 189: the page's server-rendered props are identical to the saved draft; the action's `revalidatePath('/settings')` keeps the server cache fresh — SET-06).
- Save button (reviews precedent, `review-queue.tsx:146-153`):
```tsx
<Button
  variant="default"
  disabled={isPending}
  onClick={handleSave}
>
  {isPending ? 'Saving…' : 'Save changes'}
</Button>
```
- Footer row class verbatim from `review-queue.tsx:143`: `flex items-center justify-between gap-2 border-t border-slate-100 pt-3`. Success text `text-[14px] font-normal leading-[1.5] text-slate-600` ("Saved.", line 160 precedent); error text `text-[14px] font-normal leading-[1.5] text-red-600` (line 169 precedent).
- Reason-code copy map (mirror `ERROR_COPY`, `review-queue.tsx:42-47`): `action_failed` → `Couldn't save your changes. Please try again.`; `stale_primary`/`stale_fallback` → `This model is no longer runnable — pick a replacement before saving.`; `invalid_model` → `This model is no longer available.`; `duplicate_model` → `Each model can only be used once.` (UI-SPEC lines 128-135).
- **Form card shell** (UI-SPEC line 158): `rounded-lg border border-slate-200 bg-white p-6 flex flex-col gap-6`. Empty-state callout (line 160): `rounded-lg border border-slate-200 bg-slate-50 p-4` (muted surface inside the white card), heading "No model configuration saved" (`text-[18px] font-semibold leading-[1.2] text-slate-900`), body copy from UI-SPEC line 118.
- **Fallback section branches on `servableIds.length`** (UI-SPEC lines 167-179):
  - Size 1 → muted note `No additional models available — only one model is runnable right now.` (Label 12/Body 14 `text-slate-500`), no rows, no Add button.
  - Size ≥ 2 → up to 2 rows; each row `flex items-center gap-2` with `Select` (`flex-1 min-w-0`, `id="fallback-1"`/`"fallback-2"`) + three ghost icon buttons: lucide `ArrowUp`/`ArrowDown`/`X`, `Button variant="ghost" size="icon"` (32px target, WCAG 2.5.8 — ghost icon button precedent: `app-sidebar.tsx:84-92`), aria-labels `Move fallback up`/`Move fallback down`/`Remove fallback`. Up disabled on row 1, down disabled on last row.
  - Option rules (D-08/D-09, client-enforced): fallback options = servable set − primary − other fallback selections; a chosen model disappears from the other slots. `Add fallback` = `Button variant="outline"` with 16px lucide `Plus`, disabled at 2 rows.
  - Reorder/remove operate on the `fallbacks` useState array only — never auto-persist (D-07).
- **Stale saved values (D-10/D-11):** a saved-but-dropped model renders as a `disabled` `SelectItem` with `(no longer runnable)` inline `text-red-600` warning below the field; Save `disabled` while any stale value is present (stale primary specifically blocks — D-11).
- **Field label pattern** — `FirmographicField` label class (`src/components/explorer/explorer-format.tsx:53`): `text-[12px] font-normal leading-[1.4] text-slate-500` above each select.
- **Footer date** — reuse the existing `dateFormatter` (`src/components/explorer/explorer-format.tsx:19-23`, en-US month-short/day/year): `Catalog synced {dateFormatter.format(new Date(catalog.generatedAt))}` → `Catalog synced Aug 2, 2026`. UI-SPEC line 123: **no new helper** — this resolves the D-04 discretion.

**Form primitives (already installed — do NOT add anything, UI-SPEC line 29):**
- `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` from `@/components/ui/select` (`src/components/ui/select.tsx:9-128`). `SelectTrigger size="default"` = `h-8` (line 47). `SelectItem` children go through `<SelectPrimitive.ItemText>` (line 125); the vendored `*:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2` (line 115) is the span-gap support that renders the name + cost caption on one row: `{name} · ${input} / ${output} per MTok` (UI-SPEC line 183).
- `Button` from `@/components/ui/button` (`src/components/ui/button.tsx`): variants `default` (dark, `bg-primary text-primary-foreground` — the Save button, NOT accent-colored, UI-SPEC line 96), `outline` (Add fallback), `ghost` (up/down/X); sizes `sm`, `icon` (`size-8` = 32px).

---

### `src/app/actions/settings.ts` (NEW — Server Action controller)

**Analog:** `src/app/actions/reviews.ts` (the exact controller pattern: `'use server'` + `requireStaffAccess` FIRST + zod `unknown` input + `{ ok } | { ok: false, reason }` envelope + `revalidatePath`).

**Action template to copy** (`src/app/actions/reviews.ts:1-6, 14, 20-33, 41-50`):
```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
// ... query imports

export type ReviewsActionResult = { ok: true } | { ok: false; reason: string };

export async function acceptProposalAction(proposalId: number): Promise<ReviewsActionResult> {
  await requireStaffAccess();                       // FIRST — Server Actions gate independently of the page

  try {
    const result = await acceptProposal(proposalId);
    if (result.ok) {
      revalidatePath('/reviews');
      revalidatePath('/companies');
    }
    return result;
  } catch {
    return { ok: false, reason: 'action_failed' };  // never throw to the client
  }
}

// zod-validate `unknown` BEFORE any write (fail-loud — reject input arrives as unknown)
const rejectInputSchema = z.object({
  reason: z.enum(correctionReasonEnum.enumValues),
  note: z.string().trim().max(500).optional(),
});
const parsed = rejectInputSchema.safeParse(input);
if (!parsed.success) return { ok: false, reason: 'invalid_reason' };
```

**`saveSettingsAction` signature + ordering (UI-SPEC §Server Action, `17-UI-SPEC.md:194-203` — order immutable):**
```typescript
export async function saveSettingsAction(input: unknown): Promise<{ ok: true } | { ok: false; reason: string }>
```
1. `await requireStaffAccess()` → `{ userId }` — FIRST, independent of the page gate.
2. Zod-parse `unknown`: `z.object({ primaryModel: z.string(), fallbacks: z.array(z.string()).max(2) })` via `.safeParse` → `{ ok: false, reason: 'invalid_model' }`-style reject on parse failure (reviews precedent returns `invalid_reason`; settings should use its own reason per the UI-SPEC reason-code table — see below).
3. Validate every id ∈ `getAllowlistedServableIds(catalog)` (server-computed, never trust client) → reject `invalid_model`.
4. Validate no duplicates and primary ∉ fallbacks (D-08/D-09 backstop) → reject `duplicate_model`.
5. `await upsertModelSettings(userId, { primaryModel, fallbackModels })` — atomic full-value upsert, no read-modify-write (Pitfall 9).
6. Success: `revalidatePath('/settings')` → `{ ok: true }`. Any throw → `{ ok: false, reason: 'action_failed' }`.

**Reason codes the client maps to copy (UI-SPEC lines 128-135):** `action_failed`, `stale_primary`, `stale_fallback` (server backstop for the client-side staleness gate), `invalid_model`, `duplicate_model`.

**Upsert to call (`src/lib/db/queries/userModelSettings.ts:18-34`, consumed as-is):**
```typescript
export async function upsertModelSettings(input: {
  userId: string;
  primaryModel: string;
  fallbackModels: string[];
}) {
  await db
    .insert(userModelSettings)
    .values({ ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userModelSettings.userId,
      set: {
        primaryModel: input.primaryModel,
        fallbackModels: input.fallbackModels,
        updatedAt: new Date(),
      },
    });
}
```

**Optional pure helpers (D-16 natural test targets, CONTEXT `17-CONTEXT.md:92`):** stale-config filtering (drop-from-roster detection) and dedupe helpers are pure functions — if the action/form share them, put them in a small `src/lib/settings/` module modeled on `src/lib/agents/modelConfig.ts:71-82` (dedupe semantics `[...new Set(raw)]` + allowlist gate + default fallback) so both the action and the form's Vitest coverage pin them with zero live calls.

---

### `src/app/actions/settings.test.ts` (NEW — action tests)

**Analog:** `src/app/actions/reviews.test.ts` (vi.hoisted mock registry + vi.mock of `next/cache`, auth, and DB queries; invocation-order assertion; `action_failed` envelope test).

**Test scaffold to copy** (`src/app/actions/reviews.test.ts:1-23, 33-46`):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn().mockResolvedValue({ userId: 'user_123' }),
  upsertModelSettings: vi.fn(),
  getAllowlistedServableIds: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}));
vi.mock('@/lib/db/queries/userModelSettings', () => ({
  upsertModelSettings: mocks.upsertModelSettings,
}));
vi.mock('@/lib/models/catalog', () => ({
  getAllowlistedServableIds: mocks.getAllowlistedServableIds,
  // also stub ANTHROPIC_ALLOWLIST / FAST_MODEL_ID if the action imports them
}));

import { revalidatePath } from 'next/cache';
import { saveSettingsAction } from './settings';

// assertions to mirror:
expect(result).toEqual({ ok: true });
expect(mocks.requireStaffAccess.mock.invocationCallOrder[0] <
       mocks.upsertModelSettings.mock.invocationCallOrder[0]).toBe(true);  // gate FIRST
expect(revalidatePath).toHaveBeenCalledWith('/settings');
// error-path tests: invalid input → no write; duplicate ids → 'duplicate_model';
// non-servable id → 'invalid_model'; upsert throw → { ok: false, reason: 'action_failed' }
```

---

## Shared Patterns

### Authentication (belt-and-suspenders)
**Source:** `src/lib/auth/requireStaffAccess.ts:10-16` — the ONLY function allowed to make a gating auth decision.
```typescript
export async function requireStaffAccess() {
  const { userId } = await auth(); // auth() is async under @clerk/nextjs — always await it
  if (!userId) {
    redirect('/sign-in');
  }
  return { userId };
}
```
**Apply to:** the settings page (first line of the server component) AND `saveSettingsAction` (first line, independent of the page). The `(dashboard)` layout (`src/app/(dashboard)/layout.tsx:8-12`) already gates the group; pages/actions gate themselves anyway.

### Server Action envelope — never throw to the client
**Source:** `src/app/actions/reviews.ts:14` — `{ ok: true } | { ok: false; reason: string }`; every action wraps its body in `try/catch → { ok: false, reason: 'action_failed' }` and revalidates **only** on `ok: true`.
**Apply to:** `saveSettingsAction`. Client maps `reason` → copy via a record (precedent: `ERROR_COPY` in `review-queue.tsx:42-47`).

### Per-widget error card (EXPL-06 — never the Next.js 500 page)
**Source:** `src/app/(dashboard)/reviews/page.tsx:24-31` — verbatim class list:
```
flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center
```
Heading: `text-[18px] font-semibold leading-[1.2] text-slate-900`; body: `text-sm text-slate-500`. Same card shape is reused for the empty state (`review-queue.tsx:80-86`) and the settings empty-state callout (different surface: `bg-slate-50 p-4`).
**Apply to:** settings page fetch failure ("Couldn't load your settings"), settings empty state ("No model configuration saved").

### revalidatePath after successful write
**Source:** `src/app/actions/reviews.ts:26-28`. `saveSettingsAction` calls `revalidatePath('/settings')` on success only (SET-06). No `router.refresh()` on the client — the settings page's server-rendered props equal the saved draft (UI-SPEC line 189).

### Vitest pure functions only, zero live calls (D-16)
**Source:** `src/lib/models/catalog.test.ts:11-13` (inline fixture decoupled from committed data) and `src/app/actions/reviews.test.ts` (vi.mock everything external). **Apply to:** new nav/sidebar tests, extended catalog tests, and any new pure settings helpers (stale-filter/dedupe). No test may make a live DB/API call.

### Date formatting
**Source:** `src/components/explorer/explorer-format.tsx:19-23` — `dateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' })`. **Apply to:** the "Catalog synced {date}" footer via `dateFormatter.format(new Date(catalog.generatedAt))`. No new helper (D-04 discretion resolved).

### Draft staging + useTransition save (D-07/D-12)
**Source:** `src/components/reviews/review-queue.tsx:50-76` — `useState` draft + `startTransition(async () => { const result = await action(...) })`; success → inline confirmation; failure → inline error + **draft preserved** (D-13). **Apply to:** `model-settings-form.tsx`.

---

## No Analog Found

None. Every file in this phase has an exact or role-match analog. Two mild novelty notes for the planner (not gaps):

| Novelty | Where | Covered By |
|---------|-------|-----------|
| Select row with name + cost caption on one line | fallback/primary `SelectItem` | Vendored `SelectItem` span-gap support (`src/components/ui/select.tsx:115` `*:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2`) — no component change needed |
| Up/down arrow reorder (no DnD dependency) | fallback rows | Ghost `size="icon"` buttons precedent (`app-sidebar.tsx:84-92`) + lucide `ArrowUp`/`ArrowDown`/`X`; logic is a trivial array move in `useState` |

No new dependency, no new shadcn install (UI-SPEC line 29: `select` + `button` already installed; inventory covers everything).

---

## Metadata

**Analog search scope:** `src/lib/nav.ts`, `src/lib/sidebar-collapse.ts`, `src/lib/nav.test.ts`, `src/lib/sidebar-collapse.test.ts`, `src/components/layout/app-sidebar.tsx`, `src/components/explorer/explorer-menu.tsx`, `src/app/companies/page.tsx`, `src/app/personas/page.tsx`, `src/app/(dashboard)/reviews/page.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/actions/reviews.ts`, `src/app/actions/reviews.test.ts`, `src/components/reviews/review-queue.tsx`, `src/lib/db/queries/userModelSettings.ts`, `src/lib/db/schema.ts` (user_model_settings), `src/lib/models/catalog.ts`, `src/lib/models/catalog.test.ts`, `src/lib/models/catalog.json`, `src/lib/agents/modelConfig.ts`, `src/lib/auth/requireStaffAccess.ts`, `src/components/explorer/explorer-format.tsx`, `src/components/ui/select.tsx`, `src/components/ui/button.tsx`
**Files scanned:** 23
**Pattern extraction date:** 2026-08-02
