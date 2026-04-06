# Phase 3 Quick Wins: Relative Selectors, Device Targeting, LaunchOptions

Three focused improvements to close documented gaps with minimal risk.

---

## 1. Relative Selectors — Full Integration

### Problem

Relative selector logic exists in `element-matcher.ts` (`findElementExtended`, `findRelativeElement`) with full test coverage, but the coordinator, auto-wait, and public API only accept `Selector` — not `ExtendedSelector`.

### Changes

**`src/smart/auto-wait.ts`**

- `waitForElement(driver, selector: ExtendedSelector, ...)` — change parameter type
- `waitForNotVisible(driver, selector: ExtendedSelector, ...)` — change parameter type
- Internally switch from `findElement()` to `findElementExtended()`

**`src/smart/coordinator.ts`**

- All selector-accepting methods change `Selector` → `ExtendedSelector`:
  - `tap`, `doubleTap`, `longPress`, `assertVisible`, `assertHidden`, `assertText`
- No logic changes — they delegate to `waitForElement`

**`src/api/app.ts` (PromiseApp)**

- Interface and implementation: `tap(selector: ExtendedSelector, ...)`, etc.

**`src/agent/session.ts`**

- Widen selector-based methods if exposed

**Error formatting**

- `ElementNotFoundError` should format `ExtendedSelector` nicely (e.g., `"text: Submit" below "text: Email"`)

### Backwards Compatibility

`ExtendedSelector = Selector | RelativeSelector`. All existing callers passing `Selector` work with zero changes.

### Usage

```typescript
await app.tap({ selector: { text: "Submit" }, below: { text: "Email" } });
await app.assertVisible({ selector: { testID: "price" }, rightOf: { text: "Total" } });
```

---

## 2. `--device <id>` — Unified Device Targeting

### Problem

Device selection is automatic (first available). No way to target a specific device via CLI. Studio, CLI, and agent each handle discovery differently.

### Changes

**`src/device/discover.ts`**

- Add `findDeviceById(id: string, platforms?: Platform[]): DiscoveredDevice | undefined`
- Calls `discoverDevices()`, filters by exact ID match
- Returns matched device with its platform

**`src/cli/index.ts`**

- Add `--device <id>` to `TestCommandOptions`
- When provided:
  1. Call `findDeviceById(deviceId)` to resolve
  2. If `--platform` also specified, validate device matches that platform
  3. If `--platform` omitted, infer from matched device's platform
  4. Error with clear message if not found (list available devices)

**`src/cli/test-command.ts`**

- When `opts.device` is set, skip auto-selection (`ensureAndroidDevice()`, `ensureIOSSimulator()`)
- Pass resolved device ID directly to driver setup:
  - Android: use serial for `adb -s <serial>`
  - iOS: use UDID for simctl/WDA targeting
  - Web: ignore (or error if explicitly set)

**`src/agent/session.ts`**

- Accept optional `deviceId` in session config, route through `findDeviceById`

**`src/studio/routers/devices.ts`**

- No changes needed — already calls `discoverDevices()` directly

### Usage

```bash
# Explicit device
spana test --device emulator-5554

# Device implies platform (no --platform needed)
spana test --device 00008101-XXXX

# Conflict detected
spana test --device emulator-5554 --platform ios
# Error: Device emulator-5554 is android, but --platform ios was specified
```

---

## 3. LaunchOptions End-to-End

### Problem

`LaunchOptions` interface defines `clearState`, `clearKeychain`, `deepLink`, and `launchArguments`. Only `deepLink` is implemented. The public API (`PromiseApp.launch()`, `Session.launch()`) only accepts `{ deepLink?: string }`. Drivers accept but ignore the other fields.

### Changes

**Type consolidation**

- Remove duplicate `LaunchOptions` from `config.ts`
- Import and re-export from `raw-driver.ts` as single source of truth

**`src/api/app.ts` (PromiseApp)**

- Widen `launch(opts?: LaunchOptions)` — pass full options to `driver.launchApp()`

**`src/agent/session.ts`**

- Widen `launch(opts?: LaunchOptions)`

**`src/schemas/config.ts`**

- Add optional `launchOptions?: LaunchOptions` at config level (defaults for every flow run)

**`src/cli/test-command.ts`**

- Read `config.launchOptions` and pass to engine/driver during `autoLaunch`

**Driver implementations:**

| Option            | UIA2 (Android)                           | WDA (iOS)                                                     | Playwright (Web)                                     |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| `clearState`      | `adb shell pm clear <pkg>` before launch | `xcrun simctl privacy reset all <bundleId>` + delete app data | `page.context().clearCookies()` + clear localStorage |
| `clearKeychain`   | No-op (no equivalent)                    | `xcrun simctl keychain reset <udid>` (simulator only)         | No-op                                                |
| `launchArguments` | `adb shell am start -e key value` extras | WDA launch arguments in session capabilities                  | No-op (not applicable to web)                        |
| `deepLink`        | Already works                            | Already works                                                 | Already works                                        |

**Physical iOS devices:** `clearKeychain` via `simctl` only works on simulators. For physical devices, log a warning and skip.

### Usage

```typescript
// Config-level defaults
export default {
  launchOptions: { clearState: true },
};

// Per-call override
await app.launch({ clearState: true, launchArguments: { env: "staging" } });
```

---

## Files Modified (Summary)

| File                                 | Item 1        | Item 2             | Item 3                                  |
| ------------------------------------ | ------------- | ------------------ | --------------------------------------- |
| `src/smart/auto-wait.ts`             | Type widening |                    |                                         |
| `src/smart/coordinator.ts`           | Type widening |                    |                                         |
| `src/api/app.ts`                     | Type widening |                    | API widening                            |
| `src/agent/session.ts`               | Type widening | `deviceId` config  | API widening                            |
| `src/device/discover.ts`             |               | `findDeviceById()` |                                         |
| `src/cli/index.ts`                   |               | `--device` flag    |                                         |
| `src/cli/test-command.ts`            |               | Device routing     | Config plumbing                         |
| `src/schemas/config.ts`              |               |                    | `launchOptions` field, consolidate type |
| `src/drivers/raw-driver.ts`          |               |                    | Single type source                      |
| `src/drivers/uiautomator2/driver.ts` |               |                    | Implement options                       |
| `src/drivers/wda/driver.ts`          |               |                    | Implement options                       |
| `src/drivers/playwright.ts`          |               |                    | Implement options                       |
