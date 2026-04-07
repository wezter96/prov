# iOS WDA E2E Test Fixes — Troubleshooting Plan

## Current Status

- **Web: 6/6** — all passing
- **Android: 6/6** — all passing
- **iOS: 2/5** — home + modal pass; BDD, playground, screenshots fail

## How to Reproduce

```bash
# From packages/spana directory:
cd /Users/anton/Documents/repos/spana/packages/spana

# Kill any stale WDA processes first
pkill -9 -f "xcodebuild.*WebDriverAgent" 2>/dev/null; lsof -ti:8100 | xargs kill -9 2>/dev/null; sleep 2

# Run all iOS E2E tests
bun dist/cli.js test flows/framework-app --platform ios --reporter console

# Run a single flow for faster iteration
bun dist/cli.js test flows/framework-app/framework-app.feature --platform ios --reporter console
bun dist/cli.js test flows/framework-app/playground.flow.ts --platform ios --reporter console
bun dist/cli.js test flows/framework-app/routes-screenshots.flow.ts --platform ios --reporter console

# After code changes, rebuild before testing:
npx turbo build --filter=spana-test --force
```

## Environment

- Simulator: iPhone 17 Pro (UDID: 7338EC82-D2BD-4722-B148-D009FDA64F6E), iOS 26.4
- App bundle: `com.wezter96.spana.testapp` with URL scheme `spana://`
- WDA: appium-webdriveragent@11.4.1
- Metro bundler running on port 8081

## Root Causes Identified

### Issue 1: Screenshots flow — `app.launch()` on iOS doesn't reset navigation state

**Symptom:** The screenshots flow (`routes-screenshots.flow.ts`) launches the app for each route via `app.launch()` then navigates through the drawer. On the first route (home `/`), it calls `app.launch()` then `expect({ accessibilityLabel: "Show navigation menu" }).toBeVisible()`. But the screenshot shows the app is on a different screen (167 elements, `drawer-home-item` suggested).

**Root cause:** `app.launch()` on iOS just activates the existing app — it doesn't reset the navigation stack. If a previous test left the app on a non-home screen, `launch()` resumes there.

**Evidence:** The Studio screenshot shows:

- `launch` succeeds (1.6s)
- `expect.toBeVisible` for nav menu succeeds (734ms)
- `expect.toBeVisible` for `home-title` fails (10.9s) — element not found, 167 elements in hierarchy
- The failure screenshot shows the drawer is open but the home screen content isn't visible

**Fix approach:**

1. Read `packages/spana/src/drivers/wda/driver.ts` — the `launchApp` function (around line 260-300)
2. Read `packages/spana/src/device/ios.ts` — `launchOnSimulator` and `terminateOnSimulator`
3. The iOS `launchApp` should terminate + relaunch the app to reset navigation state
4. Or: the screenshots flow should navigate home explicitly via drawer before each route
5. Test: `bun dist/cli.js test flows/framework-app/routes-screenshots.flow.ts --platform ios --reporter console`

### Issue 2: BDD text input — `insertText` drops characters on iOS

**Symptom:** BDD flow types "Hello BDD test" but mirror shows "Hllo BDD test" (missing "e").

**Root cause:** The Playwright driver uses `page.keyboard.insertText()` which works for web. The iOS WDA driver uses `sendKeys` via W3C Actions which sends keyDown/keyUp per grapheme. Some characters may get dropped due to WDA event processing speed.

**Evidence:** The error says `Expected text "Hello BDD test" but got "Hllo BDD test" after 5000ms`

**Fix approach:**

1. Read `packages/spana/src/drivers/wda/client.ts` — the `sendKeys` method (around line 215-250)
2. The WDA driver sends individual keyDown/keyUp actions. On iOS, rapid key events can get coalesced
3. Try adding a small delay between key events (5-10ms) for iOS
4. Or: use WDA's element `setValue` endpoint instead of W3C Actions for text input
5. To find the focused element: use `/element/active` or search for the focused element in the hierarchy
6. Test: `bun dist/cli.js test flows/framework-app/framework-app.feature --platform ios --reporter console`

### Issue 3: Double-tap doesn't trigger React Native `onPress` on iOS

**Symptom:** The BDD flow's double-tap step completes but the playground's status stays at "Ready" or "Waiting" instead of "Detected".

**Root cause:** WDA's native `doubleTap` gesture doesn't fire React Native `Pressable`'s `onPress` handler. The React component detects double-tap by checking time between consecutive `onPress` calls (< 1000ms window). WDA's HTTP round-trip for two sequential taps exceeds this window.

**Evidence:** The double-tap step takes 1.5-4s but the React handler needs two onPress events within 1000ms.

**Fix approach:**

1. Read `packages/spana/src/drivers/wda/driver.ts` — `doubleTapAtCoordinate` (around line 175)
2. Read `packages/spana/src/drivers/wda/client.ts` — `doubleTap` and `tap` methods
3. Currently uses `client.doubleTap(x, y)` which is WDA's native gesture
4. Option A: Send two taps as a single W3C Actions sequence (both taps in one HTTP request) to minimize latency
5. Option B: Use WDA's touch actions API to send two quick pointer events in one call
6. The key insight: both taps must land within 1000ms **from React's perspective** (the `Date.now()` check in the Pressable handler)
7. The current BDD step already has a platform-specific handler in `flows/framework-app/steps/navigation.steps.ts` that uses two `app.tap()` calls on iOS — but this is slow because each tap goes through `waitForActionElement` → HTTP
8. Consider: implement double-tap at the driver level using a single W3C Actions request with two tap sequences
9. Test: `bun dist/cli.js test flows/framework-app/framework-app.feature --platform ios --reporter console`

### Issue 4: WDA session instability between flows

**Symptom:** After certain flows (especially BDD), subsequent flows get "Unable to connect" or "Session does not exist" errors.

**Root cause:** The WDA session becomes invalid when:

- The app crashes or gets backgrounded
- `openLink` with custom URL schemes routes through Safari, stealing focus from WDA
- Multiple `launch()` calls confuse WDA's session tracking

**Evidence:** First flow often passes, then subsequent flows fail with session errors.

**Fix approach:**

1. Read `packages/spana/src/drivers/wda/driver.ts` — the `createSessionWithRetry` function and session management
2. The WDA driver should detect session loss and automatically recreate the session
3. Check the `dumpHierarchy` / `getPageSource` method — when it gets "Unable to connect", it should attempt session recovery
4. Add a `ensureSession()` helper that validates the current session and recreates if needed
5. Wrap `getPageSource` in a retry that recreates the session on 404/connection errors
6. Test: Run all 5 iOS flows together: `bun dist/cli.js test flows/framework-app --platform ios --reporter console`

## Iteration Workflow

For each issue, follow this cycle:

1. **Read the relevant source files** listed in "Fix approach"
2. **Make the code change**
3. **Rebuild**: `npx turbo build --filter=spana-test --force`
4. **Kill stale WDA**: `pkill -9 -f "xcodebuild.*WebDriverAgent"; lsof -ti:8100 | xargs kill -9; sleep 2`
5. **Run the specific test**: Use the single-flow command from "Fix approach"
6. **If it passes**, run the full iOS suite: `bun dist/cli.js test flows/framework-app --platform ios --reporter console`
7. **If all pass**, verify web+android still pass: `bun dist/cli.js test flows/framework-app --platform web,android --reporter console`
8. **Run unit tests**: `bun test packages/spana/src/` (437 tests, all must pass)
9. **Commit and push**

## Priority Order

1. **Issue 4 (session stability)** — fixes the cascading failures, most impactful
2. **Issue 1 (screenshots navigation)** — drawer navigation logic needs fixing
3. **Issue 2 (text input)** — character dropping
4. **Issue 3 (double-tap)** — needs W3C Actions batching

## Key Files

| File                                                            | What it does                                           |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| `packages/spana/src/drivers/wda/driver.ts`                      | iOS WDA driver — session, tap, launch, openUrl         |
| `packages/spana/src/drivers/wda/client.ts`                      | WDA HTTP client — all WDA API calls                    |
| `packages/spana/src/drivers/wda/installer.ts`                   | WDA build + start (xcodebuild)                         |
| `packages/spana/src/device/ios.ts`                              | simctl helpers — launch, terminate, install            |
| `packages/spana/flows/framework-app/steps/navigation.steps.ts`  | BDD step definitions                                   |
| `packages/spana/flows/framework-app/support/navigation.ts`      | Navigation helpers (navigateToHomeScreen, etc.)        |
| `packages/spana/flows/framework-app/playground.flow.ts`         | Playground flow                                        |
| `packages/spana/flows/framework-app/routes-screenshots.flow.ts` | Screenshots flow                                       |
| `packages/spana/flows/framework-app/modal.flow.ts`              | Modal flow                                             |
| `apps/native/app/(drawer)/playground.tsx`                       | React Native playground component (double-tap handler) |
| `packages/spana/spana.config.ts`                                | Test config (bundleId, URLs)                           |

## Simulator Info

```bash
# UDID
xcrun simctl list devices booted   # iPhone 17 Pro: 7338EC82-D2BD-4722-B148-D009FDA64F6E

# Check app installed
xcrun simctl get_app_container booted com.wezter96.spana.testapp

# Manually launch app
xcrun simctl launch booted com.wezter96.spana.testapp

# Manually terminate
xcrun simctl terminate booted com.wezter96.spana.testapp

# Check WDA status
curl -s http://localhost:8100/status

# Kill stale WDA
pkill -9 -f "xcodebuild.*WebDriverAgent"
```
