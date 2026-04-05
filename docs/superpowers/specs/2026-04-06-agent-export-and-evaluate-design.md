# Agent Export + JS Evaluate

**Date**: 2026-04-06
**Status**: Approved
**Scope**: Two small features — `spana-test/agent` package export and `app.evaluate()` for web JS execution.

---

## Feature 1: `spana-test/agent` Export

### Goal

Expose the existing `src/agent/` module as a package subpath export (`spana-test/agent`) and expand the Session API to near-parity with PromiseApp so external consumers (AI agents, custom test runners, programmatic integrations) can drive devices without the CLI.

### Package Changes

- Add `"./agent"` to `package.json` exports field pointing to `dist/agent/index.js` with types at `dist/agent/index.d.ts`.
- Add `"agent/index": "src/agent/index.ts"` to tsup config entry points and DTS entry.

### Session API Expansion

The current Session API only has: `connect()`, `disconnect()`, `hierarchy()`, `selectors()`, `tap(selector)`, `inputText(text)`, `screenshot()`.

Add the following methods to match PromiseApp:

| Method         | Signature                                                               |
| -------------- | ----------------------------------------------------------------------- |
| `tapXY`        | `(x: number, y: number) => Promise<void>`                               |
| `doubleTap`    | `(selector: Selector) => Promise<void>`                                 |
| `longPress`    | `(selector: Selector, opts?: { duration?: number }) => Promise<void>`   |
| `longPressXY`  | `(x: number, y: number, opts?: { duration?: number }) => Promise<void>` |
| `swipe`        | `(direction: Direction) => Promise<void>`                               |
| `scroll`       | `(direction: Direction) => Promise<void>`                               |
| `pressKey`     | `(key: string) => Promise<void>`                                        |
| `hideKeyboard` | `() => Promise<void>`                                                   |
| `openLink`     | `(url: string) => Promise<void>`                                        |
| `back`         | `() => Promise<void>`                                                   |
| `launch`       | `(opts?: { deepLink?: string }) => Promise<void>`                       |
| `stop`         | `() => Promise<void>`                                                   |
| `kill`         | `() => Promise<void>`                                                   |
| `clearState`   | `() => Promise<void>`                                                   |
| `evaluate`     | `<T>(fn: (...args: any[]) => T, ...args: any[]) => Promise<T>`          |

Existing methods (`connect`, `disconnect`, `hierarchy`, `selectors`, `tap`, `inputText`, `screenshot`) remain unchanged.

### Not in Scope

- Expectation/assertion API on Session (users use their own assertion library).
- Flow discovery or orchestration (that's the CLI's job).
- Reporter integration (Session is low-level).

---

## Feature 2: `app.evaluate()`

### Goal

Allow flow authors to execute arbitrary JavaScript in the browser context on the web platform. Useful for querying DOM state, manipulating localStorage, triggering custom events, or reading computed styles that aren't exposed through selectors.

### RawDriverService Change

Add to the `RawDriverService` interface:

```ts
readonly evaluate: <T = unknown>(
  script: string | ((...args: unknown[]) => T),
  ...args: unknown[]
) => Effect.Effect<T, DriverError>;
```

### Driver Implementations

**Playwright**: Wraps `page.evaluate(script, ...args)`. Direct passthrough.

**UiAutomator2**: Throws `DriverError` with message `"evaluate() is only supported on the web platform"`.

**WDA**: Throws `DriverError` with message `"evaluate() is only supported on the web platform"`.

### PromiseApp Addition

```ts
evaluate<T = unknown>(
  fn: ((...args: any[]) => T) | string,
  ...args: any[]
): Promise<T>
```

- Recorded as a step via `stepRecorder.runStep("evaluate", ...)`.
- The function or string is passed through to the driver.

### Usage Examples

```ts
// In a flow
flow("Check page state", async ({ app }) => {
  const title = await app.evaluate<string>(() => document.title);
  const count = await app.evaluate((x: number) => x * 2, 5);
  await app.evaluate(() => localStorage.setItem("theme", "dark"));
});
```

### Not in Scope

- Mobile WebView JS execution (Phase 4: WebView CDP support).
- Native mobile shell execution (`adb shell`, `simctl`).

---

## Testing Strategy

- Unit tests for `evaluate()` on the Playwright driver (mock page.evaluate).
- Unit tests verifying UiAutomator2 and WDA throw the expected error.
- Unit test for the expanded Session API methods (mock driver calls).
- Verify `app.evaluate()` is recorded as a step by the step recorder.

## Build Changes

- tsup: add `"agent/index"` entry point.
- package.json: add `"./agent"` export with types.
