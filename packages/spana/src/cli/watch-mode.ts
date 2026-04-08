import { readdir, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

const WATCH_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".feature"]);
const IGNORE_DIRS = new Set([".git", "node_modules", "spana-output", "dist", "coverage"]);

interface FileSnapshot {
  path: string;
  mtime: number;
  size: number;
}

export function collectWatchRoots(flowDir: string, configPath?: string): string[] {
  const roots = [resolve(flowDir)];
  if (configPath) {
    const configDir = dirname(resolve(configPath));
    if (!roots.includes(configDir)) roots.push(configDir);
  }
  return roots;
}

async function snapshotDir(dir: string): Promise<FileSnapshot[]> {
  const snapshots: FileSnapshot[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        snapshots.push(...(await snapshotDir(fullPath)));
      } else if (WATCH_EXTENSIONS.has(extname(entry.name))) {
        const info = await stat(fullPath);
        snapshots.push({ path: fullPath, mtime: info.mtimeMs, size: info.size });
      }
    }
  } catch {
    // Directory may have been deleted
  }
  return snapshots;
}

function diffSnapshots(previous: FileSnapshot[], next: FileSnapshot[]): string[] {
  const prevMap = new Map(previous.map((s) => [s.path, s]));
  const changed: string[] = [];

  for (const snap of next) {
    const prev = prevMap.get(snap.path);
    if (!prev || prev.mtime !== snap.mtime || prev.size !== snap.size) {
      changed.push(snap.path);
    }
  }

  return changed;
}

interface WatchOptions {
  roots: string[];
  interval?: number;
  onChange: (changedPaths: string[]) => Promise<void>;
}

export async function runWatchLoop(options: WatchOptions): Promise<never> {
  const interval = options.interval ?? 500;
  let previous: FileSnapshot[] = [];

  for (const root of options.roots) {
    previous.push(...(await snapshotDir(root)));
  }

  while (true) {
    await new Promise((r) => setTimeout(r, interval));

    const next: FileSnapshot[] = [];
    for (const root of options.roots) {
      next.push(...(await snapshotDir(root)));
    }

    const changed = diffSnapshots(previous, next);
    if (changed.length > 0) {
      await options.onChange(changed);
    }

    previous = next;
  }
}
