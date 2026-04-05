import {
  CucumberExpression,
  RegularExpression,
  ParameterTypeRegistry,
} from "@cucumber/cucumber-expressions";
import type { StepHandler } from "./registry.js";

export interface MatchResult {
  handler: StepHandler;
  args: unknown[];
}

export function createStepMatcher(steps: readonly StepHandler[]) {
  const parameterTypeRegistry = new ParameterTypeRegistry();

  const compiled = steps.map((handler) => {
    const expression =
      handler.pattern instanceof RegExp
        ? new RegularExpression(handler.pattern, parameterTypeRegistry)
        : new CucumberExpression(handler.pattern, parameterTypeRegistry);
    return { handler, expression };
  });

  return {
    match(text: string): MatchResult | undefined {
      const matches: { handler: StepHandler; args: unknown[] }[] = [];

      for (const { handler, expression } of compiled) {
        const result = expression.match(text);
        if (result) {
          matches.push({
            handler,
            args: result.map((arg) => arg.getValue(null)),
          });
        }
      }

      if (matches.length === 0) return undefined;

      if (matches.length > 1) {
        const patterns = matches.map((m) => `  "${m.handler.pattern}"`).join("\n");
        throw new Error(`Ambiguous step definition for "${text}". Matches:\n${patterns}`);
      }

      return matches[0];
    },
  };
}
