import { z } from "zod";
import { publicProcedure } from "../api.js";
import { connect, type Session } from "../../agent/session.js";
import type { Platform } from "../../schemas/selector.js";

const sessions = new Map<string, Session>();

function sessionKey(platform: string, deviceId?: string): string {
  return `${platform}:${deviceId ?? "default"}`;
}

async function getOrCreateSession(platform: Platform, deviceId?: string): Promise<Session> {
  const key = sessionKey(platform, deviceId);
  const existing = sessions.get(key);
  if (existing) return existing;

  const session = await connect({ platform, device: deviceId });
  sessions.set(key, session);
  return session;
}

const inspectorInput = z.object({
  platform: z.enum(["web", "android", "ios"]),
  deviceId: z.string().optional(),
});

export const inspectorRouter = {
  screenshot: publicProcedure.input(inspectorInput).handler(async ({ input }) => {
    const session = await getOrCreateSession(input.platform, input.deviceId);
    const data = await session.screenshot();
    const base64 = Buffer.from(data).toString("base64");
    return { image: base64 };
  }),

  hierarchy: publicProcedure.input(inspectorInput).handler(async ({ input }) => {
    const session = await getOrCreateSession(input.platform, input.deviceId);
    return session.hierarchy();
  }),

  selectors: publicProcedure.input(inspectorInput).handler(async ({ input }) => {
    const session = await getOrCreateSession(input.platform, input.deviceId);
    return session.selectors();
  }),

  disconnect: publicProcedure.input(inspectorInput).handler(async ({ input }) => {
    const key = sessionKey(input.platform, input.deviceId);
    const session = sessions.get(key);
    if (session) {
      await session.disconnect();
      sessions.delete(key);
    }
    return { disconnected: true };
  }),
};
