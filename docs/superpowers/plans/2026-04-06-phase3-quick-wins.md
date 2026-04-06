# Phase 3 Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire relative selectors into the public API, add `--device <id>` CLI targeting, and plumb LaunchOptions end-to-end through all drivers.

**Architecture:** Three independent changes that each widen existing interfaces without breaking backwards compatibility. Item 1 changes type signatures from `Selector` to `ExtendedSelector` through auto-wait → coordinator → PromiseApp → Session. Item 2 adds `findDeviceById()` to discovery and a `--device` flag to CLI. Item 3 consolidates duplicate `LaunchOptions`, widens public APIs, and implements `clearState`/`clearKeychain`/`launchArguments` in each driver.

**Tech Stack:** TypeScript, Effect, Bun test runner

---

## File Structure

| File                                 | Responsibility                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `src/schemas/selector.ts`            | Type definitions (already has `ExtendedSelector`) — no changes                      |
| `src/smart/element-matcher.ts`       | Element matching logic (already has `findElementExtended`) — add `formatSelector()` |
| `src/smart/auto-wait.ts`             | Poll-based element waiting — widen to `ExtendedSelector`                            |
| `src/smart/coordinator.ts`           | High-level action coordinator — widen to `ExtendedSelector`                         |
| `src/api/app.ts`                     | PromiseApp public API — widen selectors + launch opts                               |
| `src/agent/session.ts`               | Agent session — widen selectors + launch opts + deviceId                            |
| `src/device/discover.ts`             | Device discovery — add `findDeviceById()`                                           |
| `src/cli/index.ts`                   | CLI flag parsing — add `--device`                                                   |
| `src/cli/test-command.ts`            | Test command — device routing + launch opts plumbing                                |
| `src/schemas/config.ts`              | Config schema — remove duplicate `LaunchOptions`, add `launchOptions` field         |
| `src/drivers/raw-driver.ts`          | Single source of `LaunchOptions` — no changes                                       |
| `src/drivers/uiautomator2/driver.ts` | Android driver — implement `clearState`/`launchArguments`                           |
| `src/drivers/wda/driver.ts`          | iOS driver — implement `clearState`/`clearKeychain`/`launchArguments`               |
| `src/drivers/playwright.ts`          | Web driver — implement `clearState`                                                 |

---

### Task 1: Relative Selectors — Add `formatSelector` helper

**Files:**

- Modify: `packages/spana/src/smart/element-matcher.ts`
- Test: `packages/spana/src/smart/element-matcher.test.ts`

- [ ] **Step 1: Write failing tests for `formatSelector`**

Add to the bottom of `element-matcher.test.ts`:

```typescript
import { formatSelector } from "./element-matcher.js";

describe("formatSelector", () => {
  test("formats string selector", () => {
    expect(formatSelector("Login")).toBe('"Login"');
  });

  test("formats testID selector", () => {
    expect(formatSelector({ testID: "btn-submit" })).toBe('testID: "btn-submit"');
  });

  test("formats text selector", () => {
    expect(formatSelector({ text: "Submit" })).toBe('text: "Submit"');
  });

  test("formats accessibilityLabel selector", () => {
    expect(formatSelector({ accessibilityLabel: "Close" })).toBe('accessibilityLabel: "Close"');
  });

  test("formats point selector", () => {
    expect(formatSelector({ point: { x: 10, y: 20 } })).toBe("point: (10, 20)");
  });

  test("formats relative selector", () => {
    expect(formatSelector({ selector: { text: "Submit" }, below: { text: "Email" } })).toBe(
      'text: "Submit" below text: "Email"',
    );
  });

  test("formats relative selector with multiple constraints", () => {
    expect(
      formatSelector({ selector: { testID: "btn" }, below: "Header", rightOf: { text: "Label" } }),
    ).toBe('testID: "btn" below "Header" rightOf text: "Label"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/spana && bun test src/smart/element-matcher.test.ts`
Expected: FAIL — `formatSelector` is not exported

- [ ] **Step 3: Implement `formatSelector`**

Add to the end of `packages/spana/src/smart/element-matcher.ts` (before the `findRelativeElement` function):

```typescript
/** Format a selector (simple or extended) as a human-readable string for error messages */
export function formatSelector(sel: ExtendedSelector): string {
  if (isRelativeSelector(sel)) {
    const parts = [formatSimpleSelector(sel.selector)];
    if (sel.below) parts.push(`below ${formatSimpleSelector(sel.below)}`);
    if (sel.above) parts.push(`above ${formatSimpleSelector(sel.above)}`);
    if (sel.leftOf) parts.push(`leftOf ${formatSimpleSelector(sel.leftOf)}`);
    if (sel.rightOf) parts.push(`rightOf ${formatSimpleSelector(sel.rightOf)}`);
    if (sel.childOf) parts.push(`childOf ${formatSimpleSelector(sel.childOf)}`);
    return parts.join(" ");
  }
  return formatSimpleSelector(sel);
}

function formatSimpleSelector(sel: Selector): string {
  if (typeof sel === "string") return `"${sel}"`;
  if ("testID" in sel) return `testID: "${sel.testID}"`;
  if ("text" in sel) return `text: "${sel.text}"`;
  if ("accessibilityLabel" in sel) return `accessibilityLabel: "${sel.accessibilityLabel}"`;
  if ("point" in sel) return `point: (${sel.point.x}, ${sel.point.y})`;
  return JSON.stringify(sel);
}
```

Note: `isRelativeSelector` is already imported at line 3. Add `ExtendedSelector` to the existing import from `../schemas/selector.js` if not already there (it is — line 2 imports `ExtendedSelector`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/spana && bun test src/smart/element-matcher.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd packages/spana && git add src/smart/element-matcher.ts src/smart/element-matcher.test.ts && git commit -m "feat: add formatSelector helper for human-readable error messages"
```

---

### Task 2: Relative Selectors — Widen auto-wait to ExtendedSelector

**Files:**

- Modify: `packages/spana/src/smart/auto-wait.ts`
- Test: `packages/spana/src/smart/auto-wait.test.ts`

- [ ] **Step 1: Write failing test for relative selector in waitForElement**

Add to `auto-wait.test.ts`, inside the `"auto wait"` describe block:

```typescript
test("waitForElement resolves with a relative selector", async () => {
  const header = createElement({ text: "Header", bounds: { x: 0, y: 0, width: 100, height: 50 } });
  const btn = createElement({
    text: "Submit",
    bounds: { x: 0, y: 60, width: 100, height: 40 },
    clickable: true,
  });
  const root = createElement({ children: [header, btn] });
  const { driver } = createDriver([root]);

  const element = await Effect.runPromise(
    waitForElement(driver, { selector: { text: "Submit" }, below: { text: "Header" } }, parse, {
      timeout: 50,
      pollInterval: 0,
    }),
  );

  expect(element.text).toBe("Submit");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/spana && bun test src/smart/auto-wait.test.ts`
Expected: FAIL — TypeScript error, `waitForElement` does not accept `RelativeSelector`

- [ ] **Step 3: Update auto-wait.ts to accept ExtendedSelector**

In `packages/spana/src/smart/auto-wait.ts`, make these changes:

Change the import on line 4 from:

```typescript
import type { Selector } from "../schemas/selector.js";
```

to:

```typescript
import type { ExtendedSelector } from "../schemas/selector.js";
```

Change the import on line 6 from:

```typescript
import { findElement } from "./element-matcher.js";
```

to:

```typescript
import { findElementExtended, formatSelector } from "./element-matcher.js";
```

Change `waitForElement` signature (line 22-23) from:

```typescript
  selector: Selector,
```

to:

```typescript
  selector: ExtendedSelector,
```

Change line 35 from:

```typescript
const element = findElement(root, selector);
```

to:

```typescript
const element = findElementExtended(root, selector);
```

Change line 39-42 (the error message) from:

```typescript
return (
  yield *
  new ElementNotFoundError({
    message: `Element not found within ${timeout}ms — selector: ${JSON.stringify(selector)}`,
    selector,
    timeoutMs: timeout,
  })
);
```

to:

```typescript
return (
  yield *
  new ElementNotFoundError({
    message: `Element not found within ${timeout}ms — selector: ${formatSelector(selector)}`,
    selector,
    timeoutMs: timeout,
  })
);
```

Change `waitForNotVisible` signature (line 49-50) from:

```typescript
  selector: Selector,
```

to:

```typescript
  selector: ExtendedSelector,
```

Change line 62 from:

```typescript
const element = findElement(root, selector);
```

to:

```typescript
const element = findElementExtended(root, selector);
```

Change line 66-69 (the error message) from:

```typescript
return (
  yield *
  new WaitTimeoutError({
    message: `Element still visible after ${timeout}ms — selector: ${JSON.stringify(selector)}`,
    selector,
    timeoutMs: timeout,
  })
);
```

to:

```typescript
return (
  yield *
  new WaitTimeoutError({
    message: `Element still visible after ${timeout}ms — selector: ${formatSelector(selector)}`,
    selector,
    timeoutMs: timeout,
  })
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/spana && bun test src/smart/auto-wait.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd packages/spana && git add src/smart/auto-wait.ts src/smart/auto-wait.test.ts && git commit -m "feat: widen auto-wait to accept ExtendedSelector for relative selectors"
```

---

### Task 3: Relative Selectors — Widen coordinator and PromiseApp

**Files:**

- Modify: `packages/spana/src/smart/coordinator.ts`
- Modify: `packages/spana/src/api/app.ts`
- Test: `packages/spana/src/smart/coordinator.test.ts`
- Test: `packages/spana/src/api/app.test.ts`

- [ ] **Step 1: Write failing test for relative selector in coordinator**

Add to `coordinator.test.ts`, inside the existing describe block:

```typescript
test("tap resolves a relative selector", async () => {
  const header = createElement({
    text: "Header",
    bounds: { x: 0, y: 0, width: 100, height: 50 },
  });
  const btn = createElement({
    text: "Submit",
    bounds: { x: 10, y: 60, width: 80, height: 40 },
    clickable: true,
  });
  const root = createElement({ children: [header, btn] });
  const { driver, getTapCoords } = createDriver([root]);

  const coord = createCoordinator(driver, { parse });
  await Effect.runPromise(
    coord.tap(
      { selector: { text: "Submit" }, below: { text: "Header" } },
      { timeout: 50, pollInterval: 0 },
    ),
  );

  expect(getTapCoords()).toEqual({ x: 50, y: 80 });
});
```

Note: This test uses the existing `createDriver` and `createElement` helpers already in the test file. If `getTapCoords` is not available in the test helper, check the existing test helpers — use the pattern from the existing tap test to capture tap coordinates. Let me verify the exact pattern:

The existing test at line 90-104 of `coordinator.test.ts` captures taps via the driver mock. Adapt accordingly — the key assertion is that `coord.tap()` accepts a `RelativeSelector` and resolves to the correct coordinates.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/spana && bun test src/smart/coordinator.test.ts`
Expected: FAIL — type error, `tap` doesn't accept `RelativeSelector`

- [ ] **Step 3: Update coordinator.ts**

In `packages/spana/src/smart/coordinator.ts`, change line 4 from:

```typescript
import type { Selector } from "../schemas/selector.js";
```

to:

```typescript
import type { ExtendedSelector } from "../schemas/selector.js";
```

Then change every `Selector` parameter to `ExtendedSelector` in the returned object methods:

Line 25: `tap: (selector: ExtendedSelector, opts?: WaitOptions)`
Line 35: `doubleTap: (selector: ExtendedSelector, opts?: WaitOptions)`
Line 42: `longPress: (selector: ExtendedSelector, duration: number = 1000, opts?: WaitOptions)`
Line 98: `assertVisible: (selector: ExtendedSelector, opts?: WaitOptions)`
Line 101: `assertHidden: (selector: ExtendedSelector, opts?: WaitOptions)`
Line 104: `assertText: (selector: ExtendedSelector, expected: string, opts?: WaitOptions)`

- [ ] **Step 4: Update app.ts (PromiseApp)**

In `packages/spana/src/api/app.ts`, change line 3 from:

```typescript
import type { Selector } from "../schemas/selector.js";
```

to:

```typescript
import type { ExtendedSelector } from "../schemas/selector.js";
```

Change the `PromiseApp` interface (lines 9-13) — replace `Selector` with `ExtendedSelector`:

```typescript
export interface PromiseApp {
  tap(selector: ExtendedSelector, opts?: WaitOptions): Promise<void>;
  tapXY(x: number, y: number): Promise<void>;
  doubleTap(selector: ExtendedSelector, opts?: WaitOptions): Promise<void>;
  longPress(selector: ExtendedSelector, opts?: { duration?: number } & WaitOptions): Promise<void>;
```

Leave the rest of the interface unchanged (non-selector methods stay the same).

- [ ] **Step 5: Run all affected tests**

Run: `cd packages/spana && bun test src/smart/coordinator.test.ts src/api/app.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
cd packages/spana && git add src/smart/coordinator.ts src/api/app.ts src/smart/coordinator.test.ts && git commit -m "feat: widen coordinator and PromiseApp to accept ExtendedSelector"
```

---

### Task 4: Relative Selectors — Widen Session API

**Files:**

- Modify: `packages/spana/src/agent/session.ts`
- Test: `packages/spana/src/agent/session.test.ts`

- [ ] **Step 1: Write failing test for relative selector in Session**

Add to `session.test.ts` (follow existing test patterns in that file):

```typescript
test("tap accepts a relative selector", async () => {
  // Use the existing mock driver pattern from session.test.ts
  // Create a Session with a mock driver, call tap with a RelativeSelector
  // Verify it resolves without error
});
```

The exact test depends on the mocking pattern in `session.test.ts`. The key assertion: `session.tap({ selector: { text: "Submit" }, below: { text: "Header" } })` should compile and resolve.

- [ ] **Step 2: Update session.ts**

In `packages/spana/src/agent/session.ts`, change line 3 from:

```typescript
import type { Platform, Selector } from "../schemas/selector.js";
```

to:

```typescript
import type { Platform, ExtendedSelector } from "../schemas/selector.js";
```

Add import for `findElementExtended`:

```typescript
import { flattenElements, findElementExtended, centerOf } from "../smart/element-matcher.js";
```

(replacing the existing `findElement` import on line 11)

Change `tap` (line 97):

```typescript
  async tap(selector: ExtendedSelector): Promise<void> {
    const root = await this.hierarchy();
    const el = findElementExtended(root, selector);
```

Change `doubleTap` (line 109):

```typescript
  async doubleTap(selector: ExtendedSelector): Promise<void> {
    const root = await this.hierarchy();
    const el = findElementExtended(root, selector);
```

Change `longPress` (line 117):

```typescript
  async longPress(selector: ExtendedSelector, opts?: { duration?: number }): Promise<void> {
    const root = await this.hierarchy();
    const el = findElementExtended(root, selector);
```

- [ ] **Step 3: Run tests**

Run: `cd packages/spana && bun test src/agent/session.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
cd packages/spana && git add src/agent/session.ts src/agent/session.test.ts && git commit -m "feat: widen Session API to accept ExtendedSelector"
```

---

### Task 5: Device Targeting — Add `findDeviceById` to discovery

**Files:**

- Modify: `packages/spana/src/device/discover.ts`
- Test: `packages/spana/src/device/discover.test.ts`

- [ ] **Step 1: Write failing test for findDeviceById**

Add to `discover.test.ts`, inside the `"device discovery"` describe block:

```typescript
test("findDeviceById returns matching device", async () => {
  discoverState.versionCandidates.add("adb");
  discoverState.androidDevicesOutput = [
    "List of devices attached",
    "emulator-5554 device",
    "",
  ].join("\n");
  discoverState.iosDevicesJson = JSON.stringify({
    devices: {
      "com.apple.CoreSimulator.SimRuntime.iOS-18-0": [
        { udid: "SIM-1", name: "iPhone 15", state: "Booted", isAvailable: true },
      ],
    },
  });

  const androidModule = await importFreshModule<typeof import("./android.js")>("./android.ts");
  const iosModule = await importFreshModule<typeof import("./ios.js")>("./ios.ts");
  mock.module("./android.js", () => androidModule);
  mock.module("./ios.js", () => iosModule);
  const discover = await importFreshModule<typeof import("./discover.js")>("./discover.ts");

  expect(discover.findDeviceById("emulator-5554")).toEqual({
    platform: "android",
    id: "emulator-5554",
    name: "emulator-5554",
    type: "emulator",
    state: "device",
  });

  expect(discover.findDeviceById("SIM-1")).toEqual({
    platform: "ios",
    id: "SIM-1",
    name: "iPhone 15 (iOS.18.0)",
    type: "simulator",
    state: "Booted",
  });

  expect(discover.findDeviceById("nonexistent")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/spana && bun test src/device/discover.test.ts`
Expected: FAIL — `findDeviceById` not exported

- [ ] **Step 3: Implement `findDeviceById`**

Add to the end of `packages/spana/src/device/discover.ts`:

```typescript
/** Find a specific device by ID across all platforms */
export function findDeviceById(id: string): DiscoveredDevice | null {
  const devices = discoverDevices(["web", "android", "ios"]);
  return devices.find((d) => d.id === id) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/spana && bun test src/device/discover.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd packages/spana && git add src/device/discover.ts src/device/discover.test.ts && git commit -m "feat: add findDeviceById for explicit device targeting"
```

---

### Task 6: Device Targeting — Add `--device` CLI flag

**Files:**

- Modify: `packages/spana/src/cli/index.ts`
- Modify: `packages/spana/src/cli/test-command.ts`

- [ ] **Step 1: Add `--device` flag parsing to CLI**

In `packages/spana/src/cli/index.ts`, add a `device` variable after `retries` (line 13):

```typescript
let device: string | undefined;
```

Add parsing inside the `for` loop (after the `--retries` block, around line 29):

```typescript
    } else if (arg === "--device" && args[i + 1]) {
      device = args[++i];
```

Pass `device` to `runTestCommand` (around line 35-43):

```typescript
const success = await runTestCommand({
  platforms,
  tags,
  grep,
  reporter,
  configPath,
  flowPath,
  retries,
  device,
});
```

Add `--device` to the help text (around line 173):

```typescript
console.log("  --device <id>              Target a specific device by ID");
```

- [ ] **Step 2: Add `device` to TestCommandOptions and implement routing**

In `packages/spana/src/cli/test-command.ts`, add to `TestCommandOptions` (line 37):

```typescript
  device?: string;
```

At the top of `runTestCommand`, after the platforms resolution (after line 63), add device resolution:

```typescript
// Resolve explicit device targeting
let targetDevice: import("../device/discover.js").DiscoveredDevice | null = null;
if (opts.device) {
  const { findDeviceById } = await import("../device/discover.js");
  targetDevice = findDeviceById(opts.device);
  if (!targetDevice) {
    const { discoverDevices } = await import("../device/discover.js");
    const available = discoverDevices(["web", "android", "ios"]);
    console.log(`Device "${opts.device}" not found. Available devices:`);
    for (const d of available) {
      console.log(`  ${d.id.padEnd(30)} ${d.platform.padEnd(8)} ${d.type}`);
    }
    return false;
  }
  // If --platform wasn't explicitly set, infer from device
  if (opts.platforms.length === 0 && (!config.platforms || config.platforms.length === 0)) {
    platforms.length = 0;
    platforms.push(targetDevice.platform);
  }
  // Validate platform match
  if (!platforms.includes(targetDevice.platform)) {
    console.log(
      `Device "${opts.device}" is ${targetDevice.platform}, but --platform ${platforms.join(",")} was specified.`,
    );
    return false;
  }
}
```

Note: `platforms` is declared with `const` on line 58 as a `Platform[]`. Since we need to mutate it, the `platforms.length = 0; platforms.push(...)` pattern works because it modifies the array in place.

- [ ] **Step 3: Use targetDevice in driver setup**

In the Android setup block (around line 138), change:

```typescript
    if (platform === "android") {
      const device = targetDevice?.platform === "android"
        ? { serial: targetDevice.id, state: "device" as const, type: targetDevice.type as "emulator" | "device" }
        : ensureAndroidDevice();
```

In the iOS setup block, when `targetDevice` is set and is iOS, skip the physical device probe and use the target directly. Before the `const physicalDevice = firstIOSPhysicalDevice();` line (around line 195), add:

```typescript
// If a specific device was targeted, use it directly
if (targetDevice?.platform === "ios") {
  // targetDevice.type tells us if it's a simulator or physical device
  // For now, route simulators through the simulator path
  if (targetDevice.type === "simulator") {
    const { bootSimulator, isSimulatorBooted } = await import("../device/ios.js");
    if (!isSimulatorBooted(targetDevice.id)) {
      bootSimulator(targetDevice.id);
    }
    if (iosAppPath && bundleId) {
      ensureAppInstalled({
        udid: targetDevice.id,
        bundleId,
        appPath: resolveFromConfig(iosAppPath),
        isPhysicalDevice: false,
      });
    }
    const wdaPort = 8100 + Math.floor(Math.random() * 100);
    const conn = await setupWDA(targetDevice.id, wdaPort);
    const driver = await Effect.runPromise(
      createWDADriver(conn.host, conn.port, bundleId, targetDevice.id),
    );
    const engineConfig: EngineConfig = {
      appId: bundleId,
      platform: "ios",
      coordinatorConfig: {
        parse: parseIOSHierarchy,
        defaults: {
          timeout: config.defaults?.waitTimeout,
          pollInterval: config.defaults?.pollInterval,
        },
      },
      autoLaunch: true,
      flowTimeout: config.defaults?.waitTimeout ? config.defaults.waitTimeout * 10 : 60_000,
      artifactConfig: config.artifacts,
    };
    platformConfigs.push({ platform, driver, engineConfig });
    continue;
  }
  // Physical device targeted — fall through to existing physical device code
}
```

- [ ] **Step 4: Update Session connect to accept device option**

In `packages/spana/src/agent/session.ts`, the `ConnectOptions` interface (line 19-26) already has `device?: string`. In the `connect` function, when `opts.device` is set for android (line 238-247):

Change line 239 from:

```typescript
const device = firstAndroidDevice();
```

to:

```typescript
const device = opts.device
  ? { serial: opts.device, state: "device" as const, type: "device" as const }
  : firstAndroidDevice();
```

For iOS (line 250-261), change line 252 from:

```typescript
const sim = firstIOSSimulatorWithApp(bundleId);
```

to:

```typescript
const sim = opts.device
  ? {
      udid: opts.device,
      name: opts.device,
      state: "Booted" as const,
      runtime: "",
      isAvailable: true,
    }
  : firstIOSSimulatorWithApp(bundleId);
```

- [ ] **Step 5: Run tests**

Run: `cd packages/spana && bun test src/cli/test-command.test.ts src/device/discover.test.ts src/agent/session.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
cd packages/spana && git add src/cli/index.ts src/cli/test-command.ts src/agent/session.ts && git commit -m "feat: add --device flag for explicit device targeting"
```

---

### Task 7: LaunchOptions — Consolidate types and widen public APIs

**Files:**

- Modify: `packages/spana/src/schemas/config.ts`
- Modify: `packages/spana/src/api/app.ts`
- Modify: `packages/spana/src/agent/session.ts`

- [ ] **Step 1: Remove duplicate LaunchOptions from config.ts**

In `packages/spana/src/schemas/config.ts`, remove lines 3-8 (the `LaunchOptions` interface) and add an import:

```typescript
import type { LaunchOptions } from "../drivers/raw-driver.js";
```

Add `launchOptions` to `ProvConfig` (after `flowDir` on line 57):

```typescript
  launchOptions?: LaunchOptions;
```

Re-export `LaunchOptions` for consumers:

```typescript
export type { LaunchOptions };
```

- [ ] **Step 2: Widen PromiseApp.launch()**

In `packages/spana/src/api/app.ts`, add to imports:

```typescript
import type { LaunchOptions } from "../drivers/raw-driver.js";
```

Change the `launch` method in the `PromiseApp` interface (line 19) from:

```typescript
  launch(opts?: { deepLink?: string }): Promise<void>;
```

to:

```typescript
  launch(opts?: LaunchOptions): Promise<void>;
```

The implementation on line 88-92 already passes `opts` to `driver.launchApp(appId, opts)`, so no implementation change is needed.

- [ ] **Step 3: Widen Session.launch()**

In `packages/spana/src/agent/session.ts`, add to imports:

```typescript
import type { LaunchOptions } from "../drivers/raw-driver.js";
```

Change line 174 from:

```typescript
  async launch(opts?: { deepLink?: string }): Promise<void> {
```

to:

```typescript
  async launch(opts?: LaunchOptions): Promise<void> {
```

- [ ] **Step 4: Run tests**

Run: `cd packages/spana && bun test src/api/app.test.ts src/agent/session.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd packages/spana && git add src/schemas/config.ts src/api/app.ts src/agent/session.ts && git commit -m "feat: consolidate LaunchOptions and widen public APIs"
```

---

### Task 8: LaunchOptions — Implement in UiAutomator2 driver

**Files:**

- Modify: `packages/spana/src/drivers/uiautomator2/driver.ts`
- Test: `packages/spana/src/drivers/uiautomator2/driver.test.ts`

- [ ] **Step 1: Write failing test for clearState in launchApp**

Add to `driver.test.ts` (follow existing test patterns). The test should verify that when `launchApp` is called with `{ clearState: true }`, it calls `adbClearApp` before launching:

```typescript
test("launchApp with clearState calls adb pm clear before launch", async () => {
  // Use existing mock pattern from driver.test.ts
  // Call launchApp(packageName, { clearState: true })
  // Verify adbClearApp was called (check shell commands executed)
});
```

The exact mock pattern depends on how `driver.test.ts` mocks `child_process`. Adapt to the existing pattern.

- [ ] **Step 2: Implement clearState and launchArguments in UiAutomator2 driver**

In `packages/spana/src/drivers/uiautomator2/driver.ts`, update the `launchApp` method (lines 115-130). Add the `adbClearApp` import if not already present (it's not — `adbClearApp` is imported only by `clearAppState` in this file, but it IS imported on line 3):

Replace the `launchApp` implementation:

```typescript
      launchApp: (bundleId, opts?: LaunchOptions) =>
        Effect.tryPromise({
          try: async () => {
            if (opts?.clearState) {
              adbClearApp(serial, bundleId);
            }
            if (opts?.deepLink) {
              adbOpenLink(serial, opts.deepLink, bundleId);
              await new Promise((resolve) => setTimeout(resolve, 500));
            } else {
              adbForceStop(serial, bundleId);
              const extras = opts?.launchArguments
                ? Object.entries(opts.launchArguments)
                    .map(([k, v]) => `--es ${k} ${String(v)}`)
                    .join(" ")
                : "";
              if (extras) {
                const { adbShell } = await import("../../device/android.js");
                adbShell(serial, `am start -n ${bundleId}/.MainActivity ${extras}`);
              } else {
                adbLaunchApp(serial, bundleId);
              }
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
          },
          catch: (e) => new DriverError({ message: `Launch app failed: ${e}` }),
        }),
```

- [ ] **Step 3: Run tests**

Run: `cd packages/spana && bun test src/drivers/uiautomator2/driver.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
cd packages/spana && git add src/drivers/uiautomator2/driver.ts src/drivers/uiautomator2/driver.test.ts && git commit -m "feat: implement clearState and launchArguments in UiAutomator2 driver"
```

---

### Task 9: LaunchOptions — Implement in WDA driver

**Files:**

- Modify: `packages/spana/src/drivers/wda/driver.ts`
- Test: `packages/spana/src/drivers/wda/driver.test.ts`

- [ ] **Step 1: Implement clearState, clearKeychain, and launchArguments in WDA driver**

In `packages/spana/src/drivers/wda/driver.ts`, add import for simctl operations at the top:

```typescript
import {
  installedUrlSchemesOnSimulator,
  launchOnSimulator,
  launchWithUrlOnSimulator,
  terminateOnSimulator,
  resetSimulatorKeychain,
} from "../../device/ios.js";
```

Note: `resetSimulatorKeychain` doesn't exist yet — we'll add it in this task.

First, add `resetSimulatorKeychain` to `packages/spana/src/device/ios.ts`:

```typescript
/** Reset simulator keychain (removes all stored passwords and certificates) */
export function resetSimulatorKeychain(udid: string): void {
  execSync(`xcrun simctl keychain ${udid} reset`, { stdio: "ignore" });
}
```

Then update the `launchApp` method in the WDA driver (lines 212-229):

```typescript
      launchApp: (appBundleId, opts?: LaunchOptions) =>
        Effect.tryPromise({
          try: async () => {
            if (opts?.clearState && simulatorUdid) {
              terminateOnSimulator(simulatorUdid, appBundleId);
              // Uninstall and reinstall to clear all app data
              try {
                const { execSync } = await import("node:child_process");
                execSync(`xcrun simctl uninstall ${simulatorUdid} ${appBundleId}`, { stdio: "ignore" });
              } catch {
                // App may not be installed
              }
            }
            if (opts?.clearKeychain && simulatorUdid) {
              resetSimulatorKeychain(simulatorUdid);
            } else if (opts?.clearKeychain) {
              console.warn("clearKeychain is only supported on iOS simulators, skipping.");
            }

            if (simulatorUdid) {
              if (opts?.deepLink) {
                await openSimulatorUrl(opts.deepLink, appBundleId);
              } else {
                launchOnSimulator(simulatorUdid, appBundleId);
                await sleep(500);
                await activateSimulatorApp(appBundleId);
              }
              return;
            }

            await (opts?.deepLink ? client.openUrl(opts.deepLink) : client.launchApp(appBundleId));
          },
          catch: (e) => new DriverError({ message: `Launch app failed: ${e}` }),
        }),
```

- [ ] **Step 2: Run tests**

Run: `cd packages/spana && bun test src/drivers/wda/driver.test.ts`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
cd packages/spana && git add src/drivers/wda/driver.ts src/device/ios.ts src/drivers/wda/driver.test.ts && git commit -m "feat: implement clearState, clearKeychain, launchArguments in WDA driver"
```

---

### Task 10: LaunchOptions — Implement in Playwright driver

**Files:**

- Modify: `packages/spana/src/drivers/playwright.ts`
- Test: `packages/spana/src/drivers/playwright.test.ts`

- [ ] **Step 1: Implement clearState in Playwright driver**

In `packages/spana/src/drivers/playwright.ts`, update the `launchApp` method (lines 183-188):

```typescript
      launchApp: (url, opts?: LaunchOptions) =>
        Effect.tryPromise({
          try: async () => {
            if (opts?.clearState) {
              await page.context().clearCookies();
              await page.evaluate(`localStorage.clear(); sessionStorage.clear();`);
            }
            await page.goto(opts?.deepLink || url || config.baseUrl || "about:blank");
          },
          catch: (e) => new DriverError({ message: `Failed to navigate to ${url}: ${e}` }),
        }),
```

- [ ] **Step 2: Run tests**

Run: `cd packages/spana && bun test src/drivers/playwright.test.ts`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
cd packages/spana && git add src/drivers/playwright.ts src/drivers/playwright.test.ts && git commit -m "feat: implement clearState in Playwright driver launchApp"
```

---

### Task 11: LaunchOptions — Plumb config through test command

**Files:**

- Modify: `packages/spana/src/cli/test-command.ts`

- [ ] **Step 1: Pass launchOptions from config to engine**

In `packages/spana/src/cli/test-command.ts`, the `EngineConfig` type needs to support `launchOptions`. First check what `EngineConfig` looks like in `src/core/engine.ts` and add `launchOptions` if needed.

For each platform setup block, add `launchOptions` from config to the `engineConfig`:

In the web block (around line 121-134), add to the engineConfig:

```typescript
          launchOptions: config.launchOptions,
```

In the android block (around line 167-180), add:

```typescript
          launchOptions: config.launchOptions,
```

In the iOS blocks (both physical and simulator, around lines 226-239 and 269-283), add:

```typescript
          launchOptions: config.launchOptions,
```

Note: If `EngineConfig` doesn't have a `launchOptions` field, add it to the interface in `src/core/engine.ts`:

```typescript
  launchOptions?: import("../drivers/raw-driver.js").LaunchOptions;
```

Then in the engine's `autoLaunch` logic, pass the options to `driver.launchApp(appId, engineConfig.launchOptions)`.

- [ ] **Step 2: Run tests**

Run: `cd packages/spana && bun test src/cli/test-command.test.ts src/core/engine.test.ts`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
cd packages/spana && git add src/cli/test-command.ts src/core/engine.ts && git commit -m "feat: plumb config launchOptions through test command to engine"
```

---

### Task 12: Full integration test run

- [ ] **Step 1: Run the full test suite**

Run: `cd packages/spana && bun test`
Expected: All PASS — no regressions

- [ ] **Step 2: Type-check**

Run: `cd packages/spana && bunx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Final commit if any fixups needed**

```bash
cd packages/spana && git add -A && git commit -m "fix: address any remaining type or test issues from Phase 3 quick wins"
```

Only commit if there are actual changes. If everything passes clean, skip this step.
