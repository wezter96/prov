import { describe, test, expect, mock } from "bun:test";
import { Effect } from "effect";
import { DriverError } from "../errors.js";
import type { RawDriverService } from "../drivers/raw-driver.js";
import { createPromiseApp } from "./app.js";

function mockDriver(overrides: Partial<RawDriverService> = {}): RawDriverService {
  const noop = () => Effect.void;
  return {
    dumpHierarchy: () => Effect.succeed("{}"),
    tapAtCoordinate: noop,
    doubleTapAtCoordinate: noop,
    longPressAtCoordinate: noop,
    swipe: noop,
    inputText: noop,
    pressKey: noop,
    hideKeyboard: noop,
    takeScreenshot: () => Effect.succeed(new Uint8Array()),
    getDeviceInfo: () =>
      Effect.succeed({
        platform: "web" as const,
        deviceId: "test",
        name: "Test",
        isEmulator: false,
        screenWidth: 1280,
        screenHeight: 720,
        driverType: "playwright" as const,
      }),
    launchApp: noop,
    stopApp: noop,
    killApp: noop,
    clearAppState: noop,
    openLink: noop,
    back: noop,
    evaluate: () => Effect.void as any,
    ...overrides,
  } as RawDriverService;
}

const dummyConfig = {
  parse: () => ({
    elementType: "div",
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    visible: true,
    enabled: true,
    children: [],
  }),
  defaults: {},
};

describe("app.evaluate()", () => {
  test("calls driver.evaluate with function", async () => {
    const evaluateFn = mock(() => Effect.succeed("hello"));
    const driver = mockDriver({ evaluate: evaluateFn as any });
    const app = createPromiseApp(driver, "test", dummyConfig);

    await app.evaluate(() => "hello");
    expect(evaluateFn).toHaveBeenCalled();
  });

  test("calls driver.evaluate with string", async () => {
    const evaluateFn = mock(() => Effect.succeed(42));
    const driver = mockDriver({ evaluate: evaluateFn as any });
    const app = createPromiseApp(driver, "test", dummyConfig);

    await app.evaluate("1 + 1");
    expect(evaluateFn).toHaveBeenCalled();
  });

  test("passes arguments through", async () => {
    let capturedArgs: unknown[] = [];
    const evaluateFn = (...args: unknown[]) => {
      capturedArgs = args;
      return Effect.succeed(10);
    };
    const driver = mockDriver({ evaluate: evaluateFn as any });
    const app = createPromiseApp(driver, "test", dummyConfig);

    await app.evaluate((x: number) => x * 2, 5);
    expect(capturedArgs[1]).toBe(5);
  });

  test("propagates errors from driver", async () => {
    const driver = mockDriver({
      evaluate: () =>
        Effect.fail(
          new DriverError({ message: "evaluate() is only supported on the web platform" }),
        ),
    });
    const app = createPromiseApp(driver, "test", dummyConfig);

    await expect(app.evaluate(() => "nope")).rejects.toThrow(
      "evaluate() is only supported on the web platform",
    );
  });
});
