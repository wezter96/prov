# Phase 3: Config Hooks & Port Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invoke config lifecycle hooks (`beforeAll`/`beforeEach`/`afterEach`/`afterAll`) and replace random port allocation with deterministic tracking plus per-session cleanup.

**Architecture:** Hooks are plumbed through EngineConfig and called in orchestrator (beforeAll/afterAll) and engine (beforeEach/afterEach). Port allocator is a simple module-level Set that tracks used ports. UIA2 installer switches from `forward --remove-all` to per-port removal.

**Tech Stack:** TypeScript, Effect, Bun test runner

---

## File Structure

| File                                    | Responsibility                                                 |
| --------------------------------------- | -------------------------------------------------------------- |
| `src/core/orchestrator.ts`              | Call beforeAll/afterAll around platform flow execution         |
| `src/core/engine.ts`                    | Call beforeEach/afterEach around individual flow, accept hooks |
| `src/cli/test-command.ts`               | Pass config.hooks through to engineConfig                      |
| `src/core/port-allocator.ts`            | New — deterministic port allocation with tracking              |
| `src/drivers/uiautomator2/installer.ts` | Use allocator, per-port cleanup, return cleanup fn             |
| `src/drivers/wda/installer.ts`          | Use allocator for simulator port                               |
| `src/agent/session.ts`                  | Use allocator for port selection                               |

---

### Task 1: Add hooks to EngineConfig and pass from test-command

**Files:**

- Modify: `packages/spana/src/core/engine.ts`
- Modify: `packages/spana/src/core/orchestrator.ts`
- Modify: `packages/spana/src/cli/test-command.ts`

- [ ] **Step 1: Add hooks type to EngineConfig**

In `packages/spana/src/core/engine.ts`, add import:

```typescript
import type { ProvConfig } from "../schemas/config.js";
```

Add to `EngineConfig` interface (after `launchOptions`):

```typescript
  hooks?: ProvConfig["hooks"];
```

- [ ] **Step 2: Add hooks to PlatformConfig**

In `packages/spana/src/core/orchestrator.ts`, the `PlatformConfig` interface already contains `engineConfig: EngineConfig` which will carry hooks. No separate field needed — hooks live in engineConfig.

- [ ] **Step 3: Pass config.hooks in test-command.ts**

In `packages/spana/src/cli/test-command.ts`, add `hooks: config.hooks` to every `engineConfig` construction (there are 5 sites: web, android, iOS targeted simulator, iOS physical device, iOS simulator fallback).

- [ ] **Step 4: Run tests**

Run: `cd packages/spana && bun test src/core/engine.test.ts src/core/orchestrator.test.ts src/cli/test-command.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/spana/src/core/engine.ts packages/spana/src/core/orchestrator.ts packages/spana/src/cli/test-command.ts
git commit -m "feat: add hooks to EngineConfig and pass from test-command"
```

---

### Task 2: Invoke beforeEach/afterEach in engine

**Files:**

- Modify: `packages/spana/src/core/engine.ts`
- Test: `packages/spana/src/core/engine.test.ts`

- [ ] **Step 1: Write failing test for beforeEach/afterEach**

Add to `engine.test.ts`:

```typescript
test("calls beforeEach and afterEach hooks", async () => {
  const calls: string[] = [];
  const hooks = {
    beforeEach: async () => {
      calls.push("beforeEach");
    },
    afterEach: async () => {
      calls.push("afterEach");
    },
  };

  // Use existing test helpers to create a flow and driver mock
  const flow = createFlow("hook-test", async () => {
    calls.push("flow");
  });
  const driver = createMockDriver();
  const config = createEngineConfig({ hooks });

  await executeFlow(flow, driver, config);

  expect(calls).toEqual(["beforeEach", "flow", "afterEach"]);
});

test("afterEach runs even when flow fails", async () => {
  const calls: string[] = [];
  const hooks = {
    afterEach: async () => {
      calls.push("afterEach");
    },
  };

  const flow = createFlow("failing-hook-test", async () => {
    throw new Error("boom");
  });
  const driver = createMockDriver();
  const config = createEngineConfig({ hooks });

  const result = await executeFlow(flow, driver, config);

  expect(result.status).toBe("failed");
  expect(calls).toEqual(["afterEach"]);
});

test("beforeEach failure skips flow and marks as failed", async () => {
  const calls: string[] = [];
  const hooks = {
    beforeEach: async () => {
      throw new Error("setup failed");
    },
  };

  const flow = createFlow("skipped-test", async () => {
    calls.push("flow");
  });
  const driver = createMockDriver();
  const config = createEngineConfig({ hooks });

  const result = await executeFlow(flow, driver, config);

  expect(result.status).toBe("failed");
  expect(result.error?.message).toContain("setup failed");
  expect(calls).toEqual([]); // flow never ran
});
```

Note: Adapt test helpers (`createFlow`, `createMockDriver`, `createEngineConfig`) to match existing patterns in `engine.test.ts`. The key is that `createEngineConfig` needs to accept `hooks`.

- [ ] **Step 2: Implement hooks in executeFlow**

In `packages/spana/src/core/engine.ts`, wrap the try/catch in `executeFlow`:

After `const flowCtx` (line 49), before the try block (line 51), add:

```typescript
// Call beforeEach hook
if (config.hooks?.beforeEach) {
  try {
    await config.hooks.beforeEach({ app, platform } as any);
  } catch (error) {
    return {
      name: flow.name,
      platform,
      status: "failed" as const,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
```

After the existing try/catch block (after the catch block that returns failed result), add:

```typescript
// This won't work as-is because we need afterEach to run in both paths.
```

Actually, restructure: use a `finally`-like pattern. The cleanest approach:

```typescript
  let result: TestResult;

  // beforeEach
  if (config.hooks?.beforeEach) {
    try {
      await config.hooks.beforeEach({ app, platform } as any);
    } catch (error) {
      return {
        name: flow.name,
        platform,
        status: "failed",
        durationMs: Date.now() - start,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  try {
    // ... existing autoLaunch + flow execution + success return
    result = { name: flow.name, platform, status: "passed", ... };
  } catch (error) {
    result = { name: flow.name, platform, status: "failed", ... };
  }

  // afterEach — always runs
  if (config.hooks?.afterEach) {
    try {
      await config.hooks.afterEach({ app, platform, result } as any);
    } catch (hookError) {
      console.warn(`afterEach hook failed: ${hookError instanceof Error ? hookError.message : hookError}`);
    }
  }

  return result;
```

- [ ] **Step 3: Run tests**

Run: `cd packages/spana && bun test src/core/engine.test.ts`

- [ ] **Step 4: Commit**

```bash
git add packages/spana/src/core/engine.ts packages/spana/src/core/engine.test.ts
git commit -m "feat: invoke beforeEach/afterEach hooks in engine"
```

---

### Task 3: Invoke beforeAll/afterAll in orchestrator

**Files:**

- Modify: `packages/spana/src/core/orchestrator.ts`
- Test: `packages/spana/src/core/orchestrator.test.ts`

- [ ] **Step 1: Write failing test for beforeAll/afterAll**

Add to `orchestrator.test.ts`:

```typescript
test("calls beforeAll and afterAll hooks", async () => {
  const calls: string[] = [];
  const hooks = {
    beforeAll: async () => {
      calls.push("beforeAll");
    },
    afterAll: async () => {
      calls.push("afterAll");
    },
  };

  const flow = createFlow("hook-orch-test", async () => {
    calls.push("flow");
  });
  const driver = createMockDriver();
  const config: PlatformConfig = {
    platform: "web",
    driver,
    engineConfig: createEngineConfig({ hooks }),
  };

  await orchestrate([flow], [config]);

  expect(calls).toEqual(["beforeAll", "flow", "afterAll"]);
});

test("beforeAll failure skips all flows on that platform", async () => {
  const calls: string[] = [];
  const hooks = {
    beforeAll: async () => {
      throw new Error("global setup failed");
    },
  };

  const flow = createFlow("skipped-orch", async () => {
    calls.push("flow");
  });
  const driver = createMockDriver();
  const config: PlatformConfig = {
    platform: "web",
    driver,
    engineConfig: createEngineConfig({ hooks }),
  };

  const result = await orchestrate([flow], [config]);

  expect(calls).toEqual([]); // no flows ran
  expect(result.failed).toBe(1);
});
```

- [ ] **Step 2: Implement hooks in orchestrate**

In `packages/spana/src/core/orchestrator.ts`, inside the `platforms.map` callback (line 35), wrap the flow loop:

After `const platformFlows = ...` (line 38-41), add beforeAll:

```typescript
// beforeAll hook
const hooks = engineConfig.hooks;
if (hooks?.beforeAll) {
  try {
    await hooks.beforeAll({ app: undefined, platform } as any);
  } catch (error) {
    // Skip all flows, mark them as failed
    for (const flow of platformFlows) {
      results.push({
        name: flow.name,
        platform,
        status: "failed",
        durationMs: 0,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
    return results;
  }
}
```

After the flow loop (after line 67), add afterAll:

```typescript
// afterAll hook
if (hooks?.afterAll) {
  try {
    await hooks.afterAll({ app: undefined, platform, summary: { results } } as any);
  } catch (hookError) {
    console.warn(
      `afterAll hook failed: ${hookError instanceof Error ? hookError.message : hookError}`,
    );
  }
}
```

Note: `app` is `undefined` in orchestrator hooks because the orchestrator doesn't own a PromiseApp. The `app` field is typed as `unknown` in HookContext, so this is fine. If users need the app in beforeAll, they'd use beforeEach instead.

- [ ] **Step 3: Run tests**

Run: `cd packages/spana && bun test src/core/orchestrator.test.ts`

- [ ] **Step 4: Commit**

```bash
git add packages/spana/src/core/orchestrator.ts packages/spana/src/core/orchestrator.test.ts
git commit -m "feat: invoke beforeAll/afterAll hooks in orchestrator"
```

---

### Task 4: Create port allocator module

**Files:**

- Create: `packages/spana/src/core/port-allocator.ts`
- Create: `packages/spana/src/core/port-allocator.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, expect, test, beforeEach } from "bun:test";
import { allocatePort, releasePort, resetAllocator } from "./port-allocator.js";

describe("port allocator", () => {
  beforeEach(() => {
    resetAllocator();
  });

  test("allocates sequential ports from base", () => {
    expect(allocatePort(8200)).toBe(8200);
    expect(allocatePort(8200)).toBe(8201);
    expect(allocatePort(8200)).toBe(8202);
  });

  test("different bases allocate independently", () => {
    expect(allocatePort(8200)).toBe(8200);
    expect(allocatePort(8100)).toBe(8100);
    expect(allocatePort(8200)).toBe(8201);
  });

  test("released ports are reused", () => {
    const p1 = allocatePort(8200);
    const p2 = allocatePort(8200);
    releasePort(p1);
    expect(allocatePort(8200)).toBe(p1);
  });

  test("skips ports already in use", () => {
    allocatePort(8200); // 8200
    allocatePort(8200); // 8201
    releasePort(8200);
    // 8200 is free, should get 8200 back
    expect(allocatePort(8200)).toBe(8200);
  });
});
```

- [ ] **Step 2: Implement port allocator**

Create `packages/spana/src/core/port-allocator.ts`:

```typescript
const allocated = new Set<number>();
const counters = new Map<number, number>();

/** Allocate a port starting from a base, incrementing to avoid collisions */
export function allocatePort(base: number): number {
  // First check if any released port at this base is available
  let port = base;
  const counter = counters.get(base) ?? 0;

  // Try from base up to base + counter, looking for a free one
  for (let i = 0; i <= counter; i++) {
    if (!allocated.has(base + i)) {
      allocated.add(base + i);
      return base + i;
    }
  }

  // All previous are taken, allocate next
  port = base + counter;
  while (allocated.has(port)) {
    port++;
  }
  allocated.add(port);
  counters.set(base, port - base + 1);
  return port;
}

/** Release a port back to the pool */
export function releasePort(port: number): void {
  allocated.delete(port);
}

/** Reset all state (for testing) */
export function resetAllocator(): void {
  allocated.clear();
  counters.clear();
}
```

- [ ] **Step 3: Run tests**

Run: `cd packages/spana && bun test src/core/port-allocator.test.ts`

- [ ] **Step 4: Commit**

```bash
git add packages/spana/src/core/port-allocator.ts packages/spana/src/core/port-allocator.test.ts
git commit -m "feat: add deterministic port allocator module"
```

---

### Task 5: Use port allocator in UIA2 installer and fix cleanup

**Files:**

- Modify: `packages/spana/src/drivers/uiautomator2/installer.ts`

- [ ] **Step 1: Replace random ports and nuclear cleanup**

In `packages/spana/src/drivers/uiautomator2/installer.ts`:

Add import:

```typescript
import { allocatePort, releasePort } from "../../core/port-allocator.js";
```

Change `setupUiAutomator2` to use allocator and return cleanup:

```typescript
export async function setupUiAutomator2(
  serial: string,
  hostPort?: number,
): Promise<{ host: string; port: number; cleanup: () => void }> {
  if (!isUiAutomator2Installed(serial)) {
    installUiAutomator2(serial);
  }

  const port = hostPort ?? allocatePort(8200);

  // Clean up only our specific port forward (not all)
  const adb = findADB();
  if (adb) {
    try {
      execSync(`${adb} -s ${serial} forward --remove tcp:${port}`, { stdio: "ignore" });
    } catch {
      /* ignore — may not exist */
    }
  }

  startUiAutomator2Server(serial);
  await new Promise((r) => setTimeout(r, 2000));

  const devicePort = 6790;
  adbForward(serial, port, devicePort);

  // Poll until ready
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/status`);
      if (res.ok) {
        console.log(`UiAutomator2 server ready on port ${port}`);
        const cleanup = () => {
          try {
            if (adb)
              execSync(`${adb} -s ${serial} forward --remove tcp:${port}`, { stdio: "ignore" });
          } catch {
            /* ignore */
          }
          releasePort(port);
        };
        return { host: "localhost", port, cleanup };
      }
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  releasePort(port);
  throw new Error(`UiAutomator2 server did not start within ${maxRetries} seconds`);
}
```

- [ ] **Step 2: Run tests**

Run: `cd packages/spana && bun test src/drivers/uiautomator2/`

- [ ] **Step 3: Commit**

```bash
git add packages/spana/src/drivers/uiautomator2/installer.ts
git commit -m "feat: use port allocator in UIA2 installer, per-port cleanup"
```

---

### Task 6: Use port allocator in WDA installer and session.ts

**Files:**

- Modify: `packages/spana/src/drivers/wda/installer.ts`
- Modify: `packages/spana/src/agent/session.ts`
- Modify: `packages/spana/src/cli/test-command.ts`

- [ ] **Step 1: Use allocator in WDA installer**

In `packages/spana/src/drivers/wda/installer.ts`, add import:

```typescript
import { allocatePort, releasePort } from "../../core/port-allocator.js";
```

In `setupWDA`, change the port parameter to optional and use allocator:

```typescript
export async function setupWDA(
  simulatorUDID: string,
  port?: number,
): Promise<{ host: string; port: number; cleanup: () => void }>;
```

Use `const actualPort = port ?? allocatePort(8100);` and return cleanup that calls `releasePort(actualPort)`.

Do the same for `setupWDAForDevice` — it already returns cleanup, just add `releasePort` to it.

- [ ] **Step 2: Use allocator in session.ts**

In `packages/spana/src/agent/session.ts`, add import:

```typescript
import { allocatePort } from "../core/port-allocator.js";
```

Replace `8200 + Math.floor(Math.random() * 100)` with `allocatePort(8200)` for Android (line 252).
Replace `8100 + Math.floor(Math.random() * 100)` with `allocatePort(8100)` for iOS (line 279).

- [ ] **Step 3: Use allocator in test-command.ts**

Replace all `Math.floor(Math.random() * 100)` port allocations with `allocatePort()`. Add cleanup calls to the teardown section.

In test-command.ts, add import:

```typescript
import { allocatePort } from "../core/port-allocator.js";
```

Replace each `8200 + Math.floor(Math.random() * 100)` with `allocatePort(8200)`.
Replace each `8100 + Math.floor(Math.random() * 100)` with `allocatePort(8100)`.

In the teardown section (around line 420), call cleanup for each platform config that has it.

- [ ] **Step 4: Run tests**

Run: `cd packages/spana && bun test`

- [ ] **Step 5: Commit**

```bash
git add packages/spana/src/drivers/wda/installer.ts packages/spana/src/agent/session.ts packages/spana/src/cli/test-command.ts
git commit -m "feat: use port allocator everywhere, replace random port allocation"
```

---

### Task 7: Update roadmap and run full test suite

- [ ] **Step 1: Update ROADMAP.md**

Mark hooks, port isolation, and auto-start as done in Phase 3.

- [ ] **Step 2: Run full test suite**

Run: `cd packages/spana && bun test`

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit 2>&1 | grep "error TS"`

- [ ] **Step 4: Commit and push**

```bash
git add ROADMAP.md && git commit -m "docs: mark Phase 3 structural reliability items as done"
git push origin main
```
