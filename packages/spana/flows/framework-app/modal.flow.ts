import { flow } from "spana-test";
import type { Platform } from "spana-test";

const WEB_BASE_URL = "http://127.0.0.1:8081";

function tabsUrl(platform: Platform): string {
  if (platform === "web") return `${WEB_BASE_URL}/(drawer)/(tabs)`;
  return "spana://(drawer)/(tabs)";
}

export default flow(
  "Framework app - modal navigation through UI",
  {
    tags: ["showcase", "e2e", "framework-app"],
    platforms: ["web", "android", "ios"],
    artifacts: { captureOnSuccess: true, captureSteps: true },
  },
  async ({ app, expect, platform }) => {
    // Navigate to the tabs area where the modal button lives
    await app.launch({ deepLink: tabsUrl(platform) });
    await expect({ testID: "tab-one-title" }).toBeVisible({ timeout: 10_000 });

    // Open the modal through the UI (info button in header)
    await app.tap({ testID: "modal-open-button" });
    await expect({ testID: "modal-title" }).toBeVisible({ timeout: 5_000 });
    await expect({ testID: "modal-title" }).toHaveText("Modal");
    await expect({ testID: "modal-description" }).toBeVisible();
    await app.takeScreenshot("modal-open");

    // Dismiss the modal through the UI
    await app.tap({ testID: "modal-dismiss-button" });

    // Verify the underlying screen is visible again
    await expect({ testID: "tab-one-title" }).toBeVisible({ timeout: 5_000 });
    await app.takeScreenshot("modal-dismissed");
  },
);
