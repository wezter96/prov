import { defineConfig } from "../../packages/spana/src/schemas/config.js";

export default defineConfig({
  platforms: ["web"],
  apps: {
    web: {
      url: "http://localhost:3001",
    },
  },
  artifacts: {
    outputDir: "./spana-output",
  },
  flowDir: "./flows",
  reporters: ["console", "html"],
});
