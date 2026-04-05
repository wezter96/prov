---
title: Platform-Specific Tests
description: Writing platform-aware tests using the platform context value and FlowConfig.platforms.
---

prov runs a single flow file against multiple platforms. There are two mechanisms for platform-specific behavior: branching inside a flow, and restricting a flow to specific platforms entirely.

## Branching inside a flow

The `platform` value in `FlowContext` is `"web" | "android" | "ios"`. Use it for conditional logic within a flow that is mostly shared across platforms.

```ts
import { flow } from "prov";

export default flow("user can share content", async ({ app, expect, platform }) => {
  await app.tap({ testID: "share-button" });

  if (platform === "ios") {
    // iOS share sheet uses a native action sheet
    await expect({ text: "Copy Link" }).toBeVisible();
    await app.tap({ text: "Copy Link" });
  } else if (platform === "android") {
    // Android uses the system share dialog
    await expect({ text: "Copy to clipboard" }).toBeVisible();
    await app.tap({ text: "Copy to clipboard" });
  } else {
    // Web uses a custom share modal
    await expect({ testID: "share-modal" }).toBeVisible();
    await app.tap({ testID: "copy-link" });
  }

  await expect({ testID: "share-confirmation" }).toBeVisible();
});
```

## Restricting a flow to specific platforms

Use `FlowConfig.platforms` to prevent a flow from running on platforms where it does not apply.

```ts
import { flow } from "prov";

export default flow(
  "push notification permissions",
  { platforms: ["android", "ios"] },
  async ({ app, expect }) => {
    await app.tap({ testID: "enable-notifications" });
    await expect({ testID: "permission-granted" }).toBeVisible();
  }
);
```

This flow is skipped entirely when the runner targets `web`.

## CLI platform filtering

Regardless of per-flow `platforms` config, you can also filter at the CLI:

```bash
# Run only on web
prov test --platform web

# Run on android and ios only
prov test --platform android,ios
```

CLI filtering takes effect before per-flow filtering. A flow with `platforms: ["android"]` will not run if you pass `--platform web`, even if both are in your config.

## Common patterns

### Platform-specific selectors

Some elements have the same semantic purpose but different identifiers across platforms. Assign the selector based on platform:

```ts
export default flow("open menu", async ({ app, platform }) => {
  const menuSelector =
    platform === "ios"
      ? { accessibilityLabel: "Main menu" }
      : { testID: "menu-button" };

  await app.tap(menuSelector);
});
```

### Skip web for native-only features

```ts
export default flow(
  "biometric authentication",
  { platforms: ["ios", "android"] },
  async ({ app, expect }) => {
    await app.tap({ testID: "use-biometrics" });
    await expect({ testID: "biometric-success" }).toBeVisible({ timeout: 10000 });
  }
);
```

### Deep link only on mobile

```ts
export default flow("deep link navigation", async ({ app, platform }) => {
  if (platform !== "web") {
    await app.openLink("myapp://profile/settings");
  } else {
    await app.tap({ testID: "settings-nav" });
  }
  await expect({ testID: "settings-screen" }).toBeVisible();
});
```
