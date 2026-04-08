import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { FlowStubPreset } from "./scaffolds.js";
import { generateFlowStub } from "./scaffolds.js";

export interface InitFlowOptions {
  name: string;
  outputPath?: string;
  platforms: string[];
  tags?: string[];
  preset?: FlowStubPreset;
  force: boolean;
}

function toFileName(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

export function runInitFlowCommand(options: InitFlowOptions): boolean {
  const fileName = toFileName(options.name);
  const filePath = options.outputPath
    ? resolve(options.outputPath)
    : join("flows", `${fileName}.flow.ts`);

  if (!options.force) {
    try {
      statSync(filePath);
      console.log(`Flow file already exists at ${filePath}. Use --force to overwrite.`);
      return false;
    } catch {
      // File doesn't exist, proceed
    }
  }

  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });

  const content = generateFlowStub(options.name, {
    platforms: options.platforms,
    tags: options.tags,
    preset: options.preset,
  });

  writeFileSync(filePath, content, "utf8");
  console.log(`Created ${filePath}`);
  return true;
}
