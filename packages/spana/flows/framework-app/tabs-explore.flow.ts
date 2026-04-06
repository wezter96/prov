import { flow } from "../../src/api/flow.js";
import type { Platform } from "../../src/schemas/selector.js";

const WEB_BASE_URL = "http://127.0.0.1:8081";

function homePath(_platform: Platform): string {
  return "/";
}

function homeHref(platform: Platform): string {
  const path = homePath(platform);
  if (platform === "web") {
    return `${WEB_BASE_URL}${path}`;
  }

  const normalizedPath = path === "/" ? "" : path.replace(/^\/+/, "");
  return `spana://${normalizedPath}`;
}

export default flow(
  "Framework app - navigate to tabs explore through the UI",
  {
    tags: ["e2e", "framework-app", "tabs"],
    platforms: ["web", "android"],
    autoLaunch: false,
    artifacts: {
      captureOnSuccess: true,
      captureSteps: true,
    },
  },
  async ({ app, expect, platform }) => {
    await app.launch({ clearState: platform === "android", deepLink: homeHref(platform) });
    if (platform === "android") {
      try {
        await expect({ testID: "home-title" }).toBeVisible({ timeout: 15_000 });
      } catch {
        await expect({ accessibilityLabel: "Show navigation menu" }).toBeVisible({
          timeout: 15_000,
        });
        await app.tap({ accessibilityLabel: "Show navigation menu" });
        await app.tap({ testID: "drawer-home-item" });
        await expect({ testID: "home-title" }).toBeVisible({ timeout: 15_000 });
      }
    } else {
      await expect({ testID: "home-title" }).toBeVisible({ timeout: 10_000 });
    }
    await expect({ accessibilityLabel: "Show navigation menu" }).toBeVisible({ timeout: 10_000 });
    await app.tap({ accessibilityLabel: "Show navigation menu" });
    await expect({ testID: "drawer-tabs-item" }).toBeVisible({ timeout: 10_000 });
    await app.tap({ testID: "drawer-tabs-item" });
    await expect({ testID: "tab-one-title" }).toBeVisible({ timeout: 15_000 });
    if (platform === "android") {
      await app.tap({ text: "Explore" });
    } else {
      await app.tap({ accessibilityLabel: "Open explore tab" });
    }
    await expect({ testID: "tab-two-title" }).toBeVisible({ timeout: 10_000 });
    await expect({ testID: "tab-two-subtitle" }).toHaveText(
      "Browse more of the Spana demo experience",
    );
  },
);
