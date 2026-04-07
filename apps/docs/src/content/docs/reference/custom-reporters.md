---
title: Custom Reporters
description: Write your own reporter to extend spana's output pipeline.
---

spana's reporter API lets you hook into the test lifecycle and process results however you need — post to Slack, push metrics to Datadog, write custom file formats, or integrate with internal dashboards.

## The Reporter interface

A reporter is an object with optional lifecycle hooks:

```ts
import type { Reporter, FlowResult, RunSummary } from "spana";

const myReporter: Reporter = {
  onFlowStart(name, platform, workerName) {
    // Called when a flow begins execution
  },

  onFlowPass(result: FlowResult) {
    // Called when a flow passes
  },

  onFlowFail(result: FlowResult) {
    // Called when a flow fails (after all retries)
  },

  onRunComplete(summary: RunSummary) {
    // Called once after all flows finish
  },
};

export default myReporter;
```

All hooks except `onRunComplete` are optional.

## Registering a custom reporter

Add the module path to your `reporters` array in `spana.config.ts`:

```ts
import { defineConfig } from "spana";

export default defineConfig({
  reporters: [
    "console", // built-in
    "./reporters/slack.ts", // your custom reporter
  ],
});
```

Paths are resolved relative to your config file. Absolute paths also work.

## Factory pattern

If your reporter needs configuration, export a factory function instead of a plain object:

```ts
import type { Reporter } from "spana";

export default function createSlackReporter(options: { outputDir: string }): Reporter {
  return {
    onFlowFail(result) {
      // Post to Slack webhook
    },
    onRunComplete(summary) {
      console.log(`Results saved to ${options.outputDir}`);
    },
  };
}
```

spana calls factory functions with `{ outputDir }` automatically.

## Available types

Import these from `"spana"` for full type safety:

| Type              | Description                                                                           |
| ----------------- | ------------------------------------------------------------------------------------- |
| `Reporter`        | The reporter interface                                                                |
| `FlowResult`      | Result of a single flow (name, platform, status, duration, error, steps, attachments) |
| `RunSummary`      | Aggregate summary (total, passed, failed, skipped, flaky, duration, all results)      |
| `StepResult`      | Individual step within a flow (command, selector, status, duration)                   |
| `FlowError`       | Error details with category and suggestion                                            |
| `FailureCategory` | Error classification (element-not-found, timeout, etc.)                               |
| `Attachment`      | Screenshot or artifact reference (name, contentType, path)                            |
| `Platform`        | `"web" \| "android" \| "ios"`                                                         |

## Example: Webhook reporter

A minimal reporter that posts failures to an HTTP webhook:

```ts
import type { Reporter, FlowResult } from "spana";

const webhookReporter: Reporter = {
  async onFlowFail(result: FlowResult) {
    await fetch("https://hooks.example.com/test-failures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: result.name,
        platform: result.platform,
        error: result.error?.message,
        duration: result.durationMs,
      }),
    });
  },

  onRunComplete(summary) {
    // Optional: post summary
  },
};

export default webhookReporter;
```

## Example: CSV reporter

```ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Reporter } from "spana";

export default function createCsvReporter(options: { outputDir: string }): Reporter {
  return {
    onRunComplete(summary) {
      const header = "name,platform,status,durationMs,error\n";
      const rows = summary.results
        .map((r) => `${r.name},${r.platform},${r.status},${r.durationMs},${r.error?.message ?? ""}`)
        .join("\n");
      writeFileSync(join(options.outputDir, "results.csv"), header + rows);
    },
  };
}
```
