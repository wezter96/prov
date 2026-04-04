import { Effect } from "effect";
import type { RawDriverService } from "../drivers/raw-driver.js";
import type { Selector } from "../schemas/selector.js";
import { createCoordinator, type Direction, type CoordinatorConfig } from "../smart/coordinator.js";
import type { WaitOptions } from "../smart/auto-wait.js";

export interface PromiseApp {
  tap(selector: Selector, opts?: WaitOptions): Promise<void>;
  tapXY(x: number, y: number): Promise<void>;
  doubleTap(selector: Selector, opts?: WaitOptions): Promise<void>;
  longPress(selector: Selector, opts?: { duration?: number } & WaitOptions): Promise<void>;
  longPressXY(x: number, y: number, opts?: { duration?: number }): Promise<void>;
  inputText(text: string): Promise<void>;
  pressKey(key: string): Promise<void>;
  hideKeyboard(): Promise<void>;
  swipe(direction: Direction, opts?: { duration?: number }): Promise<void>;
  scroll(direction: Direction): Promise<void>;
  launch(opts?: { deepLink?: string }): Promise<void>;
  stop(): Promise<void>;
  kill(): Promise<void>;
  clearState(): Promise<void>;
  openLink(url: string): Promise<void>;
  back(): Promise<void>;
  takeScreenshot(): Promise<Uint8Array>;
}

export function createPromiseApp(
  driver: RawDriverService,
  appId: string,
  config: CoordinatorConfig,
): PromiseApp {
  const coord = createCoordinator(driver, config);

  const run = <A, E>(effect: Effect.Effect<A, E>) =>
    Effect.runPromise(effect as Effect.Effect<A, never>);

  return {
    tap: (selector, opts) => run(coord.tap(selector, opts)),
    tapXY: (x, y) => run(coord.tapXY(x, y)),
    doubleTap: (selector, opts) => run(coord.doubleTap(selector, opts)),
    longPress: (selector, opts) => run(coord.longPress(selector, opts?.duration, opts)),
    longPressXY: (x, y, opts) => run(coord.longPressXY(x, y, opts?.duration)),
    inputText: (text) => run(driver.inputText(text)),
    pressKey: (key) => run(driver.pressKey(key)),
    hideKeyboard: () => run(driver.hideKeyboard()),
    swipe: (direction, opts) => run(coord.swipe(direction, opts)),
    scroll: (direction) => run(coord.scroll(direction)),
    launch: (opts) => run(driver.launchApp(appId, opts)),
    stop: () => run(driver.stopApp(appId)),
    kill: () => run(driver.killApp(appId)),
    clearState: () => run(driver.clearAppState(appId)),
    openLink: (url) => run(driver.openLink(url)),
    back: () => run(driver.back()),
    takeScreenshot: () => run(driver.takeScreenshot()),
  };
}
