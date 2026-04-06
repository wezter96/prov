import { Schema } from "effect";

export const DeviceInfo = Schema.Struct({
  platform: Schema.Literal("android", "ios", "web"),
  deviceId: Schema.String,
  name: Schema.String,
  isEmulator: Schema.Boolean,
  screenWidth: Schema.Number,
  screenHeight: Schema.Number,
  driverType: Schema.Literal("playwright", "uiautomator2", "wda", "appium"),
});
export type DeviceInfo = typeof DeviceInfo.Type;
