import { Effect } from "effect";
import type { RawDriverService } from "../drivers/raw-driver.js";
import type { Selector } from "../schemas/selector.js";
import { createCoordinator, type CoordinatorConfig } from "../smart/coordinator.js";
import type { WaitOptions } from "../smart/auto-wait.js";
import type { StepRecorder } from "../core/step-recorder.js";

export interface PromiseExpectation {
  toBeVisible(opts?: WaitOptions): Promise<void>;
  toBeHidden(opts?: WaitOptions): Promise<void>;
  toHaveText(expected: string, opts?: WaitOptions): Promise<void>;
}

export function createPromiseExpect(
  driver: RawDriverService,
  config: CoordinatorConfig,
  recorder?: StepRecorder,
): (selector: Selector) => PromiseExpectation {
  const coord = createCoordinator(driver, config);

  const run = <A, E>(effect: Effect.Effect<A, E>) =>
    Effect.runPromise(effect);

  const runStep = <A>(
    command: string,
    selector: Selector,
    action: () => Promise<A>,
  ) => recorder
    ? recorder.runStep(command, action, { selector, captureScreenshot: false })
    : action();

  return (selector: Selector): PromiseExpectation => ({
    toBeVisible: (opts) => runStep("expect.toBeVisible", selector, () => run(coord.assertVisible(selector, opts)).then(() => {})),
    toBeHidden: (opts) => runStep("expect.toBeHidden", selector, () => run(coord.assertHidden(selector, opts))),
    toHaveText: (expected, opts) => runStep(`expect.toHaveText(${JSON.stringify(expected)})`, selector, () => run(coord.assertText(selector, expected, opts))),
  });
}
