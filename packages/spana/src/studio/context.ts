import type { ManagedRuntime } from "effect";
import type { ProvConfig } from "../schemas/config.js";

export type StudioContext = {
  runtime: ManagedRuntime.ManagedRuntime<never, never>;
  config: ProvConfig;
};
