import type { ScenarioStepKeyword } from "../report/types.js";
import type { FlowContext } from "../api/flow.js";

export interface StepHandler<W = unknown> {
  keyword: ScenarioStepKeyword;
  pattern: string | RegExp;
  fn: StepFn<W>;
}

export type StepContext<W = unknown> = FlowContext & {
  state: Map<string, unknown>;
} & (W extends Record<string, unknown> ? W : {});

export type StepFn<W = unknown> = (ctx: StepContext<W>, ...args: unknown[]) => Promise<void>;

export interface HookHandler<W = unknown> {
  keyword: "Before" | "After";
  tagExpression?: string;
  fn: StepFn<W>;
}

class StepRegistry {
  private steps: StepHandler[] = [];
  private hooks: HookHandler[] = [];

  registerStep(keyword: ScenarioStepKeyword, pattern: string | RegExp, fn: StepFn): void {
    const patternStr = pattern instanceof RegExp ? pattern.source : pattern;
    const existing = this.steps.find(
      (s) => (s.pattern instanceof RegExp ? s.pattern.source : s.pattern) === patternStr,
    );
    if (existing) {
      throw new Error(
        `Duplicate step definition: "${patternStr}" is already registered as a ${existing.keyword} step`,
      );
    }
    this.steps.push({ keyword, pattern, fn });
  }

  registerHook(keyword: "Before" | "After", fnOrTag: StepFn | string, maybeFn?: StepFn): void {
    if (typeof fnOrTag === "string") {
      this.hooks.push({ keyword, tagExpression: fnOrTag, fn: maybeFn! });
    } else {
      this.hooks.push({ keyword, fn: fnOrTag });
    }
  }

  getSteps(): readonly StepHandler[] {
    return this.steps;
  }

  getHooks(keyword: "Before" | "After"): readonly HookHandler[] {
    return this.hooks.filter((h) => h.keyword === keyword);
  }

  clear(): void {
    this.steps = [];
    this.hooks = [];
  }
}

export const globalRegistry = new StepRegistry();
