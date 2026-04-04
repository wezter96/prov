import { defineConfig } from "./src/schemas/config.js";

export default defineConfig({
	apps: {
		web: { url: "http://localhost:3001" },
	},
	defaults: {
		waitTimeout: 5_000,
		pollInterval: 200,
	},
	platforms: ["web"],
	flowDir: "./flows",
	reporters: ["console"],
});
