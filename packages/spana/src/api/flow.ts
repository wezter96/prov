import type { Selector, Platform } from "../schemas/selector.js";
import type { ArtifactConfig } from "../schemas/config.js";
import type { PromiseApp } from "./app.js";
import type { PromiseExpectation } from "./expect.js";

export interface FlowConfig {
  tags?: string[];
  platforms?: Platform[];
  timeout?: number;
  autoLaunch?: boolean; // default true
  artifacts?: ArtifactConfig;
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
}

// Overloads: flow(name, fn) and flow(name, config, fn)
export function flow(name: string, fn: FlowFn): FlowDefinition;
export function flow(name: string, config: FlowConfig, fn: FlowFn): FlowDefinition;
export function flow(name: string, configOrFn: FlowConfig | FlowFn, maybeFn?: FlowFn): FlowDefinition {
  if (typeof configOrFn === "function") {
    return { name, fn: configOrFn, config: {} };
  }
  return { name, fn: maybeFn!, config: configOrFn };
}
