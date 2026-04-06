import { flow } from "spana-test";
import type { Platform } from "spana-test";

const WEB_BASE_URL = "http://127.0.0.1:8081";

function playgroundUrl(platform: Platform): string {
  return platform === "web" ? `${WEB_BASE_URL}/playground` : "spana://playground";
}

export default flow(
  "Framework app - interaction playground showcase",
  {
    tags: ["showcase", "e2e", "framework-app"],
    platforms: ["web", "android", "ios"],
    artifacts: { captureOnSuccess: true, captureSteps: true },
  },
  async ({ app, expect, platform }) => {
    // Navigate to the playground screen
    await app.launch({ deepLink: playgroundUrl(platform) });
    await expect({ testID: "playground-title" }).toBeVisible({ timeout: 10_000 });

    // --- Text input ---
    await app.tap({ testID: "playground-input" });
    await app.inputText("Hello Spana");
    await expect({ testID: "playground-input-mirror" }).toHaveText("Hello Spana");
    await app.hideKeyboard();
    await app.takeScreenshot("text-input");

    // --- Double tap ---
    await app.tap({ testID: "playground-double-tap" });
    await app.tap({ testID: "playground-double-tap" });
    await expect({ testID: "playground-double-tap-count" }).toHaveText("Taps: 2");
    await app.takeScreenshot("double-tap");

    // --- Long press ---
    await app.longPress({ testID: "playground-long-press" });
    await expect({ testID: "playground-long-press-status" }).toHaveText("Activated");
    await app.takeScreenshot("long-press");

    // --- Toggle section: verify hidden → visible ---
    await expect({ testID: "playground-details-hidden" }).toBeVisible();
    await app.tap({ testID: "playground-toggle" });
    await expect({ testID: "playground-details-text" }).toBeVisible();
    await expect({ testID: "playground-details-hidden" }).toBeHidden();
    await app.takeScreenshot("section-expanded");

    // --- Scroll to bottom sentinel ---
    await app.scroll("up"); // scroll content up = view moves down
    await app.scroll("up");
    await app.scroll("up");
    await expect({ testID: "playground-sentinel" }).toBeVisible({ timeout: 5_000 });
    await expect({ testID: "playground-sentinel-text" }).toHaveText("Bottom Reached");
    await app.takeScreenshot("scroll-sentinel");
  },
);
