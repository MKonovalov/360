# Settings Debug Toggle and Per-Session Launch Routing

**Status:** Approved design specification  
**Date:** 2026-08-20  
**Scope:** Settings UI and analysis launches made after this feature is enabled

## 1. Summary

Add an admin-only Debug tab to the existing Settings page. The tab preserves the current Settings styling and contains an accessible Debug On or Off switch. The switch controls only which launch endpoint the current authenticated browser session uses for later analysis launches:

* Debug Off sends the ordinary launch request to `POST /api/analysis-runs`.
* Debug On sends the launch request to `POST /api/debug/analysis-runs`.

The browser selection is a routing preference, not an authorization decision. The debug route reauthorizes the current Clerk session on the server before starting a run. Client supplied flags, user IDs, allowlists, or equivalent fields are ignored. The server creates the immutable per-run capture snapshot. Ordinary staff continue to use the ordinary route and receive the existing non-debug behavior.

This feature does not add raw successful-attempt capture. Capture remains failed-only under the current implementation. The separate all-attempt capture specification governs any future change to retain successful attempts.

## 2. Goals

* Preserve the existing Settings page layout, tab styling, spacing, typography, and interaction patterns.
* Give approved debug admins a clear per-session Debug On or Off control.
* Keep the Debug tab and its state unavailable to ordinary staff.
* Route subsequent launches according to the current session selection without changing the existing launcher fields or preview flow.
* Reauthorize every debug launch on the server with the current Clerk identity and the server configuration gate.
* Make the persisted run snapshot the sole authority for debug capture after launch.
* Keep ordinary staff launches, existing runs, normalized results, and review behavior unchanged.
* Make the selection safe, reversible, observable through tests, and accessible.

## 3. Non-goals

* Do not add successful raw-attempt capture. The current failed-only capture limitation remains until the separate all-attempt design is implemented.
* Do not change the global Vercel environment, `ANALYSIS_DEBUG_CAPTURE_ENABLED`, or `ANALYSIS_DEBUG_ADMIN_USER_IDS` from the Settings UI.
* Do not change another user's setting, another browser session, or the application's default for all users.
* Do not expose the admin allowlist, Clerk IDs, environment values, or debug configuration details to the browser.
* Do not add a global debug mode, persistent account preference, database setting, or organization-wide switch.
* Do not bypass server authorization because the user can see or manipulate the tab.
* Do not change analysis preview semantics, template selection, practice area selection, signal selection, agent selection, polling, or run result handling.
* Do not backfill or alter existing runs.

## 4. Existing behavior to preserve

The Settings page currently requires staff access on the server and renders the `AI Models` and `Data Sources` tabs through the shared line-style tab primitives. The new Debug tab must use those same primitives and existing Settings page classes. It must not introduce a separate visual treatment or reorder the existing tabs.

The analysis launcher currently previews a resolved launch and then posts to `POST /api/analysis-runs`. The ordinary route requires staff access and passes `debugCaptureEnabled: false` to the shared launch handler. The debug route requires `requireDebugAdminAccess()` and passes `debugCaptureEnabled: true`. The new client state selects between these already distinct server entry points. It does not send a client capture flag as a substitute for route authorization.

The current debug capture path stores a server-derived value in the immutable execution snapshot and captures only failed attempts. This design keeps that contract. A debug-enabled run can therefore produce the existing failed raw artifact when execution fails, but a successful run does not gain a raw artifact from this feature.

## 5. Admin visibility and server configuration

### 5.1 Visibility rule

The Settings server component must derive a boolean capability for the current authenticated user using server-side Clerk auth and the same fail-closed configuration used by the debug-admin boundary:

```text
canUseDebugLaunches =
  debugAdminConfig.captureEnabled
  AND authenticatedUserId is present
  AND debugAdminConfig.adminUserIds contains authenticatedUserId
```

The server passes only `canUseDebugLaunches` to the Settings tabs component. It never passes the allowlist or raw configuration values. The client must not calculate this capability from environment variables, URL parameters, local storage, cookies, claims supplied by the browser, or a user-entered identifier.

When `canUseDebugLaunches` is false, the Debug tab is not rendered. Its trigger, panel, switch, labels, and explanatory copy must not be present in the page output. The existing AI Models and Data Sources tabs remain available and styled exactly as before.

The visibility check is presentation gating only. It must not replace `requireDebugAdminAccess()` on the debug launch route or any debug diagnostics route.

### 5.2 Configuration changes

Configuration is read from the server only. The Settings UI has no control for enabling the global gate or editing the allowlist. Changing Vercel environment values, deploying a new configuration, or removing an admin affects eligibility for future debug launches and future page renders only. It does not rewrite an existing browser session preference or an existing run snapshot by itself.

If the global gate is disabled or the allowlist is invalid, the server fails closed. The Debug tab is hidden, and any stale client state is ignored by the server. No debug route is considered authorized merely because a browser previously saw the tab.

## 6. Debug tab and UI states

### 6.1 Tab contents

For an eligible debug admin, add a `Debug` trigger after the existing Settings tabs. Its panel contains:

* A heading such as `Analysis debug launches`.
* A short explanation that the switch affects later launches in this browser session only.
* An On or Off switch with a visible text state.
* A note that Debug On launches use the debug-admin route and currently retain bounded failed-attempt diagnostics only.
* A warning that the switch does not enable successful-attempt capture and does not alter other users' settings.

The copy must not imply that Debug On captures every attempt, changes global configuration, or grants access to diagnostics without server authorization.

### 6.2 States

The UI must define these states:

1. **Hidden:** `canUseDebugLaunches` is false. No Debug tab is rendered.
2. **Loading:** The eligible tab is rendered, but the session preference has not yet been read. The switch is disabled and exposes a polite status such as `Loading debug launch setting`.
3. **Off:** The switch is unchecked, labeled `Debug Off`, and later launches use the ordinary route.
4. **On:** The switch is checked, labeled `Debug On`, and later launches use the debug route after server authorization.
5. **Updating:** The switch is disabled while its session preference is being written. The visible state must not claim the new value until the write succeeds.
6. **Unavailable:** The session preference cannot be read or written. The UI fails safe to Off, shows a non-sensitive error, and keeps the switch disabled until the preference can be safely resolved.
7. **Revoked:** A later launch receives the server's unauthorized or not-found response because eligibility was removed. The client clears the session preference to Off, shows the ordinary generic launch failure copy, and does not reveal whether the user was previously allowlisted or whether a debug artifact exists.

The initial safe default is Off. A transient browser read failure must never select the debug route. A write failure must leave the last confirmed value, or Off if no value has been confirmed.

## 7. Session persistence and reset behavior

The preference is scoped to the authenticated browser session using `sessionStorage`, with a versioned application key. It is not stored in the database, a Clerk profile, a global cookie, a Vercel environment variable, or local storage. The value is a small closed value, `on` or `off`, and must not contain user IDs or launch data.

The session preference behavior is:

* A newly opened browser tab starts Off until it reads a valid preference for that tab's session storage.
* Reloading the tab preserves the confirmed preference.
* Closing the tab clears the preference through normal browser session storage behavior.
* Opening a new tab starts Off rather than inheriting another tab's debug selection.
* Signing out resets the in-memory state to Off and removes the session preference. The next authenticated browser session must not reuse a previous user's selection. If the application can detect an authenticated user identity change without a full tab close, it must remove the prior preference before rendering launch controls.
* Signing in as a different user in the same tab starts Off, even if the prior user was an eligible debug admin. The identity change must clear the prior session preference before launch controls become usable.
* Removing the user from the server allowlist hides the tab on the next server render. A stale `sessionStorage` value is harmless because the client cannot authorize the debug route.
* Re-enabling eligibility does not silently turn Debug On. The preference remains Off unless the current session explicitly turns it on.
* The preference does not affect already launched runs, queued runs, retries, workflow re-entry, or diagnostic access.

The application may use an equivalent in-memory session mechanism if the chosen framework cannot safely use `sessionStorage`, but the behavior must remain tab-scoped, non-global, fail-safe, and reset on identity change. No implementation may widen the scope to all users or all tabs without a separate approval.

## 8. Route selection and launch flow

The existing launcher keeps its current UI and preview request. Once the user submits a valid preview, it reads the last confirmed Debug On or Off state from the session controller and chooses exactly one endpoint:

```text
if debugPreference === 'on':
  POST /api/debug/analysis-runs
else:
  POST /api/analysis-runs
```

The request body remains the existing analysis launch payload. The client must not add `debugCaptureEnabled`, `debugAdminUserIds`, or any alternate authorization field. Route selection is the only client-visible difference.

The client must use the confirmed state at submit time. If the switch is Updating, the launch action is disabled until the update settles. If the state is Unavailable, the launch uses the ordinary route only. Changing the switch after a launch has started does not change that run. It affects only a later launch.

The ordinary route remains the default for all users and all new sessions. Ordinary staff do not need to know that a debug route exists.

## 9. Server authorization and snapshot semantics

The debug route must call `requireDebugAdminAccess()` before launch parsing, mutation, dispatch, or any debug-specific work. That function reauthenticates the current Clerk session and checks the server-side global gate and allowlist. The authenticated Clerk user ID is the only identity used for authorization.

The ordinary route continues to call `requireStaffAccess()` and passes `debugCaptureEnabled: false`. The debug route continues to pass `debugCaptureEnabled: true` only after `requireDebugAdminAccess()` succeeds. The shared launch handler remains responsible for constructing and persisting the immutable execution snapshot.

The server must ignore client attempts to:

* Set `debugCaptureEnabled` to true or false.
* Supply `debugAdminUserIds` or a replacement user ID.
* Select the debug route through a request body field sent to the ordinary endpoint.
* Reuse a prior route decision after authorization has been revoked.

At run creation, the server snapshots the derived debug capture decision into the run's immutable execution snapshot. Later changes to environment configuration, allowlist membership, session storage, browser state, or Clerk session state do not change that run. Retries and detached workflow execution read the persisted snapshot rather than current client state or current environment values.

The route choice and snapshot have distinct responsibilities. The route protects entry to the debug launch surface. The snapshot protects the meaning of the run after creation. Neither is inferred from the other after the run is persisted.

## 10. Failure handling

### 10.1 UI and browser failures

* Session storage unavailable, blocked, or malformed: fail safe to Debug Off, disable the switch if the state cannot be confirmed, and show concise non-sensitive copy.
* Preference write failure: retain the last confirmed value, do not launch while the requested change is uncertain, and allow retry.
* Network failure while launching: use the existing generic launch failure behavior. Do not claim that a debug run was created.
* Debug route returns unauthorized or not-found: clear the preference to Off, keep diagnostics details out of the message, and show the existing generic launch failure behavior.
* Debug route returns validation, conflict, provider, or dispatch errors: preserve the existing launcher error mapping. The client must not fall back automatically to the ordinary route, because that could create an unintended ordinary run after the user selected Debug On.
* Ordinary route failure: preserve the current behavior without adding debug-specific messaging.

### 10.2 Server failures

The server fails closed when Clerk auth is absent, the debug gate is disabled, or the allowlist does not contain the current user. Unauthorized debug requests retain the existing not-found behavior so they do not disclose route or artifact existence.

Capture remains subordinate to the existing run outcome authority. This feature does not change capture transaction behavior, retention, redaction, or failure handling. In particular, a successful run still has no raw artifact under the current failed-only implementation, and no new successful raw capture is introduced here.

## 11. Accessibility requirements

* The Settings tab list retains its existing accessible name, `Settings sections`.
* The new tab trigger has an accessible name of `Debug` and participates in the existing keyboard tab order.
* The switch uses a native or equivalent accessible switch control with a programmatic label, such as `Enable debug launches for this browser session`.
* The checked state is exposed through `aria-checked` or the native switch semantics. The visible `Debug On` or `Debug Off` text must match the programmatic state.
* The switch has a visible focus indicator and meets the existing contrast target for text, focus, disabled, and selected states.
* The switch is keyboard operable with Space and follows the existing tab primitive's arrow-key behavior.
* Loading, updating, and unavailable messages use `role="status"` with a polite live region. Authorization and launch failures use the existing alert pattern without exposing sensitive details.
* The control remains understandable at 200 percent zoom and on narrow screens. No state depends on color alone.
* The tab panel heading and explanatory text are associated with the panel. The switch label remains available when the control is disabled.

## 12. Privacy and security review

* The allowlist is evaluated only on the server and is never serialized into page props, HTML, client JavaScript, logs, or session storage.
* The session preference contains no sensitive data and is not treated as proof of admin status.
* Every debug launch is reauthorized against the current Clerk session. A forged client request, modified route choice, or stale browser value cannot bypass the gate.
* The ordinary route cannot be upgraded to a debug launch by request body input.
* A revoked admin cannot create a new debug run through a stale tab or stale session storage value.
* Existing debug diagnostic page and API boundaries remain admin-only, dynamic, and private with no-store responses.
* This feature does not add raw successful-attempt capture. Current failed-only capture remains subject to the existing redaction, bounds, retention, and diagnostic access rules. The separate all-attempt specification must be implemented and reviewed before successful attempts can be retained.
* The UI does not imply that Debug On exposes prompts, credentials, PII, chain-of-thought, raw stacks, or arbitrary provider payloads. Those exclusions remain governed by the existing artifact contract.
* The toggle does not change global Vercel environment values, other users' settings, another tab's setting, or any already persisted run.

## 13. Test matrix

### Server visibility and authorization

* Global gate false, allowlisted-looking user: Debug tab is hidden and debug route access fails closed.
* Global gate true, allowlisted user: Debug tab is rendered with only the boolean capability and the user can attempt a debug launch.
* Global gate true, ordinary staff user: Debug tab is hidden and debug route access fails closed.
* Invalid gate or allowlist configuration: configuration fails closed, no Debug tab is rendered, and no debug launch is accepted.
* Authenticated user removed from the allowlist after page render: the next debug launch is rejected by server reauthorization and no run is created.
* Anonymous request to the debug route: existing authentication behavior is preserved and no debug work occurs.
* Client sends `debugCaptureEnabled`, `debugAdminUserIds`, or a forged user ID: server authorization and snapshot values remain server-derived.

### Session preference and UI

* New tab defaults to Off.
* Reload preserves a confirmed On or Off value in the same tab.
* Closing and reopening the tab starts Off.
* A second tab starts Off and does not inherit the first tab's value.
* Sign-out or authenticated identity change resets the effective value to Off.
* Malformed session storage value resolves to Off and never selects the debug route.
* Session storage read or write failure produces the safe Unavailable behavior.
* Updating disables the switch and launch action until the value is confirmed.
* Keyboard, screen reader, focus, contrast, live-region, and zoom checks pass for every state.
* Ordinary Models and Data Sources tabs retain their current DOM structure and styling contract except for the addition of the eligible Debug tab.

### Route selection and snapshots

* Debug Off posts the existing payload to `/api/analysis-runs`.
* Debug On posts the existing payload to `/api/debug/analysis-runs`.
* The client sends no debug authorization field in either request.
* Switching after a run starts does not change the launched run.
* Debug route launch snapshots `debugCaptureEnabled: true` only after server authorization.
* Ordinary route launch snapshots `debugCaptureEnabled: false`.
* A configuration or allowlist change after launch does not change the stored snapshot.
* A stale Debug On value cannot cause an unauthorized debug launch after eligibility is revoked.
* Debug route business errors do not silently retry through the ordinary route.

### Capture and backward compatibility

* A debug-enabled failed attempt continues to produce the existing bounded failed artifact.
* A debug-enabled successful attempt produces no raw artifact under this feature.
* No successful raw-attempt capture test is added to this feature. Such tests belong to the separate all-attempt design.
* Ordinary staff launches do not gain raw capture.
* Existing queued, running, completed, failed, cancelled, pending-review, confirmed, and dismissed runs are unchanged.
* Existing diagnostics access, retention, cleanup, normalized result, review, and polling tests continue to pass.

## 14. Rollout and rollback

Roll out the UI and route-selection behavior behind the existing server debug configuration. Keep the global gate disabled while validating ordinary staff behavior and the hidden-tab path. Enable the gate only for approved Clerk IDs, then verify one Debug Off launch and one Debug On failed launch with the expected server authorization and immutable snapshot values.

Monitor debug route authorization failures, ordinary route launch failures, preference errors, duplicate or unexpected route selection, and failed artifact capture outcomes. Do not interpret successful launch volume as successful raw-attempt capture, because this feature retains failed attempts only.

To roll back, disable the global gate. New page renders hide the Debug tab, stale browser values are ignored, and new debug route requests fail closed. Existing runs and existing failed artifacts remain governed by their persisted snapshots and existing retention rules. Rollback must not rewrite runs, delete artifacts, change other users' settings, or modify global values from the product UI.

## 15. Acceptance criteria

1. Existing Settings styling and the current Models and Data Sources behavior are preserved.
2. Only a server-authorized debug admin sees the Debug tab.
3. The tab exposes an accessible On or Off switch with explicit session-only copy.
4. Debug Off routes later launches to `POST /api/analysis-runs`.
5. Debug On routes later launches to `POST /api/debug/analysis-runs`.
6. The debug route reauthorizes the current Clerk session server side before launch.
7. Client flags and client identity values cannot affect authorization or capture enablement.
8. Each new run stores an immutable, server-derived debug capture snapshot.
9. Ordinary staff remain on ordinary launch behavior and cannot change other users' settings.
10. The toggle does not change global Vercel environment values or any existing run.
11. Current failed-only capture remains unchanged. No raw successful-attempt capture is added by this feature.
12. The test matrix, accessibility checks, rollout, rollback, and privacy review are complete before implementation planning.

## 16. Self-review checklist

* No placeholder text remains.
* Debug tab visibility is distinguished from debug route authorization.
* Server authorization is required even when the browser shows Debug On.
* Session state is explicitly tab-scoped, fail-safe, and reset on identity change.
* Debug On and Debug Off route behavior is unambiguous.
* Snapshot immutability is not confused with current authorization state.
* The toggle cannot change global Vercel environment values or other users' settings.
* Current failed-only capture is stated repeatedly and does not conflict with the separate all-attempt design.
* Successful raw capture is explicitly excluded from this feature.
* Ordinary staff behavior and existing runs are explicitly protected.
* Privacy, unauthorized behavior, accessibility labels, failure handling, tests, and rollout are specified.
* This document describes behavior and verification requirements only. It does not prescribe an implementation plan or modify product code.
