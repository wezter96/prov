import { flow } from "../../src/api/flow.js";
import type { Platform } from "../../src/schemas/selector.js";

interface RouteSpec {
	name: string;
	path: string;
	selector: { testID: string };
	androidPath?: string;
}

const WEB_BASE_URL = "http://127.0.0.1:8081";

const routeSpecs: RouteSpec[] = [
	{ name: "home", path: "/", androidPath: "/(drawer)", selector: { testID: "home-title" } },
	{ name: "tabs-home", path: "/(drawer)/(tabs)", selector: { testID: "tab-one-title" } },
	{ name: "tabs-explore", path: "/two", selector: { testID: "tab-two-title" } },
	{ name: "modal", path: "/modal", selector: { testID: "modal-title" } },
];

function routeHref(platform: Platform, route: RouteSpec): string {
	const path = platform === "android" && route.androidPath
		? route.androidPath
		: route.path;

	if (platform === "web") {
		return `${WEB_BASE_URL}${path}`;
	}

	return `spana://${path}`;
}

export default flow(
	"Framework app - capture screenshots for direct route jumps",
	{
		tags: ["e2e", "framework-app", "screenshots"],
		platforms: ["web", "android", "ios"],
		autoLaunch: false,
		timeout: 90_000,
		artifacts: {
			captureOnSuccess: true,
		},
	},
	async ({ app, expect, platform }) => {
		const failures: string[] = [];

		if (platform === "ios") {
			await app.stop();
		}

		for (const route of routeSpecs) {
			try {
				if (platform === "ios" && route.name === "home") {
					await app.launch();
				} else {
					await app.openLink(routeHref(platform, route));
				}
				await expect(route.selector).toBeVisible({ timeout: 15_000 });
				await app.takeScreenshot(route.name);
			} catch (error) {
				failures.push(`${route.name}: ${error instanceof Error ? error.message : String(error)}`);
				try {
					await app.takeScreenshot(`${route.name}-failure`);
				} catch {
					// Ignore secondary screenshot failures so the flow can continue.
				}
			}
		}

		if (failures.length > 0) {
			throw new Error(`Direct route screenshot flow failed:\n- ${failures.join("\n- ")}`);
		}
	},
);
