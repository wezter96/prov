import type { ProvConfig } from "../schemas/config.js";

export interface StudioCliOptions {
  port: number;
  open: boolean;
  config: ProvConfig;
}

export async function runStudioCommand(options: StudioCliOptions) {
  const { startStudio } = await import("../studio/server.js");

  const { existsSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  // Resolve studio-dist relative to the package root (sibling of dist/)
  const thisFile = fileURLToPath(import.meta.url);
  const packageRoot = resolve(dirname(thisFile), "..");
  const staticDir = resolve(packageRoot, "studio-dist");

  await startStudio({
    port: options.port,
    open: options.open,
    config: options.config,
    staticDir: existsSync(staticDir) ? staticDir : undefined,
  });

  // Keep process alive
  await new Promise(() => {});
}
