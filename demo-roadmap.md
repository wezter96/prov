# Demo Roadmap

## Goal

Turn the React Native demo app (`apps/native`) and the framework-owned E2E suite (`packages/spana/flows/framework-app`) into a better product showcase.

The next iteration should keep the app intentionally small, but visibly demonstrate more of Spana's core interaction, assertion, artifact, and authoring features.

## Current gap

Today the demo does a solid job of proving:

- one TypeScript suite can run on web, Android, and iOS
- deep-link navigation works across routes
- selectors based on `testID`, text, and accessibility labels work
- screenshots, HTML/JUnit reporting, and Gherkin parity exist

It does **not** yet show enough of:

- text entry and keyboard handling
- gesture APIs like `doubleTap()` and `longPress()`
- scroll-driven interaction
- hidden-state assertions
- UI-driven modal navigation with stable selectors

---

## Scope

### In scope

1. Add an interaction playground screen to `apps/native`
2. Add an explicit modal demo surface with stable selectors
3. Extend the `framework-app` flows to exercise more of Spana's API
4. Keep one clear Gherkin parity path so BDD support stays visible

### Out of scope

- Cloud/Appium provider demo coverage
- Web-only helpers like `mockNetwork()`, `evaluate()`, or auth/cookie state
- Creating a separate app-local Spana suite; keep the active demo suite under `packages/spana/flows/framework-app`

---

## Planned tracks

| Track                         | App work                                                                             | Test work                                                                                        | Features highlighted                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **1. Interaction playground** | Add a small screen with input, gesture targets, toggleable content, and scroll depth | Add a cross-platform showcase flow                                                               | `inputText`, `hideKeyboard`, `scroll`, `doubleTap`, `longPress`, `toHaveText`, `toBeHidden` |
| **2. Modal showcase**         | Add stable selectors to the modal entry and dismissal controls                       | Add a UI-driven modal flow                                                                       | in-app navigation, accessibility selectors, modal coverage, screenshots                     |
| **3. Suite polish**           | Keep app changes minimal and demo-focused                                            | Tag/highlight showcase flows, keep one Gherkin parity scenario, capture useful success artifacts | `.flow.ts` + `.feature`, step capture, readable reports                                     |

---

## File map

| Area       | Create                                                                                                      | Modify                                                                                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native app | `apps/native/app/(drawer)/playground.tsx`                                                                   | `apps/native/app/(drawer)/_layout.tsx`, `apps/native/components/header-button.tsx`, `apps/native/app/modal.tsx`                                                                             |
| Flow suite | `packages/spana/flows/framework-app/playground.flow.ts`, `packages/spana/flows/framework-app/modal.flow.ts` | `packages/spana/flows/framework-app/routes-screenshots.flow.ts`, `packages/spana/flows/framework-app/framework-app.feature`, `packages/spana/flows/framework-app/steps/navigation.steps.ts` |

If the playground fits better as a tab instead of a drawer route during implementation, that is acceptable as long as the selectors stay stable and the navigation remains easy to test.

---

## Track 1: Interaction playground

Add one dedicated demo screen that exists only to make Spana's interaction API easy to show off.

- [ ] Add a new route for a "Playground" screen in `apps/native`
- [ ] Add stable `testID` and `accessibilityLabel` values for every interactive control
- [ ] Add a text input with reflected output text
- [ ] Add an explicit dismiss-keyboard control or state transition that proves keyboard handling
- [ ] Add a double-tap target that updates visible state
- [ ] Add a long-press target that updates visible state
- [ ] Add a toggle/accordion section so a flow can assert both visible and hidden states
- [ ] Add enough vertical content that a flow must scroll to reach a bottom sentinel element

### Test additions

- [ ] Create `playground.flow.ts`
- [ ] Exercise `tap`, `inputText`, `hideKeyboard`, `scroll`, `doubleTap`, `longPress`, and `takeScreenshot`
- [ ] Assert `toBeVisible`, `toBeHidden`, and `toHaveText`
- [ ] Enable `captureOnSuccess` and `captureSteps` for this flow so the report is demonstrably useful

### Acceptance criteria

- A new contributor can open the flow and immediately see that Spana supports more than simple taps and route checks
- The flow remains cross-platform without excessive branching

---

## Track 2: Modal showcase

The modal already exists, but the suite only proves direct route access. Add a proper UI-driven path.

- [ ] Give the modal entry control a stable `testID` and accessibility label
- [ ] Give the modal a stable dismissal control so the flow can open and close it through the UI
- [ ] Keep the modal interaction simple and deterministic across web, Android, and iOS

### Test additions

- [ ] Create `modal.flow.ts`
- [ ] Navigate to the tabs area through the UI
- [ ] Open the modal through the visible app chrome, not only via deep links
- [ ] Assert the modal title/content
- [ ] Close the modal and verify the underlying screen is visible again
- [ ] Extend `routes-screenshots.flow.ts` if the new surface deserves direct-route screenshot coverage

### Acceptance criteria

- The demo suite shows both deep-link navigation and user-driven navigation
- Modal coverage no longer depends on direct route jumps alone

---

## Track 3: Suite polish and positioning

The suite should read like a showcase, not just a regression bucket.

- [ ] Keep the existing smoke flows for home/tabs/direct-route coverage
- [ ] Tag the new flows with something like `showcase` or `demo`
- [ ] Keep exactly one high-value Gherkin parity scenario instead of duplicating every flow in both styles
- [ ] Update step definitions only where that parity scenario needs new verbs
- [ ] Make the generated report visually useful by preserving step artifacts on the showcase flows

### Success criteria

By the end of this roadmap, `bun run test:e2e:framework-app` should visibly demonstrate:

- cross-platform execution from one suite
- imperative TypeScript flows
- Gherkin/BDD support
- stable selector strategy
- richer interactions than tap-only smoke tests
- useful artifacts and readable reports

---

## Guardrails

- Keep the native app small; this is a demo surface, not a product feature build-out
- Prefer deterministic UI state over clever animations or flaky timing
- Avoid duplicating the same scenario in both `.flow.ts` and `.feature` unless it adds real showcase value
- Do not stretch this roadmap to cover web-only or cloud-only APIs; those deserve a separate showcase plan

---

## Suggested implementation order

1. Add the playground screen and its selectors
2. Add modal entry/dismiss controls with stable selectors
3. Add `playground.flow.ts`
4. Add `modal.flow.ts`
5. Trim and update the Gherkin parity scenario
6. Refresh screenshot/report coverage and polish tags/artifacts
