import { resolve } from "node:path";
import { discoverFlows } from "./runner.js";

export interface ValidationError {
  file: string;
  error: string;
}

export async function validateFlowFile(filePath: string): Promise<ValidationError | null> {
  try {
    const absolutePath = resolve(filePath);
    const mod = await import(absolutePath);
    if (!mod.default) {
      return { file: filePath, error: "No default export found" };
    }
    const def = mod.default;
    if (!def.name || typeof def.fn !== "function") {
      return { file: filePath, error: "Invalid flow definition: missing name or fn" };
    }
    return null;
  } catch (e) {
    return {
      file: filePath,
      error: `Failed to import: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export async function validateFlows(paths: string[]): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  for (const path of paths) {
    const err = await validateFlowFile(path);
    if (err) errors.push(err);
  }
  return errors;
}

const VALID_PLATFORMS = new Set(["web", "android", "ios"]);

export async function validateProject(flowDir: string): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  // Check flow directory exists and has flows
  let paths: string[];
  try {
    paths = await discoverFlows(flowDir);
  } catch {
    errors.push({ file: flowDir, error: "Flow directory does not exist" });
    return errors;
  }

  if (paths.length === 0) {
    errors.push({ file: flowDir, error: "No flow files found" });
    return errors;
  }

  // Validate individual flow files (structure check)
  errors.push(...(await validateFlows(paths)));

  // Load flows and check for duplicates + invalid platforms
  const flowNames = new Map<string, string>(); // name -> file

  for (const p of paths) {
    try {
      const mod = await import(resolve(p));
      const def = mod.default;
      if (!def?.name) continue;

      // Duplicate name check
      const existing = flowNames.get(def.name);
      if (existing) {
        errors.push({ file: p, error: `Duplicate flow name "${def.name}" (also in ${existing})` });
      } else {
        flowNames.set(def.name, p);
      }

      // Platform validation
      if (def.config?.platforms) {
        for (const plat of def.config.platforms) {
          if (!VALID_PLATFORMS.has(plat)) {
            errors.push({
              file: p,
              error: `Invalid platform "${plat}" — must be web, android, or ios`,
            });
          }
        }
      }
    } catch {
      // Already caught by validateFlows
    }
  }

  return errors;
}
