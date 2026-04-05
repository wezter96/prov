import { devicesRouter } from "./routers/devices.js";
import { inspectorRouter } from "./routers/inspector.js";
import { testsRouter } from "./routers/tests.js";

export { o, publicProcedure } from "./procedures.js";

export const studioRouter = {
  devices: devicesRouter,
  inspector: inspectorRouter,
  tests: testsRouter,
};
export type StudioRouter = typeof studioRouter;
