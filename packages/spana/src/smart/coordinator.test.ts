import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import type { RawDriverService } from "../drivers/raw-driver.js";
import type { DeviceInfo } from "../schemas/device.js";
import type { Element } from "../schemas/element.js";
import { TextMismatchError } from "../errors.js";
import { createCoordinator } from "./coordinator.js";

const deviceInfo: DeviceInfo = {
  platform: "web",
  deviceId: "playwright",
  name: "Chromium",
  isEmulator: false,
  screenWidth: 1280,
  screenHeight: 720,
  driverType: "playwright",
};

function createElement(overrides: Partial<Element> = {}): Element {
  return {
    bounds: { x: 10, y: 20, width: 30, height: 40 },
    children: [],
    visible: true,
    clickable: true,
    ...overrides,
  };
}

function createDriver(hierarchies: Element[]) {
  let dumpCount = 0;
  const taps: Array<{ x: number; y: number }> = [];
  const doubleTaps: Array<{ x: number; y: number }> = [];
  const longPresses: Array<{ x: number; y: number; duration: number }> = [];
  const swipes: Array<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    duration: number;
  }> = [];

  const driver: RawDriverService = {
    dumpHierarchy: () => {
      const index = Math.min(dumpCount, hierarchies.length - 1);
      dumpCount += 1;
      return Effect.succeed(JSON.stringify(hierarchies[index]));
    },
    tapAtCoordinate: (x, y) => {
      taps.push({ x, y });
      return Effect.void;
    },
    doubleTapAtCoordinate: (x, y) => {
      doubleTaps.push({ x, y });
      return Effect.void;
    },
    longPressAtCoordinate: (x, y, duration) => {
      longPresses.push({ x, y, duration });
      return Effect.void;
    },
    swipe: (startX, startY, endX, endY, duration) => {
      swipes.push({ startX, startY, endX, endY, duration });
      return Effect.void;
    },
    inputText: () => Effect.void,
    pressKey: () => Effect.void,
    hideKeyboard: () => Effect.void,
    takeScreenshot: () => Effect.succeed(new Uint8Array([1, 2, 3])),
    getDeviceInfo: () => Effect.succeed(deviceInfo),
    launchApp: () => Effect.void,
    stopApp: () => Effect.void,
    killApp: () => Effect.void,
    clearAppState: () => Effect.void,
    openLink: () => Effect.void,
    back: () => Effect.void,
    evaluate: () => Effect.void as any,
  };

  return {
    driver,
    taps,
    doubleTaps,
    longPresses,
    swipes,
  };
}

const parse = (raw: string): Element => JSON.parse(raw) as Element;

describe("coordinator", () => {
  test("uses matched element centers for tap, double tap, and long press", async () => {
    const element = createElement({ text: "Ready" });
    const { driver, taps, doubleTaps, longPresses } = createDriver([
      createElement({ children: [element] }),
    ]);
    const coordinator = createCoordinator(driver, { parse });

    await Effect.runPromise(coordinator.tap({ text: "Ready" }));
    await Effect.runPromise(coordinator.doubleTap({ text: "Ready" }));
    await Effect.runPromise(coordinator.longPress({ text: "Ready" }));

    expect(taps).toEqual([{ x: 25, y: 40 }]);
    expect(doubleTaps).toEqual([{ x: 25, y: 40 }]);
    expect(longPresses).toEqual([{ x: 25, y: 40, duration: 1000 }]);
  });

  test("calculates swipe and scroll coordinates from screen dimensions", async () => {
    const { driver, swipes } = createDriver([createElement()]);
    const coordinator = createCoordinator(driver, {
      parse,
      screenWidth: 100,
      screenHeight: 200,
    });

    await Effect.runPromise(coordinator.swipe("left", { duration: 700 }));
    await Effect.runPromise(coordinator.scroll("up"));

    expect(swipes).toEqual([
      { startX: 70, startY: 100, endX: 30, endY: 100, duration: 700 },
      { startX: 50, startY: 130, endX: 50, endY: 70, duration: 500 },
    ]);
  });

  test("returns TextMismatchError when assertText sees a different value", async () => {
    const { driver } = createDriver([
      createElement({
        children: [createElement({ text: "Actual" })],
      }),
    ]);
    const coordinator = createCoordinator(driver, { parse });

    const result = await Effect.runPromise(
      Effect.either(coordinator.assertText({ text: "Actual" }, "Expected")),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left).toBeInstanceOf(TextMismatchError);
      expect(result.left).toMatchObject({
        expected: "Expected",
        actual: "Actual",
        selector: { text: "Actual" },
      });
    }
  });
});

/** Create a driver that counts dumpHierarchy calls */
function createCountingDriver(hierarchies: Element[]) {
  let dumpCount = 0;
  const inner = createDriver(hierarchies);
  const originalDump = inner.driver.dumpHierarchy.bind(inner.driver);

  const countingDriver: RawDriverService = {
    dumpHierarchy: () => {
      dumpCount++;
      return originalDump();
    },
    tapAtCoordinate: inner.driver.tapAtCoordinate,
    doubleTapAtCoordinate: inner.driver.doubleTapAtCoordinate,
    longPressAtCoordinate: inner.driver.longPressAtCoordinate,
    swipe: inner.driver.swipe,
    inputText: inner.driver.inputText,
    pressKey: inner.driver.pressKey,
    hideKeyboard: inner.driver.hideKeyboard,
    takeScreenshot: inner.driver.takeScreenshot,
    getDeviceInfo: inner.driver.getDeviceInfo,
    launchApp: inner.driver.launchApp,
    stopApp: inner.driver.stopApp,
    killApp: inner.driver.killApp,
    clearAppState: inner.driver.clearAppState,
    openLink: inner.driver.openLink,
    back: inner.driver.back,
    evaluate: inner.driver.evaluate,
  };

  return {
    driver: countingDriver,
    getDumpCount: () => dumpCount,
    taps: inner.taps,
    doubleTaps: inner.doubleTaps,
    longPresses: inner.longPresses,
    swipes: inner.swipes,
  };
}

describe("coordinator hierarchy cache", () => {
  test("tap followed by assertVisible dumps fresh after tap invalidation", async () => {
    const element = createElement({ text: "Button" });
    const root = createElement({ children: [element] });
    const { driver, getDumpCount } = createCountingDriver([root]);

    const coordinator = createCoordinator(driver, {
      parse,
      hierarchyCacheTtl: 10_000,
    });

    await Effect.runPromise(coordinator.tap({ text: "Button" }));
    const dumpAfterTap = getDumpCount();

    // tap invalidates cache, so assertVisible must dump fresh
    await Effect.runPromise(coordinator.assertVisible({ text: "Button" }));
    expect(getDumpCount()).toBe(dumpAfterTap + 1);
  });

  test("consecutive assertVisible calls reuse cache for first poll", async () => {
    const element = createElement({ text: "Button" });
    const root = createElement({ children: [element] });
    const { driver, getDumpCount } = createCountingDriver([root]);

    const coordinator = createCoordinator(driver, {
      parse,
      hierarchyCacheTtl: 10_000,
    });

    await Effect.runPromise(coordinator.assertVisible({ text: "Button" }));
    expect(getDumpCount()).toBe(1);

    // Reuses cache — element found on first poll
    await Effect.runPromise(coordinator.assertVisible({ text: "Button" }));
    expect(getDumpCount()).toBe(1);

    await Effect.runPromise(coordinator.assertVisible({ text: "Button" }));
    expect(getDumpCount()).toBe(1);
  });

  test("cache disabled (ttl=0) dumps every time", async () => {
    const element = createElement({ text: "Button" });
    const root = createElement({ children: [element] });
    const { driver, getDumpCount } = createCountingDriver([root]);

    const coordinator = createCoordinator(driver, {
      parse,
      hierarchyCacheTtl: 0,
    });

    await Effect.runPromise(coordinator.assertVisible({ text: "Button" }));
    await Effect.runPromise(coordinator.assertVisible({ text: "Button" }));

    expect(getDumpCount()).toBe(2);
  });

  test("scroll invalidates cache", async () => {
    const element = createElement({ text: "Button" });
    const root = createElement({ children: [element] });
    const { driver, getDumpCount } = createCountingDriver([root]);

    const coordinator = createCoordinator(driver, {
      parse,
      hierarchyCacheTtl: 10_000,
      screenWidth: 100,
      screenHeight: 200,
    });

    await Effect.runPromise(coordinator.assertVisible({ text: "Button" }));
    expect(getDumpCount()).toBe(1);

    await Effect.runPromise(coordinator.scroll("down"));

    await Effect.runPromise(coordinator.assertVisible({ text: "Button" }));
    expect(getDumpCount()).toBeGreaterThan(1);
  });

  test("inputText invalidates cache", async () => {
    const element = createElement({ text: "Button" });
    const root = createElement({ children: [element] });
    const { driver, getDumpCount } = createCountingDriver([root]);

    const coordinator = createCoordinator(driver, {
      parse,
      hierarchyCacheTtl: 10_000,
    });

    await Effect.runPromise(coordinator.assertVisible({ text: "Button" }));
    expect(getDumpCount()).toBe(1);

    await Effect.runPromise(coordinator.inputText("hello"));

    await Effect.runPromise(coordinator.assertVisible({ text: "Button" }));
    expect(getDumpCount()).toBeGreaterThan(1);
  });
});
