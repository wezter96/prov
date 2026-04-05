import { flow } from "../../../packages/spana/src/api/flow.js";

export default flow("Home page", { platforms: ["web"] }, async ({ app, expect }) => {
  await app.openLink("http://localhost:3001/");

  await expect({ testID: "home-screen" }).toBeVisible();
  await expect({ testID: "title-banner" }).toBeVisible();
  await expect({ testID: "api-status-section" }).toBeVisible();
  await expect({ testID: "api-status-heading" }).toBeVisible();
});
