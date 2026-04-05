import { os } from "@orpc/server";
import type { StudioContext } from "./context.js";
import { devicesRouter } from "./routers/devices.js";
import { inspectorRouter } from "./routers/inspector.js";

export const o = os.$context<StudioContext>();
export const publicProcedure = o;

export const studioRouter = {
  devices: devicesRouter,
  inspector: inspectorRouter,
};
export type StudioRouter = typeof studioRouter;
