import type { FlowContext } from "../api/flow.js";

export interface WorldDefinition<
  S extends Record<string, unknown>,
  M extends Record<string, unknown>,
> {
  create: () => S;
  methods?: (ctx: FlowContext & { state: Map<string, unknown> } & S) => M;
}

export interface WorldFactory<
  S extends Record<string, unknown>,
  M extends Record<string, unknown>,
> {
  /** Create a fresh world instance for a scenario run. */
  instantiate(flowCtx: FlowContext, state: Map<string, unknown>): S & M;
}

let currentWorldFactory: WorldFactory<any, any> | undefined;

export function defineWorld<
  S extends Record<string, unknown>,
  M extends Record<string, unknown> = {},
>(definition: WorldDefinition<S, M>): WorldFactory<S, M> {
  const factory: WorldFactory<S, M> = {
    instantiate(flowCtx, state) {
      const worldState = definition.create();
      // Build a single shared object so methods can mutate state properties directly
      const combined = Object.assign({}, flowCtx, { state }, worldState) as FlowContext & {
        state: Map<string, unknown>;
      } & S &
        M;
      if (definition.methods) {
        Object.assign(combined, definition.methods(combined));
      }
      return combined;
    },
  };
  currentWorldFactory = factory;
  return factory;
}

export function getWorldFactory(): WorldFactory<any, any> | undefined {
  return currentWorldFactory;
}

export function clearWorldFactory(): void {
  currentWorldFactory = undefined;
}
