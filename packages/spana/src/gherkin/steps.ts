import { globalRegistry, type StepFn } from "./registry.js";
export { defineWorld } from "./world.js";
export type { StepFn, StepContext } from "./registry.js";

export function Given(pattern: string | RegExp, fn: StepFn): void {
  globalRegistry.registerStep("Given", pattern, fn);
}

export function When(pattern: string | RegExp, fn: StepFn): void {
  globalRegistry.registerStep("When", pattern, fn);
}

export function Then(pattern: string | RegExp, fn: StepFn): void {
  globalRegistry.registerStep("Then", pattern, fn);
}

export function And(pattern: string | RegExp, fn: StepFn): void {
  globalRegistry.registerStep("And", pattern, fn);
}

export function But(pattern: string | RegExp, fn: StepFn): void {
  globalRegistry.registerStep("But", pattern, fn);
}

export function Before(fn: StepFn): void;
export function Before(tagExpression: string, fn: StepFn): void;
export function Before(fnOrTag: StepFn | string, maybeFn?: StepFn): void {
  globalRegistry.registerHook("Before", fnOrTag, maybeFn);
}

export function After(fn: StepFn): void;
export function After(tagExpression: string, fn: StepFn): void;
export function After(fnOrTag: StepFn | string, maybeFn?: StepFn): void {
  globalRegistry.registerHook("After", fnOrTag, maybeFn);
}
