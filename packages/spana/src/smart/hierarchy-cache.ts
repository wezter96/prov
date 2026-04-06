import { Effect } from "effect";
import type { RawDriverService } from "../drivers/raw-driver.js";
import type { DriverError } from "../errors.js";
import type { Element } from "../schemas/element.js";

export interface HierarchyCacheConfig {
  /** Max age in ms before the cached hierarchy is considered stale. Default: 100. Set to 0 to disable. */
  hierarchyCacheTtl?: number;
}

const DEFAULT_CACHE_TTL = 100;

export interface HierarchyCache {
  /** Get the hierarchy, using cache if fresh enough. */
  get(
    driver: RawDriverService,
    parse: (raw: string) => Element,
  ): Effect.Effect<Element, DriverError>;
  /** Invalidate the cache (call after mutation actions like tap, type, scroll). */
  invalidate(): void;
}

export function createHierarchyCache(config?: HierarchyCacheConfig): HierarchyCache {
  const ttl = config?.hierarchyCacheTtl ?? DEFAULT_CACHE_TTL;

  let cachedRoot: Element | undefined;
  let cachedAt = 0;

  return {
    get(driver, parse) {
      return Effect.gen(function* () {
        const now = Date.now();
        if (ttl > 0 && cachedRoot && now - cachedAt < ttl) {
          return cachedRoot;
        }
        const raw = yield* driver.dumpHierarchy();
        const root = parse(raw);
        if (ttl > 0) {
          cachedRoot = root;
          cachedAt = Date.now();
        }
        return root;
      });
    },
    invalidate() {
      cachedRoot = undefined;
      cachedAt = 0;
    },
  };
}
