import { describe, expect, test } from "bun:test";
import { buildDeviceSelectionArgs } from "./tests.js";

describe("buildDeviceSelectionArgs", () => {
  test("returns no flags when there are no explicit device IDs", () => {
    expect(buildDeviceSelectionArgs([{ platform: "web" }, { platform: "android" }])).toEqual([]);
  });

  test("uses --device for a single explicitly targeted platform/device", () => {
    expect(buildDeviceSelectionArgs([{ platform: "android", deviceId: "emulator-5554" }])).toEqual([
      "--device",
      "emulator-5554",
    ]);
  });

  test("uses --devices when multiple explicit devices are selected", () => {
    expect(
      buildDeviceSelectionArgs([
        { platform: "android", deviceId: "emulator-5554" },
        { platform: "ios", deviceId: "SIM-1" },
      ]),
    ).toEqual(["--devices", "emulator-5554,SIM-1"]);
  });

  test("uses --devices when a single explicit device is mixed with another platform", () => {
    expect(
      buildDeviceSelectionArgs([
        { platform: "web" },
        { platform: "android", deviceId: "emulator-5554" },
      ]),
    ).toEqual(["--devices", "emulator-5554"]);
  });

  test("deduplicates repeated device IDs", () => {
    expect(
      buildDeviceSelectionArgs([
        { platform: "android", deviceId: "emulator-5554" },
        { platform: "android", deviceId: "emulator-5554" },
      ]),
    ).toEqual(["--device", "emulator-5554"]);
  });
});
