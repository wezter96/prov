---
status: resolved
trigger: "Investigate the current Android e2e failures in /Users/anton/.superset/projects/spana without editing code. Context: commit 54a638c was just pushed to main. After that, `bun run test:e2e:framework-app` produced 2 Android failures: `Framework app (BDD) — Navigate to tabs explore through the UI` and `Framework app - navigate to tabs explore through the UI`, both failing to find selector `testID: \\\"tab-two-title\\\"` after tapping the explore tab. Relevant artifacts are under packages/spana/spana-output/, especially the two failing android directories. Inspect the flow definitions, related app code, selectors/testIDs, and artifacts/hierarchy outputs if useful. Determine the most likely root cause and the smallest correct fix, and report exactly which files should change and why. Do not modify files."
created: 2026-04-06T14:46:06Z
updated: 2026-04-06T14:58:17Z
---

## Current Focus

hypothesis: Confirmed root cause is Android UI-test fragility around the Explore tab tap target, not a missing selector or broken Explore screen.
test: Diagnosis complete.
expecting: n/a
next_action: Report root cause and the smallest targeted file changes without editing code.

## Symptoms

expected: After tapping the explore tab in Android e2e flows, the app should navigate to the Explore screen and expose selector testID \"tab-two-title\".
actual: Both Android tests fail after tapping the explore tab because selector testID \"tab-two-title\" is not found.
errors: Failed to find selector testID \"tab-two-title\" after tapping the explore tab in two Android e2e tests.
reproduction: Run `bun run test:e2e:framework-app` on current main after commit 54a638c; inspect the two failing Android tests/artifacts under packages/spana/spana-output/.
started: After commit 54a638c was pushed to main.

## Eliminated

- hypothesis: The failures are due to renamed or missing explore selectors in the app or flows.
  evidence: apps/native/app/(drawer)/(tabs)/\_layout.tsx still exposes accessibilityLabel "Open explore tab"; apps/native/app/(drawer)/(tabs)/two.tsx still exposes testID "tab-two-title"; both failing flows still target those selectors.
  timestamp: 2026-04-06T14:56:12Z

## Evidence

- timestamp: 2026-04-06T14:47:18Z
  checked: commit 54a638c and repository search for explore-tab selectors
  found: commit 54a638c changed CLI/core/reporting files only; app code still defines accessibilityLabel "Open explore tab" in apps/native/app/(drawer)/(tabs)/\_layout.tsx and testID "tab-two-title" in apps/native/app/(drawer)/(tabs)/two.tsx; both BDD and non-BDD flows still target those same selectors.
  implication: The failure is unlikely to be caused by a selector/testID rename in the app or flow definitions.

- timestamp: 2026-04-06T14:48:54Z
  checked: failing Android artifact hierarchies for both BDD and non-BDD navigate-to-tabs-explore tests
  found: final UI hierarchy still shows tab-one-scroll/tab-one-title on screen, while tabs-explore-tab remains present, clickable, and unselected; tab-two-title is absent.
  implication: The tap sequence reaches the tabs screen, but the final tap does not switch Android to the Explore tab.

- timestamp: 2026-04-06T14:56:12Z
  checked: Android direct-route artifacts and junit report
  found: direct-route Android tests for /two pass and their hierarchies show tab-two-title/tab-two-subtitle with tabs-explore-tab selected; junit-report.xml shows the only failing step in both failing tests is the final tap-then-expect sequence after step 8 tap on accessibilityLabel "Open explore tab".
  implication: The Explore screen itself is healthy on Android; only the UI tap path is failing.

- timestamp: 2026-04-06T14:56:12Z
  checked: tap target geometry versus warning-banner geometry
  found: in the failing hierarchy, tabs-explore-tab spans [640,2638]-[1280,2784] so coordinator.ts taps its center at roughly (960,2711); the warning banner spans [30,2408]-[1250,2796] with a clickable child covering [30,2567]-[1250,2709], i.e. overlapping almost the entire upper portion of the tab bar directly above the button center.
  implication: The current Android interaction is fragile because it taps the tab button near an overlapping warning/banner region instead of a safer point lower in the tab label.

- timestamp: 2026-04-06T14:56:12Z
  checked: commit diff for 54a638c
  found: commit 54a638c changes CLI/orchestrator/reporting files and does not modify the framework-app flow files, native app tab layout, selector parsing, coordinator tap logic, or Android driver tap implementation.
  implication: The regression is most likely a latent Android UI-test fragility exposed by current runtime conditions rather than an intentional selector/app-code change in 54a638c.

## Resolution

root_cause: Both failing Android UI flows tap the center of the parent tab button for "Open explore tab". In the captured Android hierarchies, that button sits under an active React Native warning banner near the bottom of the screen, so the coordinate-based tap does not switch tabs. The Explore screen itself still renders correctly on Android when reached via direct route, and tab-two-title still exists.
fix: Change the failing UI interaction to target a safer Android tap point/selector for the Explore tab (for example, the visible "Explore" tab-label text on Android in the flow/BDD step) rather than tapping the parent tab button by accessibility label; optionally follow up by removing or suppressing the warning banner source in the native app, but that is not required for the smallest fix to these failures.
verification: Verified diagnostically from artifacts only: direct-route Android cases to /two pass and show tab-two-title, while both failing UI-flow hierarchies remain on tab-one-title after the final tap and show the overlapping warning banner over the tab bar.
files_changed:

- packages/spana/flows/framework-app/tabs-explore.flow.ts
- packages/spana/flows/framework-app/steps/navigation.steps.ts
