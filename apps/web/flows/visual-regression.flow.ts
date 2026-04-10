import { flow } from "../../../packages/spana/src/api/flow.js";

export default flow(
  "Web app - visual regression baselines stay stable",
  {
    platforms: ["web"],
    tags: ["showcase", "visual-regression"],
  },
  async ({ app, expect }) => {
    await app.openLink("http://localhost:3001/");

    await expect({ testID: "title-banner" }).toBeVisible();
    await expect({ testID: "api-status-section" }).toBeVisible();

    await expect({ testID: "title-banner" }).toMatchScreenshot("title-banner");
    await expect({ testID: "api-status-section" }).toMatchScreenshot("api-status-section", {
      maxDiffPixelRatio: 0.01,
    });
  },
);
