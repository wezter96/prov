import { Duration, Effect } from "effect";
import type { RawDriverService } from "../drivers/raw-driver.js";
import type { Element } from "../schemas/element.js";
import type { ExtendedSelector } from "../schemas/selector.js";
import type { DriverError, ElementNotFoundError, WaitTimeoutError } from "../errors.js";
import { TextMismatchError } from "../errors.js";
import { centerOf } from "./element-matcher.js";
import { waitForElement, waitForNotVisible, type WaitOptions } from "./auto-wait.js";
import {
  createHierarchyCache,
  type HierarchyCacheConfig,
  type HierarchyCache,
} from "./hierarchy-cache.js";

export type Direction = "up" | "down" | "left" | "right";

type HierarchyParser = (raw: string) => Element;

export interface CoordinatorConfig {
  parse: HierarchyParser;
  defaults?: WaitOptions;
  screenWidth?: number;
  screenHeight?: number;
  /** Pause after each action (tap, scroll) to let the UI settle. */
  waitForIdleTimeout?: number;
  /** Delay between each character when typing. */
  typingDelay?: number;
  /** Hierarchy cache TTL in ms. Default: 100. Set to 0 to disable caching. */
  hierarchyCacheTtl?: number;
}

export function createCoordinator(driver: RawDriverService, config: CoordinatorConfig) {
  const { parse, defaults } = config;

  const cacheConfig: HierarchyCacheConfig = {
    hierarchyCacheTtl: config.hierarchyCacheTtl,
  };
  const cache: HierarchyCache = createHierarchyCache(cacheConfig);

  const idleWait = (): Effect.Effect<void> => {
    const ms = config.waitForIdleTimeout;
    return ms && ms > 0 ? Effect.sleep(Duration.millis(ms)) : Effect.void;
  };

  /** Invalidate cache after any mutation action */
  const afterMutation = (): Effect.Effect<void> =>
    Effect.gen(function* () {
      cache.invalidate();
      yield* idleWait();
    });

  return {
    tap: (
      selector: ExtendedSelector,
      opts?: WaitOptions,
    ): Effect.Effect<void, ElementNotFoundError | WaitTimeoutError | DriverError> =>
      Effect.gen(function* () {
        const element = yield* waitForElement(
          driver,
          selector,
          parse,
          { ...defaults, ...opts },
          cache,
        );
        const { x, y } = centerOf(element);
        yield* driver.tapAtCoordinate(x, y);
        yield* afterMutation();
      }),

    tapXY: (x: number, y: number): Effect.Effect<void, DriverError> =>
      Effect.gen(function* () {
        yield* driver.tapAtCoordinate(x, y);
        yield* afterMutation();
      }),

    doubleTap: (
      selector: ExtendedSelector,
      opts?: WaitOptions,
    ): Effect.Effect<void, ElementNotFoundError | WaitTimeoutError | DriverError> =>
      Effect.gen(function* () {
        const element = yield* waitForElement(
          driver,
          selector,
          parse,
          { ...defaults, ...opts },
          cache,
        );
        const { x, y } = centerOf(element);
        yield* driver.doubleTapAtCoordinate(x, y);
        yield* afterMutation();
      }),

    longPress: (
      selector: ExtendedSelector,
      duration: number = 1000,
      opts?: WaitOptions,
    ): Effect.Effect<void, ElementNotFoundError | WaitTimeoutError | DriverError> =>
      Effect.gen(function* () {
        const element = yield* waitForElement(
          driver,
          selector,
          parse,
          { ...defaults, ...opts },
          cache,
        );
        const { x, y } = centerOf(element);
        yield* driver.longPressAtCoordinate(x, y, duration);
        yield* afterMutation();
      }),

    longPressXY: (
      x: number,
      y: number,
      duration: number = 1000,
    ): Effect.Effect<void, DriverError> =>
      Effect.gen(function* () {
        yield* driver.longPressAtCoordinate(x, y, duration);
        yield* afterMutation();
      }),

    inputText: (text: string): Effect.Effect<void, DriverError> =>
      Effect.gen(function* () {
        const delay = config.typingDelay;
        if (delay && delay > 0) {
          for (const char of text) {
            yield* driver.inputText(char);
            yield* Effect.sleep(Duration.millis(delay));
          }
        } else {
          yield* driver.inputText(text);
        }
        yield* afterMutation();
      }),

    pressKey: (key: string): Effect.Effect<void, DriverError> =>
      Effect.gen(function* () {
        yield* driver.pressKey(key);
        cache.invalidate();
      }),

    hideKeyboard: (): Effect.Effect<void, DriverError> =>
      Effect.gen(function* () {
        yield* driver.hideKeyboard();
        cache.invalidate();
      }),

    swipe: (direction: Direction, opts?: { duration?: number }): Effect.Effect<void, DriverError> =>
      Effect.gen(function* () {
        const w = config.screenWidth ?? 1080;
        const h = config.screenHeight ?? 1920;
        const cx = w / 2;
        const cy = h / 2;
        const dur = opts?.duration ?? 300;
        const dist = Math.min(w, h) * 0.4;

        const coords = {
          up: { startX: cx, startY: cy + dist / 2, endX: cx, endY: cy - dist / 2 },
          down: { startX: cx, startY: cy - dist / 2, endX: cx, endY: cy + dist / 2 },
          left: { startX: cx + dist / 2, startY: cy, endX: cx - dist / 2, endY: cy },
          right: { startX: cx - dist / 2, startY: cy, endX: cx + dist / 2, endY: cy },
        }[direction];

        yield* driver.swipe(coords.startX, coords.startY, coords.endX, coords.endY, dur);
        yield* afterMutation();
      }),

    scroll: (direction: Direction): Effect.Effect<void, DriverError> =>
      Effect.gen(function* () {
        const w = config.screenWidth ?? 1080;
        const h = config.screenHeight ?? 1920;
        const cx = w / 2;
        const cy = h / 2;
        const dist = Math.min(w, h) * 0.3;

        const coords = {
          up: { startX: cx, startY: cy + dist, endX: cx, endY: cy - dist },
          down: { startX: cx, startY: cy - dist, endX: cx, endY: cy + dist },
          left: { startX: cx + dist, startY: cy, endX: cx - dist, endY: cy },
          right: { startX: cx - dist, startY: cy, endX: cx + dist, endY: cy },
        }[direction];

        yield* driver.swipe(coords.startX, coords.startY, coords.endX, coords.endY, 500);
        yield* afterMutation();
      }),

    assertVisible: (
      selector: ExtendedSelector,
      opts?: WaitOptions,
    ): Effect.Effect<Element, ElementNotFoundError | WaitTimeoutError | DriverError> =>
      waitForElement(driver, selector, parse, { ...defaults, ...opts }, cache),

    assertHidden: (
      selector: ExtendedSelector,
      opts?: WaitOptions,
    ): Effect.Effect<void, WaitTimeoutError | DriverError> =>
      waitForNotVisible(driver, selector, parse, { ...defaults, ...opts }, cache),

    assertText: (
      selector: ExtendedSelector,
      expected: string,
      opts?: WaitOptions,
    ): Effect.Effect<
      void,
      ElementNotFoundError | WaitTimeoutError | TextMismatchError | DriverError
    > =>
      Effect.gen(function* () {
        const element = yield* waitForElement(
          driver,
          selector,
          parse,
          { ...defaults, ...opts },
          cache,
        );
        if (element.text !== expected) {
          return yield* new TextMismatchError({
            message: `Expected text "${expected}" but got "${element.text ?? "(no text)"}"`,
            expected,
            actual: element.text,
            selector,
          });
        }
      }),
  };
}
