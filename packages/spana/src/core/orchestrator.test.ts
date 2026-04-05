import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import type { FlowDefinition } from "../api/flow.js";
import type { RawDriverService } from "../drivers/raw-driver.js";
import type { DeviceInfo } from "../schemas/device.js";
import { orchestrate } from "./orchestrator.js";

function createDriver(platform: "android" | "ios"): RawDriverService {
  const deviceInfo: DeviceInfo = {
    platform,
    deviceId: `${platform}-device`,
    name: `${platform}-device`,
    isEmulator: true,
    screenWidth: 100,
    screenHeight: 200,
    driverType: platform === "android" ? "uiautomator2" : "wda",
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
  };
}

function createFlow(
  name: string,
  platforms?: Array<"android" | "ios">,
  shouldFail = false,
): FlowDefinition {
  return {
    name,
    config: platforms ? { platforms } : {},
    fn: async ({ app }) => {
      if (shouldFail) {
        throw new Error(`${name} failed`);
      }
      await app.inputText(name);
    },
  };
}

describe("orchestrate", () => {
  test("filters flows per platform and aggregates pass and fail counts", async () => {
    const result = await orchestrate(
      [
        createFlow("shared"),
        createFlow("android-only", ["android"]),
        createFlow("ios-only", ["ios"]),
        createFlow("fail-both", ["android", "ios"], true),
      ],
      [
        {
          platform: "android",
          driver: createDriver("android"),
          engineConfig: {
            appId: "com.example.android",
            platform: "android",
            autoLaunch: false,
            coordinatorConfig: {
              parse: () => ({ bounds: { x: 0, y: 0, width: 1, height: 1 }, children: [] }),
            },
          },
        },
        {
          platform: "ios",
          driver: createDriver("ios"),
          engineConfig: {
            appId: "com.example.ios",
            platform: "ios",
            autoLaunch: false,
            coordinatorConfig: {
              parse: () => ({ bounds: { x: 0, y: 0, width: 1, height: 1 }, children: [] }),
            },
          },
        },
      ],
    );

    expect(result.results).toHaveLength(6);
    expect(result.passed).toBe(4);
    expect(result.failed).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.results.map((entry) => `${entry.platform}:${entry.name}`).sort()).toEqual([
      "android:android-only",
      "android:fail-both",
      "android:shared",
      "ios:fail-both",
      "ios:ios-only",
      "ios:shared",
    ]);
  });
});
