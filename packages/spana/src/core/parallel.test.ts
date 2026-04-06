import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import type { FlowDefinition } from "../api/flow.js";
import type { RawDriverService } from "../drivers/raw-driver.js";
import type { DeviceInfo } from "../schemas/device.js";
import { runParallel } from "./parallel.js";

function createDriver(label: string): RawDriverService {
  const deviceInfo: DeviceInfo = {
    platform: "android",
    deviceId: label,
    name: label,
    isEmulator: true,
    screenWidth: 100,
    screenHeight: 200,
    driverType: "uiautomator2",
  };

  return {
    dumpHierarchy: () => Effect.succeed("{}"),
    tapAtCoordinate: () => Effect.void,
    doubleTapAtCoordinate: () => Effect.void,
    longPressAtCoordinate: () => Effect.void,
    swipe: () => Effect.void,
    inputText: () => Effect.void,
    pressKey: () => Effect.void,
    hideKeyboard: () => Effect.void,
    takeScreenshot: () => Effect.succeed(new Uint8Array()),
    getDeviceInfo: () => Effect.succeed(deviceInfo),
    launchApp: () => Effect.void,
    stopApp: () => Effect.void,
    killApp: () => Effect.void,
    clearAppState: () => Effect.void,
    openLink: () => Effect.void,
    back: () => Effect.void,
    evaluate: () => Effect.void as any,
  };
}

function createFlow(name: string, shouldFail = false): FlowDefinition {
  return {
    name,
    config: {},
    fn: async ({ app }) => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (shouldFail) {
        throw new Error(`${name} failed`);
      }
      await app.inputText(name);
    },
  };
}

describe("runParallel", () => {
  test("distributes flows across workers and aggregates results", async () => {
    const completed: Array<{ flow: string; workerName: string }> = [];

    const result = await runParallel({
      workers: [
        {
          id: "worker-a",
          name: "Pixel 8",
          driver: createDriver("worker-a"),
          engineConfig: {
            appId: "com.example.app",
            platform: "android",
            autoLaunch: false,
            coordinatorConfig: {
              parse: () => ({ bounds: { x: 0, y: 0, width: 1, height: 1 }, children: [] }),
            },
          },
        },
        {
          id: "worker-b",
          name: "iPhone 15",
          driver: createDriver("worker-b"),
          engineConfig: {
            appId: "com.example.app",
            platform: "android",
            autoLaunch: false,
            coordinatorConfig: {
              parse: () => ({ bounds: { x: 0, y: 0, width: 1, height: 1 }, children: [] }),
            },
          },
        },
      ],
      flows: [
        createFlow("alpha"),
        createFlow("beta"),
        createFlow("gamma-fail", true),
        createFlow("delta"),
      ],
      onFlowComplete: (flowResult, workerName) => {
        completed.push({ flow: flowResult.name, workerName });
      },
    });

    expect(result.results).toHaveLength(4);
    expect(result.passed).toBe(3);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(completed).toHaveLength(4);
    expect(new Set(completed.map((entry) => entry.workerName))).toEqual(
      new Set(["Pixel 8", "iPhone 15"]),
    );

    const workerA = result.workerStats.get("worker-a");
    const workerB = result.workerStats.get("worker-b");

    expect((workerA?.flowCount ?? 0) + (workerB?.flowCount ?? 0)).toBe(4);
    expect(workerA?.flowCount).toBeGreaterThan(0);
    expect(workerB?.flowCount).toBeGreaterThan(0);
  });
});
