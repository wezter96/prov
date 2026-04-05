---
title: Flows
description: The flow() API — defining, configuring, and exporting test flows.
---

A flow is the basic unit of a prov test. Each flow file exports a single `FlowDefinition` as its default export.

## Defining a flow

`flow()` has two overloads:

```ts
// Without config
flow(name: string, fn: FlowFn): FlowDefinition

// With config
flow(name: string, config: FlowConfig, fn: FlowFn): FlowDefinition
```

### Basic flow

```ts
import { flow } from "prov";

export default flow("user can log in", async ({ app, expect }) => {
  await app.tap({ testID: "email-input" });
  await app.inputText("user@example.com");
  await app.tap({ testID: "login-button" });
  await expect({ testID: "home-screen" }).toBeVisible();
});
```

### Flow with config

```ts
export default flow(
  "checkout flow",
  {
    tags: ["smoke", "payments"],
    platforms: ["android", "ios"],
    timeout: 60000,
    autoLaunch: true,
  },
  async ({ app, expect, platform }) => {
    // ...
  }
);
```

## FlowContext

The function receives a `FlowContext` object:

```ts
interface FlowContext {
  app:      PromiseApp;
  expect:   (selector: Selector) => PromiseExpectation;
  platform: Platform;
}
```

| Property | Type | Description |
|---|---|---|
| `app` | `PromiseApp` | App interaction API — tap, type, scroll, launch, etc. |
| `expect` | `(selector) => PromiseExpectation` | Assertion API — `toBeVisible`, `toBeHidden`, `toHaveText` |
| `platform` | `"web" \| "android" \| "ios"` | The platform this run is executing on |

## FlowConfig

```ts
interface FlowConfig {
  tags?:       string[];
  platforms?:  Platform[];
  timeout?:    number;
  autoLaunch?: boolean;
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `tags` | `string[]` | — | Tag strings for `--tag` filtering at the CLI |
| `platforms` | `Platform[]` | all configured | Restrict this flow to specific platforms only |
| `timeout` | `number` | config default | Flow-level timeout in milliseconds |
| `autoLaunch` | `boolean` | `true` | Automatically launch the app before the flow starts |

## The `app` API

All methods return `Promise<void>` unless noted.

### Interaction

| Method | Signature | Description |
|---|---|---|
| `tap` | `(selector, opts?) => Promise<void>` | Tap an element |
| `tapXY` | `(x, y) => Promise<void>` | Tap at absolute coordinates |
| `doubleTap` | `(selector, opts?) => Promise<void>` | Double-tap an element |
| `longPress` | `(selector, opts?) => Promise<void>` | Long-press an element |
| `longPressXY` | `(x, y, opts?) => Promise<void>` | Long-press at coordinates |
| `inputText` | `(text) => Promise<void>` | Type text into the focused element |
| `pressKey` | `(key) => Promise<void>` | Press a named key |
| `hideKeyboard` | `() => Promise<void>` | Dismiss the software keyboard |
| `swipe` | `(direction, opts?) => Promise<void>` | Swipe in a direction |
| `scroll` | `(direction) => Promise<void>` | Scroll in a direction |

Direction values: `"up" | "down" | "left" | "right"`

### App lifecycle

| Method | Signature | Description |
|---|---|---|
| `launch` | `(opts?) => Promise<void>` | Launch the app (optionally with a deep link) |
| `stop` | `() => Promise<void>` | Stop the app |
| `kill` | `() => Promise<void>` | Force-kill the app |
| `clearState` | `() => Promise<void>` | Clear app data/state |
| `openLink` | `(url) => Promise<void>` | Open a URL or deep link |
| `back` | `() => Promise<void>` | Press the back button (Android) |

### Utilities

| Method | Signature | Description |
|---|---|---|
| `takeScreenshot` | `() => Promise<Uint8Array>` | Capture a screenshot and return the bytes |

## Settings export

You can export named `settings` from a flow file to apply shared config to all flows in that file:

```ts
export const settings = {
  tags: ["smoke"],
  timeout: 30000,
};

export default flow("my flow", async ({ app }) => {
  // ...
});
```

Per-flow `FlowConfig` values take precedence over `settings`.
