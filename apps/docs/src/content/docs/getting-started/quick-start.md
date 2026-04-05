---
title: Quick Start
description: Install prov, configure it, and run your first flow.
---

## 1. Install

```bash
bun add prov
```

prov requires [Bun](https://bun.sh) as the runtime.

## 2. Create a config file

Create `prov.config.ts` at the root of your project:

```ts
import { defineConfig } from "prov";

export default defineConfig({
  apps: {
    web: { url: "http://localhost:3000" },
    android: { packageName: "com.example.app" },
    ios: { bundleId: "com.example.app" },
  },
  platforms: ["web"],
});
```

Start with `platforms: ["web"]` while getting familiar with the framework, then add `"android"` and `"ios"` once your device targets are set up.

## 3. Write a flow

Create `flows/login.ts`:

```ts
import { flow } from "prov";

export default flow("user can log in", async ({ app, expect }) => {
  await app.tap({ testID: "email-input" });
  await app.inputText("user@example.com");
  await app.tap({ testID: "password-input" });
  await app.inputText("secret");
  await app.tap({ testID: "login-button" });
  await expect({ testID: "home-screen" }).toBeVisible();
});
```

The `testID` selector maps to `data-testid` on web, `accessibilityIdentifier` on iOS, and `resource-id` on Android. It is the preferred selector type.

## 4. Run

```bash
prov test
```

This discovers all `*.ts` files under `./flows` (or the `flowDir` in your config) and runs them against the configured platforms.

### Run a single file

```bash
prov test flows/login.ts
```

### Target a specific platform

```bash
prov test --platform android
```

### Filter by tag

```bash
prov test --tag smoke
```

## 5. View results

By default, results print to the console. To get structured JSON output:

```bash
prov test --reporter json
```

On failure, prov captures a screenshot and UI hierarchy dump under `.prov/artifacts/` (configurable via `artifacts.outputDir`).

## Next steps

- [Configuration](/prov/getting-started/configuration/) — all `defineConfig` options
- [Flows](/prov/writing-tests/flows/) — `flow()` API, tags, timeouts
- [Selectors](/prov/writing-tests/selectors/) — all selector types
- [CLI Commands](/prov/cli/commands/) — all flags
