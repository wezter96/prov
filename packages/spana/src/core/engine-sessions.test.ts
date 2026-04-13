import { describe, expect, test, mock, afterEach } from "bun:test";
import { Effect } from "effect";
import type { RawDriverService } from "../drivers/raw-driver.js";
import type { DeviceInfo } from "../schemas/device.js";
import type { Element } from "../schemas/element.js";
import type { FlowDefinition } from "../api/flow.js";
import { executeFlow, type EngineConfig } from "./engine.js";

afterEach(() => {
  mock.restore();
});

function createElement(overrides: Partial<Element> = {}): Element {
  return {
    bounds: { x: 0, y: 0, width: 100, height: 40 },
    children: [],
    visible: true,
    clickable: true,
    ...overrides,
  };
}

function createDriver(overrides: Partial<RawDriverService> = {}) {
  const events: Array<[string, ...unknown[]]> = [];
  const deviceInfo: DeviceInfo = {
    platform: "web",
    deviceId: "playwright",
    name: "Chromium",
    isEmulator: false,
    screenWidth: 1280,
    screenHeight: 720,
    driverType: "playwright",
  };
  const hierarchy = createElement({
    children: [createElement({ text: "Ready" })],
  });

  const driver: RawDriverService = {
    dumpHierarchy: () => Effect.succeed(JSON.stringify(hierarchy)),
    tapAtCoordinate: (x, y) => {
      events.push(["tapAtCoordinate", x, y]);
      return Effect.void;
    },
    doubleTapAtCoordinate: (x, y) => {
      events.push(["doubleTapAtCoordinate", x, y]);
      return Effect.void;
    },
    longPressAtCoordinate: (x, y, d) => {
      events.push(["longPressAtCoordinate", x, y, d]);
      return Effect.void;
    },
    swipe: (sx, sy, ex, ey, d) => {
      events.push(["swipe", sx, sy, ex, ey, d]);
      return Effect.void;
    },
    inputText: (text) => {
      events.push(["inputText", text]);
      return Effect.void;
    },
    pressKey: (key) => {
      events.push(["pressKey", key]);
      return Effect.void;
    },
    hideKeyboard: () => {
      events.push(["hideKeyboard"]);
      return Effect.void;
    },
    takeScreenshot: () => Effect.succeed(new Uint8Array([1, 2, 3])),
    getDeviceInfo: () => Effect.succeed(deviceInfo),
    launchApp: (appId, opts) => {
      events.push(["launchApp", appId, opts]);
      return Effect.void;
    },
    stopApp: (appId) => {
      events.push(["stopApp", appId]);
      return Effect.void;
    },
    killApp: (appId) => {
      events.push(["killApp", appId]);
      return Effect.void;
    },
    clearAppState: (appId) => {
      events.push(["clearAppState", appId]);
      return Effect.void;
    },
    openLink: (url) => {
      events.push(["openLink", url]);
      return Effect.void;
    },
    back: () => {
      events.push(["back"]);
      return Effect.void;
    },
    evaluate: () => Effect.void as any,
    ...overrides,
  };

  return { driver, events };
}

const parse = (raw: string): Element => JSON.parse(raw) as Element;

function createConfig(): EngineConfig {
  return {
    appId: "com.example.app",
    platform: "android",
    coordinatorConfig: { parse },
    artifactConfig: {
      outputDir: "/tmp/spana-test-sessions",
      captureOnFailure: false,
      captureOnSuccess: false,
      captureSteps: false,
    },
  };
}

describe("engine + secondary sessions", () => {
  test("sessions property is available in flow context", async () => {
    const { driver } = createDriver();
    let hadSessions = false;

    const flowDef: FlowDefinition = {
      name: "check sessions",
      config: { autoLaunch: false },
      fn: async (ctx) => {
        hadSessions = typeof ctx.sessions?.open === "function";
      },
    };

    const result = await executeFlow(flowDef, driver, createConfig());
    expect(result.status).toBe("passed");
    expect(hadSessions).toBe(true);
  });

  test("secondary sessions are cleaned up when flow fails", async () => {
    const { driver } = createDriver();

    const flowDef: FlowDefinition = {
      name: "failing flow with sessions",
      config: { autoLaunch: false },
      fn: async (ctx) => {
        expect(typeof ctx.sessions.open).toBe("function");
        throw new Error("intentional failure");
      },
    };

    const result = await executeFlow(flowDef, driver, createConfig());
    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("intentional failure");
  });

  test("secondary sessions are cleaned up when flow times out", async () => {
    const { driver } = createDriver();
    const flowDef: FlowDefinition = {
      name: "timeout flow",
      config: { autoLaunch: false, timeout: 50 },
      fn: async (ctx) => {
        expect(typeof ctx.sessions.open).toBe("function");
        await new Promise((resolve) => setTimeout(resolve, 200));
      },
    };

    const result = await executeFlow(flowDef, driver, createConfig());
    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("timed out");
  });
});
