import { describe, expect, mock, test } from "bun:test";
import { runWithRecoveredSession } from "./inspector.js";

describe("runWithRecoveredSession", () => {
  test("returns the first successful result without resetting the session", async () => {
    const resetSession = mock(async () => {});

    const result = await runWithRecoveredSession(async () => "ok", resetSession);

    expect(result).toBe("ok");
    expect(resetSession).toHaveBeenCalledTimes(0);
  });

  test("retries once after a stale-session failure", async () => {
    const resetSession = mock(async () => {});
    let attempts = 0;

    const result = await runWithRecoveredSession(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("stale session");
      }
      return "recovered";
    }, resetSession);

    expect(result).toBe("recovered");
    expect(resetSession).toHaveBeenCalledTimes(1);
  });

  test("resets again and rethrows when the retry also fails", async () => {
    const resetSession = mock(async () => {});

    await expect(
      runWithRecoveredSession(async () => {
        throw new Error("still broken");
      }, resetSession),
    ).rejects.toThrow("still broken");

    expect(resetSession).toHaveBeenCalledTimes(2);
  });
});
