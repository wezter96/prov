import { flow } from "../../src/api/flow.js";
import type { Platform } from "../../src/schemas/selector.js";

const WEB_BASE_URL = "http://127.0.0.1:8081";

function homePath(platform: Platform): string {
	return platform === "android" ? "/(drawer)" : "/";
}

function homeHref(platform: Platform): string {
	const path = homePath(platform);
	return platform === "web" ? `${WEB_BASE_URL}${path}` : `spana://${path}`;
}

export default flow(
	"Framework app - home screen renders on every platform",
	{
		tags: ["smoke", "e2e", "framework-app"],
		platforms: ["web", "android", "ios"],
		autoLaunch: false,
	},
	async ({ app, expect, platform }) => {
		if (platform === "ios") {
			await app.stop();
			await app.launch();
		} else {
			await app.launch({ deepLink: homeHref(platform) });
		}

		await expect({ testID: "home-scroll" }).toBeVisible();
		await expect({ testID: "home-content" }).toBeVisible();
		await expect({ testID: "home-title" }).toBeVisible();
		await expect({ testID: "home-card" }).toBeVisible();
		await expect({ text: "BETTER T STACK" }).toBeVisible();
	},
);
