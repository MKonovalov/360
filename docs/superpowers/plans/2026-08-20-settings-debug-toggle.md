# Settings Debug Toggle and Per-Session Launch Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-authorized, admin-only Settings Debug tab whose tab-scoped session preference routes later analysis launches to the existing ordinary or debug endpoint without changing ordinary staff behavior or adding successful raw-attempt capture.

**Architecture:** Keep `SettingsPage` as the server-side capability boundary. It computes only `canUseDebugLaunches` from the current Clerk identity and `debugAdminConfig`, then passes that boolean to `SettingsTabs`. Keep the session preference in a small client controller backed by versioned `sessionStorage`, exposing a confirmed `on | off` state and safe failure states to both the Debug panel and `AnalysisLauncher`. Keep route authorization server-only: the ordinary route calls `requireStaffAccess()` and the debug route calls `requireDebugAdminAccess()` before `launchAnalysisRun()`; the shared launch handler remains the only place that builds the persisted snapshot.

**Tech Stack:** Next.js 16 App Router, React 19 client/server components, TypeScript strict mode, Clerk `@clerk/nextjs/server`, Zod, Tailwind CSS 4, Radix UI primitives already used by the repository, Vitest 4, React Testing Library patterns already present in component tests, and Playwright for browser accessibility checks.

## Global Constraints

- Preserve the existing Settings layout, line-style tab primitives, spacing, typography, and current Models and Data Sources DOM contract.
- Render the Debug tab only when the server-computed `canUseDebugLaunches` boolean is true. Never pass the allowlist, Clerk IDs, environment values, or raw debug configuration to the client.
- Treat the browser preference as a tab-scoped `sessionStorage` value with a versioned key and the closed values `on` and `off`. Never use local storage, cookies, the database, Clerk profile data, or environment mutation.
- The safe default is Off. Read and write failures must not select the debug route. Updating and Unavailable states disable the switch and launch action as specified.
- The launcher keeps its existing options and preview requests. The only launch difference is the endpoint, `/api/analysis-runs` for Off and `/api/debug/analysis-runs` for On.
- The launch request body remains the existing payload. Do not send `debugCaptureEnabled`, `debugAdminUserIds`, a client user ID, or another authorization field.
- The debug route must reauthorize with `requireDebugAdminAccess()` before parsing, mutation, dispatch, or debug work. Unauthorized access keeps the existing not-found behavior.
- The shared launch handler owns `debugCaptureEnabled` and the immutable execution snapshot. Current failed-only capture, redaction, bounds, retention, diagnostics, polling, review, and normalized-result behavior remain unchanged.
- This feature does not add successful raw-attempt capture. Successful raw capture remains a separate design and must not gain new implementation or tests here.
- Do not add database tables, migrations, environment variables, generated files, or product-wide debug settings.
- Every task ends with a focused test command and a focused commit. Use the repository's existing plain Vitest commit style for test and implementation commits.

---

## File Map and Interfaces

The implementation should touch only the following product files and their directly paired tests. No database, environment, migration, generated, or `.env.local` file is part of this plan.

| File | Responsibility | Planned interface |
| --- | --- | --- |
| `src/lib/analysis/debugLaunchPreference.ts` | Pure session preference state machine and browser storage adapter | `DebugPreference = 'on' | 'off'`; `DebugPreferenceStatus = 'loading' | 'confirmed' | 'updating' | 'unavailable'`; `DebugLaunchPreferenceController` with `subscribe`, `getSnapshot`, `setPreference`, `reset`, `dispose` |
| `src/lib/analysis/debugLaunchPreference.test.ts` | Unit coverage for storage, capability reset, malformed values, and failures | Tests inject a `StorageLike` and never depend on a real browser tab |
| `src/components/analysis/debug-launch-preference-provider.tsx` | Client-only provider that creates the controller after mount and exposes one tab-scoped context to Settings and launch dialogs | `DebugLaunchPreferenceProvider({ children })`; `useDebugLaunchPreference(): DebugLaunchPreferenceController` |
| `src/components/analysis/debug-launch-preference-provider.test.tsx` | Provider and hook lifecycle coverage | Asserts one controller is shared by descendants and capability changes reset before consumers can launch |
| `src/components/settings/debug-settings-panel.tsx` | Accessible Debug panel using the existing Settings visual language | Props `{ panelId: string }`; calls `useDebugLaunchPreference()` rather than receiving a non-serializable controller prop |
| `src/components/settings/settings-tabs.tsx` | Adds the conditional Debug trigger and panel | Props add `canUseDebugLaunches: boolean` and `debugSettings: ReactNode`; Models and Data Sources props remain unchanged |
| `src/components/settings/settings-tabs.test.tsx` | Hidden and eligible tab markup plus accessibility contract | Render with `canUseDebugLaunches: false` and true |
| `src/app/(dashboard)/layout.tsx` | Server to client capability boundary for the shared session controller | Derives `canUseDebugLaunches` on the server, uses only a stable capability-derived remount key, and passes no identity, allowlist, or debug config as client props |
| `src/app/(dashboard)/settings/page.tsx` | Server capability derivation | Computes `canUseDebugLaunches` from `userId` and `debugAdminConfig`; passes only the boolean and a panel node |
| `src/components/analysis/analysisLauncherClient.ts` | Pure route selector and existing request helpers | `analysisRunEndpoint(preference: DebugPreference): '/api/analysis-runs' | '/api/debug/analysis-runs'` |
| `src/components/analysis/AnalysisLauncher.tsx` | Reads confirmed preference at submit time and selects endpoint | Consumes `useDebugLaunchPreference()` from the dashboard provider; it must not infer authorization |
| `src/components/analysis/analysisLauncherClient.test.ts` | Endpoint selection and payload exclusion tests | Asserts route only changes, payload remains identical, and unavailable maps to ordinary route |
| `src/app/api/analysis-runs/route.test.ts` | Ordinary route regression and forged-field behavior | Ordinary route always passes `debugCaptureEnabled: false` after `requireStaffAccess()` |
| `src/app/api/debug/analysis-runs/route.test.ts` | Debug route authorization ordering and server-derived flag | Debug route requires `requireDebugAdminAccess()` before `launchAnalysisRun()` and passes true only after success |
| `src/lib/analysis/launchAnalysisRun.test.ts` | Shared handler sanitization and snapshot handoff | Client debug fields are removed or ignored; caller option is the only source of the snapshot flag |
| `src/lib/analysis/snapshots.test.ts` | Immutable per-run snapshot contract | Both true and false inputs are persisted in the execution snapshot and remain unchanged after input/config mutation |
| `src/lib/auth/requireDebugAdminAccess.test.ts` | Existing fail-closed authorization boundary | Gate false, invalid config, anonymous, ordinary staff, and allowlisted admin cases remain explicit |

### Exact UI to launcher boundary

The Settings page and the launcher must share a session controller, not a global singleton and not a user setting. The controller's confirmed value is the only value that may select a route:

```ts
export type DebugPreference = 'on' | 'off';
export type DebugPreferenceStatus =
  | 'loading'
  | 'confirmed'
  | 'updating'
  | 'unavailable';

export type DebugPreferenceSnapshot = Readonly<{
  preference: DebugPreference;
  status: DebugPreferenceStatus;
  errorMessage: string | null;
}>;

export interface DebugLaunchPreferenceController {
  getSnapshot(): DebugPreferenceSnapshot;
  subscribe(listener: () => void): () => void;
  setPreference(next: DebugPreference): Promise<void>;
  reset(): void;
  dispose(): void;
}

export function analysisRunEndpoint(
  preference: DebugPreference,
): '/api/analysis-runs' | '/api/debug/analysis-runs';
```

`AnalysisLauncher` must consume `useDebugLaunchPreference()`, disable submit while the snapshot status is `loading`, `updating`, or `unavailable`, and call `analysisRunEndpoint(snapshot.preference)` on submit. Since `unavailable` always carries `preference: 'off'`, it cannot select the debug route. A preference change after a POST starts cannot mutate that request or run. The provider is mounted once in the authenticated dashboard layout, so the Settings panel and every `AnalysisLauncher` descendant share the same browser-tab controller without attempting to serialize a controller through a server component.

## Tasks

### Task 1: Lock the preference state machine and storage contract

**Files:**
- Create: `src/lib/analysis/debugLaunchPreference.ts`
- Test: `src/lib/analysis/debugLaunchPreference.test.ts`

**Interfaces:**
- Consumes: tab-scoped storage only; capability changes are handled by the server layout's capability-derived provider remount key, not by the client controller.
- Produces: `DebugPreference`, `DebugPreferenceStatus`, `DebugPreferenceSnapshot`, `StorageLike`, `createDebugLaunchPreferenceController(storage)`, and `DebugLaunchPreferenceController` as defined above.

- [x] **Step 1: Write failing unit tests for initial and confirmed states.**

```ts
it('starts Off while storage is being read, then confirms a valid On value', async () => {
  const storage = memoryStorage({ 'arclumen:debug-launch:v1': 'on' });
  const controller = createDebugLaunchPreferenceController(storage);

  expect(controller.getSnapshot()).toMatchObject({ preference: 'off', status: 'loading' });
  await flushPreferenceRead(controller);
  expect(controller.getSnapshot()).toMatchObject({ preference: 'on', status: 'confirmed' });
});

it.each(['', 'ON', 'true', 'user_admin', '{"preference":"on"}'])(
  'treats malformed stored value %j as unavailable Off',
  async (value) => {
    const controller = createDebugLaunchPreferenceController(
      memoryStorage({ 'arclumen:debug-launch:v1': value }),
    );
    await flushPreferenceRead(controller);
    expect(controller.getSnapshot()).toMatchObject({
      preference: 'off',
      status: 'unavailable',
      errorMessage: 'Debug launch setting is unavailable. Debug launches are Off.',
    });
  },
);
```

- [x] **Step 2: Run the focused test and verify it fails because the controller does not exist.**

Run: `npm test -- src/lib/analysis/debugLaunchPreference.test.ts`

Expected: FAIL with an import or missing-export error for `createDebugLaunchPreferenceController`.

- [x] **Step 3: Implement the minimal controller.**

Use a versioned key constant, a `StorageLike` interface containing `getItem`, `setItem`, and `removeItem`, and a private listener set. Read in a microtask so the first snapshot is visibly `loading`. Accept only exact `on` or `off`. Treat missing storage as a confirmed Off value, but treat thrown reads, malformed values, and unavailable storage as `unavailable` Off. Never store identity or launch data.

- [x] **Step 4: Add failing tests for writes, reset, identity isolation, and failure safety.**

```ts
it('keeps the last confirmed value while updating and confirms only after a successful write', async () => {
  const storage = memoryStorage();
  const controller = await readyController(storage);
  const pending = deferred<void>();
  storage.setItem = vi.fn(() => pending.promise);

  const update = controller.setPreference('on');
  expect(controller.getSnapshot()).toMatchObject({ preference: 'off', status: 'updating' });
  pending.resolve();
  await update;
  expect(controller.getSnapshot()).toMatchObject({ preference: 'on', status: 'confirmed' });
});

it('resets to Off and removes the value on sign-out or identity change', async () => {
  const storage = memoryStorage({ 'arclumen:debug-launch:v1': 'on' });
  const controller = await readyController(storage);
  controller.reset();
  expect(controller.getSnapshot().preference).toBe('off');
  expect(storage.getItem('arclumen:debug-launch:v1')).toBeNull();
});

it('never selects Debug On after a storage write failure', async () => {
  const storage = memoryStorage();
  const controller = await readyController(storage);
  storage.setItem = vi.fn(() => { throw new Error('blocked'); });
  await expect(controller.setPreference('on')).rejects.toThrow('blocked');
  expect(controller.getSnapshot()).toMatchObject({ preference: 'off', status: 'unavailable' });
});
```

- [x] **Step 5: Implement write, reset, subscription, remount reset, and disposal behavior.**

`setPreference` must reject while already updating, keep the prior confirmed value until `setItem` resolves, and set `unavailable` on failure. `reset` must set Off, remove the key when possible, and notify subscribers. The provider's unmount cleanup must reset and dispose the controller; the layout's identity key then mounts a fresh safe-Off controller before it reads storage. `dispose` must stop notifications and pending work.

- [x] **Step 6: Run the focused tests and commit the isolated state-machine unit.**

Run: `npm test -- src/lib/analysis/debugLaunchPreference.test.ts`

Expected: PASS with coverage for new tab Off, reload On or Off, malformed values, read/write failures, updating, reset before remount, and no sensitive storage content.

Commit: `git add src/lib/analysis/debugLaunchPreference.ts src/lib/analysis/debugLaunchPreference.test.ts && git commit -m "Add debug launch session preference"`

### Task 2: Add the admin-only Debug Settings panel without changing existing tabs

**Files:**
- Create: `src/components/settings/debug-settings-panel.tsx`
- Modify: `src/components/settings/settings-tabs.tsx`
- Test: `src/components/settings/settings-tabs.test.tsx`

**Interfaces:**
- Consumes: `DebugLaunchPreferenceController`, `DebugPreferenceSnapshot`, existing `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent` primitives.
- Produces: `DebugSettingsPanel` with an accessible switch and `SettingsTabs({ modelSettings, dataSources, canUseDebugLaunches, debugSettings })`.

- [x] **Step 1: Extend SettingsTabs tests with hidden and eligible cases.**

```tsx
it('omits every Debug element for ordinary staff', () => {
  const html = renderToStaticMarkup(
    <SettingsTabs
      modelSettings={<p>Model settings body</p>}
      dataSources={<p>Data source body</p>}
      canUseDebugLaunches={false}
      debugSettings={<p>Debug settings body</p>}
    />,
  );
  expect(html).not.toContain('Debug');
  expect(html).not.toContain('debug launch');
});

it('renders Debug after existing tabs only for eligible admins', () => {
  const html = renderToStaticMarkup(
    <SettingsTabs
      modelSettings={<p>Model settings body</p>}
      dataSources={<p>Data source body</p>}
      canUseDebugLaunches
      debugSettings={<p>Debug settings body</p>}
    />,
  );
  expect(html.indexOf('Data Sources')).toBeLessThan(html.indexOf('Debug'));
  expect(html).toContain('Settings sections');
  expect(html).toContain('Debug settings body');
});
```

- [x] **Step 2: Run the focused test and verify the new eligibility assertions fail.**

Run: `npm test -- src/components/settings/settings-tabs.test.tsx`

Expected: FAIL because `SettingsTabs` does not accept the new props or render the conditional tab.

- [x] **Step 3: Implement the conditional tab and panel using existing styling.**

Keep the existing Models and Data Sources JSX unchanged. Add the Debug trigger and content only inside `canUseDebugLaunches`. The panel must include a heading such as `Analysis debug launches`, session-only explanation, explicit `Debug On` or `Debug Off` text, the note that only bounded failed-attempt diagnostics are retained, and the warning that successful-attempt capture and other users' settings are unchanged.

Use a native button with `role="switch"`, `aria-checked`, a visible focus ring, and a programmatic label `Enable debug launches for this browser session`. Use `role="status"` and `aria-live="polite"` for Loading, Updating, and Unavailable. Use the existing alert pattern for non-sensitive errors. Disable the control and launch integration for Loading, Updating, and Unavailable. Do not introduce a new design-system component.

- [x] **Step 4: Add panel tests for all visible states and accessibility.**

Cover Loading disabled status, Off unchecked text, On checked text, Updating disabled status, Unavailable Off plus non-sensitive status, `aria-checked` matching visible text, keyboard Space activation, visible label while disabled, and the absence of copy that implies successful raw capture or global configuration.

- [x] **Step 5: Run the focused test and commit the settings UI unit.**

Run: `npm test -- src/components/settings/settings-tabs.test.tsx`

Expected: PASS. Existing Models and Data Sources assertions remain unchanged, while hidden and eligible Debug behavior is covered.

Commit: `git add src/components/settings/debug-settings-panel.tsx src/components/settings/settings-tabs.tsx src/components/settings/settings-tabs.test.tsx && git commit -m "Add admin debug settings tab"`

### Task 3: Derive server visibility and wire one session controller into Settings and launch surfaces

**Files:**
- Create: `src/components/analysis/debug-launch-preference-provider.tsx`
- Test: `src/components/analysis/debug-launch-preference-provider.test.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Modify: `src/components/settings/debug-settings-panel.tsx`
- Modify: `src/components/analysis/AnalysisLauncher.tsx`
- Create: `src/app/(dashboard)/settings/page.test.tsx`
- Test: `src/components/settings/debug-settings-panel.test.tsx`

**Interfaces:**
- Consumes: `userId` from `requireStaffAccess()` in the dashboard layout and settings page, `debugAdminConfig`, and the controller factory from Task 1.
- Produces: `DebugLaunchPreferenceProvider({ canUseDebugLaunches, children })`, `useDebugLaunchPreference()`, and only `canUseDebugLaunches: boolean` across the server to client boundary. The dashboard layout uses a stable capability-derived provider key; the authenticated user ID is never a client prop, key, or controller snapshot field.

- [x] **Step 1: Write visibility tests for gate, allowlist, and ordinary staff combinations.**

Use module mocks for `requireStaffAccess` and `debugAdminConfig`, and assert the rendered Settings output receives only a boolean capability. Test gate false with an allowlisted-looking user, gate true with an allowlisted user, gate true with an ordinary staff user, and invalid config returning the existing fail-closed config. Assert no allowlist array, Clerk ID, or environment value appears in rendered props or HTML.

- [x] **Step 2: Run the visibility tests and verify they fail before the page computes the capability.**

Run: `npm test -- src/app/(dashboard)/settings/page.test.tsx`

Expected: FAIL because `SettingsPage` currently passes only the two existing tab bodies.

- [x] **Step 3: Add the client provider before changing Settings or launcher consumers.**

Create the `'use client'` provider with a React context. It must create one controller per mounted dashboard tab using `createDebugLaunchPreferenceController(window.sessionStorage)` after mount, expose the controller through `useDebugLaunchPreference`, and reset plus dispose it on unmount. When `canUseDebugLaunches` is false, it must reset and dispose the storage-backed controller and expose only the safe Off controller. The dashboard layout must use a stable capability-derived key so a capability change remounts it before the new controller reads storage. During SSR and before mount, expose a stable safe Off snapshot and no browser storage access. Throw a developer-facing error if the hook is used outside the provider.

Wrap the authenticated dashboard children in `DebugLaunchPreferenceProvider` from `src/app/(dashboard)/layout.tsx`, passing only `canUseDebugLaunches` and using a stable capability-derived value as the provider's React `key`. Add provider and controller tests for SSR-safe Off, shared controller state, capability-boundary cleanup, and disposal.

- [x] **Step 4: Add the server capability calculation and conditional panel wiring.**

Compute exactly:

```ts
const canUseDebugLaunches =
  debugAdminConfig.captureEnabled
  && userId !== null
  && debugAdminConfig.adminUserIds.includes(userId);
```

Because `requireStaffAccess()` returns a non-null `userId`, retain the explicit presence check for the fail-closed contract. Pass only `canUseDebugLaunches` into `SettingsTabs`. Render `DebugSettingsPanel` as a client consumer of `useDebugLaunchPreference`; do not instantiate or pass the controller from the server page. Do not serialize the allowlist or raw configuration.

- [x] **Step 5: Test capability changes and sign-out reset before controls become usable.**

Assert a stale On value is reset and removed when the capability is false before any later controller can read it; it starts Loading then resolves Off. Assert `reset()` removes storage and emits Off. Assert the page hides the Debug tab when the server capability is false even when stale storage contains `on`.

- [x] **Step 6: Run the provider, page, and panel tests, then commit the server and wiring seam.**

Run: `npm test -- src/components/analysis/debug-launch-preference-provider.test.tsx src/app/(dashboard)/settings/page.test.tsx src/components/settings/debug-settings-panel.test.tsx`

Expected: PASS with ordinary staff hidden, eligible admin visible, fail-closed configuration hidden, and capability reset covered.

Commit: `git add 'src/app/(dashboard)/layout.tsx' 'src/app/(dashboard)/settings/page.tsx' src/components/analysis/debug-launch-preference-provider.tsx src/components/analysis/debug-launch-preference-provider.test.tsx src/components/settings/debug-settings-panel.tsx src/components/settings/debug-settings-panel.test.tsx src/components/analysis/AnalysisLauncher.tsx 'src/app/(dashboard)/settings/page.test.tsx' && git commit -m "Wire debug session state to settings and launcher"`

### Task 4: Make route selection explicit and keep the launch payload unchanged

**Files:**
- Modify: `src/components/analysis/analysisLauncherClient.ts`
- Modify: `src/components/analysis/AnalysisLauncher.tsx`
- Test: `src/components/analysis/analysisLauncherClient.test.ts`
- Test: `src/components/analysis/AnalysisLauncher.test.tsx`

**Interfaces:**
- Consumes: `DebugPreferenceSnapshot` from the shared controller.
- Produces: `analysisRunEndpoint(preference)`, and a submit path that captures the endpoint once after a valid preview and before POST.

- [x] **Step 1: Write failing route and failure-handling tests.**

```ts
it.each([
  ['off', '/api/analysis-runs'],
  ['on', '/api/debug/analysis-runs'],
] as const)('maps Debug %s to exactly one launch endpoint', (preference, expected) => {
  expect(analysisRunEndpoint(preference)).toBe(expected);
});

it('uses the ordinary endpoint for an unavailable preference', () => {
  expect(analysisRunEndpoint('off')).toBe('/api/analysis-runs');
});

it('never adds a client debug authorization field to the existing payload', () => {
  const payload = createAnalysisRunPayload({
    subjectType: 'company', subjectId: 42, practiceAreaId: 3,
    signalCategory: 'GBS-state', selection: { kind: 'fixed', templateVersionId: 11 },
  });
  expect(payload).not.toHaveProperty('debugCaptureEnabled');
  expect(payload).not.toHaveProperty('debugAdminUserIds');
  expect(payload).not.toHaveProperty('userId');
});
```

In the component test, mock `fetch`, complete the existing options and preview flow, submit with Off and On, and assert one POST to the expected endpoint with the exact pre-existing body. Add a test that changing the preference after POST starts does not change the already selected URL. Add a debug 404 or 401 response test that clears the controller to Off, shows the generic existing error, and does not retry the ordinary endpoint. Add validation, conflict, provider, dispatch, and network cases proving no automatic fallback.

- [x] **Step 2: Run the focused tests and verify the route helper and component assertions fail.**

Run: `npm test -- src/components/analysis/analysisLauncherClient.test.ts src/components/analysis/AnalysisLauncher.test.tsx`

Expected: FAIL because the endpoint helper and preference-aware submit path do not exist.

- [x] **Step 3: Implement the pure endpoint helper and submit seam.**

Add `analysisRunEndpoint` with an exhaustive switch over `DebugPreference`. In `AnalysisLauncher`, read the controller snapshot at submit time, reject submit while status is Loading, Updating, or Unavailable, and choose the endpoint once before calling `fetch`. Keep preview, fields, polling, response parsing, and existing `getErrorCopy` behavior unchanged. For a debug authorization response, invoke `reset()` and retain the generic launch failure copy. Never send a debug flag in the body and never retry through the ordinary endpoint.

- [x] **Step 4: Run the focused tests and commit the route-selection seam.**

Run: `npm test -- src/components/analysis/analysisLauncherClient.test.ts src/components/analysis/AnalysisLauncher.test.tsx`

Expected: PASS for Off, On, unavailable, updating, immutable request URL, unchanged payload, revoked authorization, and no fallback.

Commit: `git add src/components/analysis/analysisLauncherClient.ts src/components/analysis/AnalysisLauncher.tsx src/components/analysis/analysisLauncherClient.test.ts src/components/analysis/AnalysisLauncher.test.tsx && git commit -m "Route analysis launches from debug preference"`

### Task 5: Lock server authorization ordering and forged-client-field behavior

**Files:**
- Modify: `src/app/api/analysis-runs/route.test.ts`
- Modify: `src/app/api/debug/analysis-runs/route.test.ts`
- Modify: `src/lib/auth/requireDebugAdminAccess.test.ts`
- Modify: `src/lib/analysis/launchAnalysisRun.test.ts`

**Interfaces:**
- Consumes: existing route handlers, `requireStaffAccess`, `requireDebugAdminAccess`, and `launchAnalysisRun({ request, userId, debugCaptureEnabled })`.
- Produces: regression tests proving the two route entry points are distinct and authorization cannot be forged through request bodies or stale browser state.

- [x] **Step 1: Add route tests with mocked dependencies and call-order assertions.**

For the ordinary route, assert `requireStaffAccess()` runs and `launchAnalysisRun` receives the authenticated user ID plus `debugCaptureEnabled: false`, even when the JSON body contains `debugCaptureEnabled: true`, `debugAdminUserIds: ['user_admin']`, and `userId: 'user_admin'`. For the debug route, assert `requireDebugAdminAccess()` is the first meaningful call, `launchAnalysisRun` is not called when it rejects, and successful authorization passes true. Cover anonymous, gate false, invalid allowlist, ordinary staff, and allowlisted admin cases.

- [x] **Step 2: Run route and auth tests and verify any missing assertions fail.**

Run: `npm test -- src/app/api/analysis-runs/route.test.ts src/app/api/debug/analysis-runs/route.test.ts src/lib/auth/requireDebugAdminAccess.test.ts src/lib/analysis/launchAnalysisRun.test.ts`

Expected: FAIL only for newly added assertions that expose missing coverage or an incorrect implementation seam.

- [x] **Step 3: Add route test doubles and preserve the trusted caller contract.**

Mock `requireStaffAccess`, `requireDebugAdminAccess`, `launchAnalysisRun`, and request JSON. Keep both production route handlers aligned with their current contracts: the ordinary route calls `requireStaffAccess()` and passes false, while the debug route calls `requireDebugAdminAccess()` first and passes true. Do not move authorization into the client or shared launch parser. The launch handler may continue stripping the existing `CLIENT_DEBUG_CONTROL_KEYS`, but tests must prove that stripping is not authorization.

- [x] **Step 4: Run the focused tests and commit the authorization contract.**

Run: `npm test -- src/app/api/analysis-runs/route.test.ts src/app/api/debug/analysis-runs/route.test.ts src/lib/auth/requireDebugAdminAccess.test.ts src/lib/analysis/launchAnalysisRun.test.ts`

Expected: PASS for gate false, invalid configuration, anonymous access, ordinary staff, allowlisted admin, forged flags, forged IDs, and authorization-before-work ordering.

Commit: `git add src/app/api/analysis-runs/route.test.ts src/app/api/debug/analysis-runs/route.test.ts src/lib/auth/requireDebugAdminAccess.test.ts src/lib/analysis/launchAnalysisRun.test.ts && git commit -m "Cover debug launch authorization boundaries"`

### Task 6: Prove immutable server-derived snapshots and unchanged capture semantics

**Files:**
- Modify: `src/lib/analysis/snapshots.test.ts`
- Modify: `src/lib/analysis/launchAnalysisRun.test.ts`
- Modify: `src/lib/db/queries/analysisRuns.integration.test.ts` only if the existing snapshot persistence test requires a database assertion

**Interfaces:**
- Consumes: `buildPhase33AnalysisSnapshots(input, policyDecision)` and `launchAnalysisRun`'s trusted boolean option.
- Produces: tests proving `executionSnapshot.debugCaptureEnabled` is set at creation, deeply immutable, and independent of later environment, allowlist, browser, or request-body changes.

- [x] **Step 1: Add failing snapshot tests for true, false, and post-creation mutation.**

```ts
it.each([true, false] as const)('stores debugCaptureEnabled=%s in the execution snapshot', (debugCaptureEnabled) => {
  const result = buildPhase33AnalysisSnapshots(
    { ...createInput(), debugCaptureEnabled },
    PHASE33_STANDARD_APPROVED_POLICY,
  );
  expect(result.executionSnapshot.debugCaptureEnabled).toBe(debugCaptureEnabled);
  expect(Object.isFrozen(result.executionSnapshot)).toBe(true);
});

it('does not read current configuration after the snapshot is built', () => {
  const result = buildPhase33AnalysisSnapshots(
    { ...createInput(), debugCaptureEnabled: true },
    PHASE33_STANDARD_APPROVED_POLICY,
  );
  const configuration = { enabled: true };
  configuration.enabled = false;
  expect(result.executionSnapshot.debugCaptureEnabled).toBe(true);
});
```

Add a launch-handler test that sends forged body fields while the trusted caller option is false, captures the input passed to `createAnalysisRun`, and asserts the persisted snapshot is false. Repeat with the debug route option true. Add an existing failed-only compatibility assertion that a debug-enabled failed attempt still yields the current bounded artifact, while a successful attempt has no raw artifact under this feature.

- [x] **Step 2: Run focused snapshot and launch tests.**

Run: `npm test -- src/lib/analysis/snapshots.test.ts src/lib/analysis/launchAnalysisRun.test.ts`

Expected: FAIL for any missing explicit debug snapshot assertions, then PASS after tests are implemented without changing snapshot schema semantics.

- [x] **Step 3: Implement only the minimum snapshot/test seam needed.**

Keep `buildAnalysisSnapshotsInputSchema` strict and retain its default false. Ensure the launch handler passes the trusted route option to `buildPhase33AnalysisSnapshots`; it must not derive that value from request JSON or current environment at workflow execution time. Do not add successful capture, retention changes, or schema migration.

- [x] **Step 4: Run the focused tests and commit the immutable snapshot proof.**

Run: `npm test -- src/lib/analysis/snapshots.test.ts src/lib/analysis/launchAnalysisRun.test.ts`

Expected: PASS for true and false snapshots, deep immutability, forged fields ignored, config changes after launch ignored, failed-only debug artifact behavior, and no successful raw artifact.

Commit: `git add src/lib/analysis/snapshots.test.ts src/lib/analysis/launchAnalysisRun.test.ts && git commit -m "Verify immutable debug launch snapshots"`

### Task 7: Add end-to-end accessibility, ordinary staff, and failure verification

**Files:**
- Create: `e2e/settings-debug-toggle.spec.ts`

**Interfaces:**
- Consumes: the completed Settings tab, session controller, launcher route selection, and existing Clerk test fixtures.
- Produces: browser evidence for hidden, Off, On, Updating, Unavailable, revoked, ordinary staff, keyboard, zoom, and narrow-screen behavior.

- [x] **Step 1: Write browser tests before implementation verification.**

Use existing Playwright authentication helpers. Cover:

```ts
test('ordinary staff cannot see Debug', async ({ page }) => {
  await signInAsOrdinaryStaff(page);
  await page.goto('/settings');
  await expect(page.getByRole('tab', { name: 'AI Models' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Debug' })).toHaveCount(0);
});

test('admin can toggle session-only Debug and launch through the selected route', async ({ page }) => {
  await signInAsDebugAdmin(page);
  await page.goto('/settings');
  const toggle = page.getByRole('switch', { name: 'Enable debug launches for this browser session' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  const second = await page.context().newPage();
  await second.goto('/settings');
  await expect(second.getByRole('switch', { name: 'Enable debug launches for this browser session' }))
    .toHaveAttribute('aria-checked', 'false');
});
```

Stub the launch requests where the test only verifies routing. Add tests for sign-out or identity replacement reset, storage failure safe Off, revoked debug response clearing the preference, no ordinary fallback after a debug error, visible focus, 200 percent zoom, narrow viewport, and live-region state announcements. Verify the Models and Data Sources panels remain usable and visually unchanged.

- [x] **Step 2: Run the browser test file in the existing configured project.**

Run: `npm run e2e -- e2e/settings-debug-toggle.spec.ts`

Expected: PASS for the hidden ordinary-staff path, admin session behavior, exact route selection, keyboard operation, live regions, and responsive accessibility. If the repository uses a different existing Playwright directory, use that configured path and record it in the task result without changing product code.

- [x] **Step 3: Commit the browser verification.**

Run: `git add e2e/settings-debug-toggle.spec.ts && git commit -m "Verify debug toggle accessibility and session behavior"`

Expected: one focused commit containing only browser verification.

### Task 8: Run the complete verification gates and review the implementation against the approved spec

**Files:**
- No new product files. Review all files changed by Tasks 1 through 7.

- [x] **Step 1: Run focused unit and component tests together.**

Run: `npm test -- src/lib/analysis/debugLaunchPreference.test.ts src/components/settings/settings-tabs.test.tsx src/components/settings/debug-settings-panel.test.tsx src/components/analysis/analysisLauncherClient.test.ts src/components/analysis/AnalysisLauncher.test.tsx src/lib/auth/debugAdminConfig.test.ts src/lib/auth/requireDebugAdminAccess.test.ts src/lib/analysis/launchAnalysisRun.test.ts src/lib/analysis/snapshots.test.ts src/app/api/analysis-runs/route.test.ts src/app/api/debug/analysis-runs/route.test.ts`

Expected: PASS with no snapshot, auth, route, session, ordinary-staff, accessibility-state, or failure-handling regressions.

- [x] **Step 2: Run the full unit suite and production build.**

Run: `npm test && npm run build`

Expected: PASS. Existing diagnostics, retention, cleanup, normalized-result, review, and polling tests continue to pass. The build emits no TypeScript or Next.js errors.

- [x] **Step 3: Run the browser verification.**

Run: `npm run e2e -- e2e/settings-debug-toggle.spec.ts`

Expected: PASS for admin visibility, ordinary staff unchanged, session reset, exact endpoints, revoked authorization, keyboard and screen-reader semantics, focus, contrast, live regions, zoom, and narrow screens.

- [x] **Step 4: Perform the written self-review before declaring the plan implemented.**

Check every approved requirement against these evidence locations: visibility and fail-closed auth in Tasks 3 and 5, session state and reset in Tasks 1 and 3, route selection and no fallback in Task 4, server authorization and forged flags in Task 5, immutable snapshots in Task 6, failed-only capture and no successful raw capture in Task 6, ordinary staff and existing tabs in Tasks 2 and 7, accessibility in Tasks 2 and 7, and rollout rollback behavior through the gate in Tasks 3 and 7. Search the plan and changed files for `TBD`, `TODO`, vague instructions such as `add validation`, mismatched interface names, client allowlist exposure, successful raw-capture additions, and any product implementation outside the listed files.

- [x] **Step 5: Check repository diagnostics and final status.**

Run: `npm run lint` and `git status --short`

Expected: lint passes, and the implementation branch contains only the intended task commits and no secrets, `.env.local`, generated artifacts, migrations, or unrelated product changes.

## Verification Summary

The plan is complete only when the focused tests, full `npm test`, `npm run build`, lint, and Playwright checks pass. The final report must name the saved plan path, list the ordered Tasks 1 through 8, cite the exact verification commands, and state that no unresolved ambiguity remains. It must also explicitly state that this feature retains failed attempts only and adds no successful raw-attempt capture.
