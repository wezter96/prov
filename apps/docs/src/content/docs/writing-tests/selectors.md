---
title: Selectors
description: All selector types, how to use them, and how they map across platforms.
---

A selector tells prov which element to interact with or assert on. Selectors are used by all `app` interaction methods and `expect()`.

## Selector types

### testID (recommended)

```ts
{ testID: "login-button" }
```

The preferred selector. Maps to the platform's primary element identifier:

| Platform | Attribute |
|---|---|
| Web | `data-testid` attribute |
| Android | `resource-id` (last segment matched) |
| iOS | `accessibilityIdentifier` |

Add `testID` props to your React Native components:

```tsx
<Pressable testID="login-button">Sign In</Pressable>
```

On web, this renders as `data-testid="login-button"`.

### text

```ts
{ text: "Sign In" }
```

Matches against the visible label text of an element. Partial matching is supported — the element text only needs to contain the provided string.

Use this when a `testID` is not available, such as for dynamic or third-party content.

### accessibilityLabel

```ts
{ accessibilityLabel: "Close dialog" }
```

Matches the OS-level accessibility label. Useful for elements that have a label distinct from their visible text (e.g. icon buttons).

### point

```ts
{ point: { x: 150, y: 340 } }
```

Taps at absolute screen coordinates. Use as a last resort — coordinates are device-specific and break across screen sizes.

### String shorthand

A plain string is treated as a `testID`:

```ts
await app.tap("login-button");
// equivalent to:
await app.tap({ testID: "login-button" });
```

## Combining selectors

Multiple fields can be combined. All specified fields must match the same element:

```ts
await app.tap({ testID: "item", text: "Buy Now" });
```

This narrows the match to an element that has both the correct `testID` and the correct text. Useful when multiple elements share a `testID` but have different labels.

## Selector priority

When prov builds a suggested selector (e.g. in `prov selectors` output), it uses this priority:

1. `testID` — most stable, preferred
2. `accessibilityLabel`
3. `text`
4. `point` — last resort

## WaitOptions

All selector-based methods accept an optional `WaitOptions` object to override the global defaults for that specific call:

```ts
await app.tap({ testID: "slow-element" }, { timeout: 10000 });
await expect({ testID: "result" }).toBeVisible({ timeout: 15000, pollInterval: 500 });
```

| Option | Type | Description |
|---|---|---|
| `timeout` | `number` | ms to wait before failing |
| `pollInterval` | `number` | ms between hierarchy polls |
| `settleTimeout` | `number` | ms the element must be stable before matching |
