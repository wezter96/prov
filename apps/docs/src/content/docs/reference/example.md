---
title: API Reference
description: Quick reference for all app methods, expect methods, and config options.
---

## app methods

All methods return `Promise<void>` unless noted.

### Interaction

| Method | Signature | Description |
|---|---|---|
| `tap` | `(selector, opts?)` | Tap an element matching the selector |
| `tapXY` | `(x, y)` | Tap at absolute screen coordinates |
| `doubleTap` | `(selector, opts?)` | Double-tap an element |
| `longPress` | `(selector, opts?)` | Long-press an element |
| `longPressXY` | `(x, y, opts?)` | Long-press at coordinates |
| `inputText` | `(text)` | Type text into the focused element |
| `pressKey` | `(key)` | Press a named key |
| `hideKeyboard` | `()` | Dismiss the software keyboard |
| `swipe` | `(direction, opts?)` | Swipe in a direction |
| `scroll` | `(direction)` | Scroll in a direction |

Direction: `"up" | "down" | "left" | "right"`

### App lifecycle

| Method | Signature | Description |
|---|---|---|
| `launch` | `(opts?)` | Launch the app |
| `stop` | `()` | Stop the app |
| `kill` | `()` | Force-kill the app |
| `clearState` | `()` | Clear app data/state |
| `openLink` | `(url)` | Open a URL or deep link |
| `back` | `()` | Press the back button (Android) |

### Utilities

| Method | Signature | Description |
|---|---|---|
| `takeScreenshot` | `()` | `Promise<Uint8Array>` — capture the current screen |

## expect methods

```ts
expect(selector: Selector): PromiseExpectation
```

| Method | Signature | Description |
|---|---|---|
| `toBeVisible` | `(opts?)` | Assert element is present and visible |
| `toBeHidden` | `(opts?)` | Assert element is absent or not visible |
| `toHaveText` | `(expected, opts?)` | Assert element text contains `expected` |

## Selectors

| Type | Example | Notes |
|---|---|---|
| `string` | `"login-btn"` | Shorthand for `{ testID: "login-btn" }` |
| `testID` | `{ testID: "login-btn" }` | `data-testid` / `accessibilityIdentifier` / `resource-id` |
| `text` | `{ text: "Sign In" }` | Visible label, partial match |
| `accessibilityLabel` | `{ accessibilityLabel: "Close" }` | OS accessibility label |
| `point` | `{ point: { x: 100, y: 200 } }` | Absolute coordinates, last resort |

## WaitOptions

Accepted by all selector-based `app` methods and all `expect` methods.

```ts
interface WaitOptions {
  timeout?:       number;  // ms
  pollInterval?:  number;  // ms
  settleTimeout?: number;  // ms
}
```

## FlowConfig

```ts
interface FlowConfig {
  tags?:       string[];
  platforms?:  Array<"web" | "android" | "ios">;
  timeout?:    number;
  autoLaunch?: boolean;
}
```

## defineConfig options

```ts
interface ProvConfig {
  apps?: {
    web?:     { url: string };
    android?: { packageName: string };
    ios?:     { bundleId: string };
  };
  platforms?:  Array<"web" | "android" | "ios">;
  flowDir?:    string;
  reporters?:  string[];
  defaults?: {
    waitTimeout?:   number;
    pollInterval?:  number;
    settleTimeout?: number;
    retries?:       number;
  };
  artifacts?: {
    outputDir?:        string;
    captureOnFailure?: boolean;
    captureOnSuccess?: boolean;
    screenshot?:       boolean;
    uiHierarchy?:      boolean;
  };
  hooks?: {
    beforeAll?:  (ctx: HookContext) => Promise<void>;
    beforeEach?: (ctx: HookContext) => Promise<void>;
    afterEach?:  (ctx: HookContext) => Promise<void>;
    afterAll?:   (ctx: HookContext) => Promise<void>;
  };
}
```

## CLI flags

| Command | Key flags |
|---|---|
| `prov test [path]` | `--platform`, `--tag`, `--grep`, `--reporter`, `--config` |
| `prov hierarchy` | `--platform`, `--pretty` |
| `prov selectors` | `--platform`, `--pretty` |
| `prov validate [path]` | — |
| `prov devices` | — |
| `prov version` | — |
