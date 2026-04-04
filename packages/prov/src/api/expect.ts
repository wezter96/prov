import { Effect } from "effect";
import type { RawDriverService } from "../drivers/raw-driver.js";
import type { Selector } from "../schemas/selector.js";
import { createCoordinator, type CoordinatorConfig } from "../smart/coordinator.js";
import type { WaitOptions } from "../smart/auto-wait.js";

export interface PromiseExpectation {
  toBeVisible(opts?: WaitOptions): Promise<void>;
  toBeHidden(opts?: WaitOptions): Promise<void>;
  toHaveText(expected: string, opts?: WaitOptions): Promise<void>;
}

export function createPromiseExpect(
  driver: RawDriverService,
  config: CoordinatorConfig,
): (selector: Selector) => PromiseExpectation {
  const coord = createCoordinator(driver, config);

  const run = <A, E>(effect: Effect.Effect<A, E>) =>
    Effect.runPromise(effect as Effect.Effect<A, never>);

  return (selector: Selector): PromiseExpectation => ({
    toBeVisible: (opts) => run(coord.assertVisible(selector, opts)).then(() => {}),
    toBeHidden: (opts) => run(coord.assertHidden(selector, opts)),
    toHaveText: (expected, opts) => run(coord.assertText(selector, expected, opts)),
  });
}
