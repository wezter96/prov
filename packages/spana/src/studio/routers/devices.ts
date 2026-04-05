import { z } from "zod";
import { publicProcedure } from "../procedures.js";
import { discoverDevices } from "../../device/discover.js";
import type { Platform } from "../../schemas/selector.js";

export const devicesRouter = {
  list: publicProcedure
    .input(
      z
        .object({
          platforms: z.array(z.enum(["web", "android", "ios"])).optional(),
        })
        .optional(),
    )
    .handler(async ({ input }) => {
      const platforms: Platform[] = input?.platforms ?? ["web", "android", "ios"];
      const devices = discoverDevices(platforms);
      return devices;
    }),
};
