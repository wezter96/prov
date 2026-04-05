---
title: Assertions
description: The expect() API — toBeVisible, toBeHidden, toHaveText, and auto-wait behavior.
---

Assertions are made with the `expect` function from `FlowContext`. It takes a selector and returns a `PromiseExpectation` with chainable assertion methods.

```ts
const { expect } = ctx;

await expect({ testID: "welcome-banner" }).toBeVisible();
```

## API

### `expect(selector)`

```ts
expect: (selector: Selector) => PromiseExpectation
```

Returns a `PromiseExpectation` bound to the given selector.

### `toBeVisible(opts?)`

```ts
toBeVisible(opts?: WaitOptions): Promise<void>
```

Asserts that the element matching the selector is present in the hierarchy and visible. Polls until the element appears or `timeout` is reached.

```ts
await expect({ testID: "success-message" }).toBeVisible();
await expect({ text: "Welcome" }).toBeVisible({ timeout: 8000 });
```

### `toBeHidden(opts?)`

```ts
toBeHidden(opts?: WaitOptions): Promise<void>
```

Asserts that the element is not present or not visible. Polls until the element disappears or `timeout` is reached.

```ts
await expect({ testID: "loading-spinner" }).toBeHidden();
```

### `toHaveText(expected, opts?)`

```ts
toHaveText(expected: string, opts?: WaitOptions): Promise<void>
```

Asserts that the element's text content matches `expected`. Supports partial matching.

```ts
await expect({ testID: "user-greeting" }).toHaveText("Hello, Alice");
```

## Auto-wait behavior

All assertions auto-wait. prov does not require manual `sleep()` calls. The assertion loop works as follows:

1. Dump the element hierarchy from the platform driver.
2. Search the tree for the selector.
3. Check the assertion condition (visible / hidden / text match).
4. If the condition is not met, wait `pollInterval` ms and retry.
5. If `timeout` is exceeded, fail with a descriptive error including the selector and last known state.

The element must remain in the matched state for `settleTimeout` ms before the assertion resolves. This prevents flaky passes on transitioning UI.

## Timeout configuration

Timeouts are resolved in this order (highest priority first):

1. `opts.timeout` passed directly to the assertion method
2. `FlowConfig.timeout` on the containing flow
3. `defaults.waitTimeout` in `prov.config.ts`
4. Built-in default: 5000 ms

```ts
// Global default in config
export default defineConfig({
  defaults: { waitTimeout: 8000 },
});

// Per-flow override
export default flow(
  "slow screen test",
  { timeout: 20000 },
  async ({ expect }) => {
    // Per-assertion override
    await expect({ testID: "result" }).toBeVisible({ timeout: 15000 });
  }
);
```
