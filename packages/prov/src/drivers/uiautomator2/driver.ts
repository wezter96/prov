import { Effect } from "effect";
import { DriverError } from "../../errors.js";
import type { RawDriverService, LaunchOptions } from "../raw-driver.js";
import { UiAutomator2Client } from "./client.js";

export function createUiAutomator2Driver(
  host: string,
  port: number,
  packageName: string,
): Effect.Effect<RawDriverService, DriverError> {
  return Effect.gen(function* () {
    const client = new UiAutomator2Client(host, port);

    // Create session — must succeed before we can do anything
    yield* Effect.tryPromise({
      try: () => client.createSession(packageName),
      catch: (e) =>
        new DriverError({
          message: `Failed to create UiAutomator2 session: ${e}`,
        }),
    });

    const service: RawDriverService = {
      // -----------------------------------------------------------------------
      // Hierarchy
      // -----------------------------------------------------------------------
      dumpHierarchy: () =>
        Effect.tryPromise({
          try: () => client.getSource(),
          catch: (e) =>
            new DriverError({ message: `Failed to get page source: ${e}` }),
        }),

      // -----------------------------------------------------------------------
      // Coordinate-level actions
      // -----------------------------------------------------------------------
      tapAtCoordinate: (x, y) =>
        Effect.tryPromise({
          try: () => client.performTap(x, y),
          catch: (e) => new DriverError({ message: `Tap failed: ${e}` }),
        }),

      doubleTapAtCoordinate: (x, y) =>
        Effect.tryPromise({
          try: () => client.performDoubleTap(x, y),
          catch: (e) =>
            new DriverError({ message: `Double tap failed: ${e}` }),
        }),

      longPressAtCoordinate: (x, y, duration) =>
        Effect.tryPromise({
          try: () => client.performLongPress(x, y, duration),
          catch: (e) =>
            new DriverError({ message: `Long press failed: ${e}` }),
        }),

      swipe: (sx, sy, ex, ey, dur) =>
        Effect.tryPromise({
          try: () => client.performSwipe(sx, sy, ex, ey, dur),
          catch: (e) => new DriverError({ message: `Swipe failed: ${e}` }),
        }),

      // -----------------------------------------------------------------------
      // Text input
      // -----------------------------------------------------------------------
      inputText: (text) =>
        Effect.tryPromise({
          try: () => client.sendKeys(text),
          catch: (e) =>
            new DriverError({ message: `Input text failed: ${e}` }),
        }),

      pressKey: (key) =>
        Effect.tryPromise({
          try: () => client.pressKeyCode(parseInt(key, 10) || 0),
          catch: (e) =>
            new DriverError({ message: `Press key failed: ${e}` }),
        }),

      hideKeyboard: () =>
        Effect.tryPromise({
          try: () => client.hideKeyboard(),
          catch: (e) =>
            new DriverError({ message: `Hide keyboard failed: ${e}` }),
        }),

      // -----------------------------------------------------------------------
      // Queries
      // -----------------------------------------------------------------------
      takeScreenshot: () =>
        Effect.tryPromise({
          try: async () => {
            const base64 = await client.getScreenshot();
            return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          },
          catch: (e) =>
            new DriverError({ message: `Screenshot failed: ${e}` }),
        }),

      getDeviceInfo: () =>
        Effect.tryPromise({
          try: async () => {
            const size = await client.getWindowSize();
            return {
              platform: "android" as const,
              deviceId: `${host}:${port}`,
              name: "Android Device",
              isEmulator: host === "localhost" || host === "127.0.0.1",
              screenWidth: size.width,
              screenHeight: size.height,
              driverType: "uiautomator2" as const,
            };
          },
          catch: (e) =>
            new DriverError({ message: `Get device info failed: ${e}` }),
        }),

      // -----------------------------------------------------------------------
      // App lifecycle
      // -----------------------------------------------------------------------
      launchApp: (bundleId, _opts?: LaunchOptions) =>
        Effect.tryPromise({
          try: () => client.activateApp(bundleId),
          catch: (e) =>
            new DriverError({ message: `Launch app failed: ${e}` }),
        }),

      stopApp: (bundleId) =>
        Effect.tryPromise({
          try: () => client.terminateApp(bundleId),
          catch: (e) =>
            new DriverError({ message: `Stop app failed: ${e}` }),
        }),

      killApp: (bundleId) =>
        Effect.tryPromise({
          try: () => client.terminateApp(bundleId),
          catch: (e) =>
            new DriverError({ message: `Kill app failed: ${e}` }),
        }),

      clearAppState: (bundleId) =>
        Effect.tryPromise({
          try: async () => {
            await client.terminateApp(bundleId);
            // Full clear (rm data/cache) requires adb shell access which is out
            // of scope for the HTTP-only client — caller should combine with adb.
          },
          catch: (e) =>
            new DriverError({ message: `Clear app state failed: ${e}` }),
        }),

      // -----------------------------------------------------------------------
      // Navigation
      // -----------------------------------------------------------------------
      openLink: (_url) =>
        Effect.tryPromise({
          // Opening arbitrary URLs requires `adb shell am start` which needs
          // adb access beyond this HTTP client. Placeholder for now.
          try: async () => {},
          catch: (e) =>
            new DriverError({ message: `Open link failed: ${e}` }),
        }),

      back: () =>
        Effect.tryPromise({
          // KEYCODE_BACK = 4
          try: () => client.pressKeyCode(4),
          catch: (e) => new DriverError({ message: `Back failed: ${e}` }),
        }),
    };

    return service;
  });
}
