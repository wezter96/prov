import type { Selector, Platform } from "../schemas/selector.js";
import type { ArtifactConfig } from "../schemas/config.js";
import type { PromiseApp } from "./app.js";
import type { PromiseExpectation } from "./expect.js";

export interface WhenCondition {
  /** Only run on these platforms */
  platform?: Platform | Platform[];
  /** Only run when this environment variable is set */
  env?: string;
}

export interface FlowDefaults {
  waitTimeout?: number;
  pollInterval?: number;
  settleTimeout?: number;
  waitForIdleTimeout?: number;
  typingDelay?: number;
  /** Starting poll interval for adaptive backoff. Default: 50ms. */
  initialPollInterval?: number;
  /** Hierarchy cache TTL in ms. Default: 100. Set to 0 to disable. */
  hierarchyCacheTtl?: number;
}

export interface FlowConfig {
  tags?: string[];
  platforms?: Platform[];
  timeout?: number;
  autoLaunch?: boolean; // default true
  artifacts?: ArtifactConfig;
  when?: WhenCondition;
  /** Per-flow overrides for timing defaults. Merged with global defaults. */
  defaults?: FlowDefaults;
}

export interface FlowContext {
  app: PromiseApp;
  expect: (selector: Selector) => PromiseExpectation;
  platform: Platform;
}

export type FlowFn = (ctx: FlowContext) => Promise<void>;

export interface FlowDefinition {
  name: string;
  fn: FlowFn;
  config: FlowConfig;
  sourcePath?: string;
}

// Overloads: flow(name, fn) and flow(name, config, fn)
export function flow(name: string, fn: FlowFn): FlowDefinition;
export function flow(name: string, config: FlowConfig, fn: FlowFn): FlowDefinition;
export function flow(
  name: string,
  configOrFn: FlowConfig | FlowFn,
  maybeFn?: FlowFn,
): FlowDefinition {
  if (typeof configOrFn === "function") {
    return { name, fn: configOrFn, config: {} };
  }
  return { name, fn: maybeFn!, config: configOrFn };
}
