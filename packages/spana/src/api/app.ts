import { Effect } from "effect";
import type { RawDriverService } from "../drivers/raw-driver.js";
import type { Selector } from "../schemas/selector.js";
import { createCoordinator, type Direction, type CoordinatorConfig } from "../smart/coordinator.js";
import type { WaitOptions } from "../smart/auto-wait.js";
import type { StepRecorder } from "../core/step-recorder.js";

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
  takeScreenshot(name?: string): Promise<Uint8Array>;
}

export function createPromiseApp(
  driver: RawDriverService,
  appId: string,
  config: CoordinatorConfig,
  recorder?: StepRecorder,
): PromiseApp {
  const coord = createCoordinator(driver, config);

  const run = <A, E>(effect: Effect.Effect<A, E>) =>
    Effect.runPromise(effect);

  const runStep = <A>(
    command: string,
    action: () => Promise<A>,
    opts?: { selector?: unknown; captureScreenshot?: boolean },
  ) => recorder
    ? recorder.runStep(command, action, opts)
    : action();

  const runScreenshotStep = (
    command: string,
    action: () => Promise<Uint8Array>,
    opts?: { selector?: unknown; name?: string },
  ) => recorder
    ? recorder.runScreenshotStep(command, action, opts)
    : action();

  return {
    tap: (selector, opts) => runStep("tap", () => run(coord.tap(selector, opts)), { selector, captureScreenshot: true }),
    tapXY: (x, y) => runStep("tapXY", () => run(coord.tapXY(x, y)), {
      selector: { point: { x, y } },
      captureScreenshot: true,
    }),
    doubleTap: (selector, opts) => runStep("doubleTap", () => run(coord.doubleTap(selector, opts)), { selector, captureScreenshot: true }),
    longPress: (selector, opts) => runStep("longPress", () => run(coord.longPress(selector, opts?.duration, opts)), { selector, captureScreenshot: true }),
    longPressXY: (x, y, opts) => runStep("longPressXY", () => run(coord.longPressXY(x, y, opts?.duration)), {
      selector: { point: { x, y } },
      captureScreenshot: true,
    }),
    inputText: (text) => runStep("inputText", () => run(driver.inputText(text)), { captureScreenshot: true }),
    pressKey: (key) => runStep(`pressKey(${key})`, () => run(driver.pressKey(key)), { captureScreenshot: true }),
    hideKeyboard: () => runStep("hideKeyboard", () => run(driver.hideKeyboard()), { captureScreenshot: true }),
    swipe: (direction, opts) => runStep(`swipe(${direction})`, () => run(coord.swipe(direction, opts)), { captureScreenshot: true }),
    scroll: (direction) => runStep(`scroll(${direction})`, () => run(coord.scroll(direction)), { captureScreenshot: true }),
    launch: (opts) => runStep("launch", () => run(driver.launchApp(appId, opts)), {
      selector: opts,
      captureScreenshot: true,
    }),
    stop: () => runStep("stop", () => run(driver.stopApp(appId)), { captureScreenshot: true }),
    kill: () => runStep("kill", () => run(driver.killApp(appId)), { captureScreenshot: true }),
    clearState: () => runStep("clearState", () => run(driver.clearAppState(appId)), { captureScreenshot: true }),
    openLink: (url) => runStep("openLink", () => run(driver.openLink(url)), {
      selector: { url },
      captureScreenshot: true,
    }),
    back: () => runStep("back", () => run(driver.back()), { captureScreenshot: true }),
    takeScreenshot: (name) => runScreenshotStep(
      name ? `takeScreenshot(${name})` : "takeScreenshot",
      () => run(driver.takeScreenshot()),
      { name },
    ),
  };
}
