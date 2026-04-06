const allocated = new Set<number>();
const counters = new Map<number, number>();

/** Allocate a port starting from a base, incrementing to avoid collisions */
export function allocatePort(base: number): number {
  const counter = counters.get(base) ?? 0;

  // Try from base up to base + counter, looking for a free one
  for (let i = 0; i <= counter; i++) {
    if (!allocated.has(base + i)) {
      allocated.add(base + i);
      return base + i;
    }
  }

  // All previous are taken, allocate next
  let port = base + counter;
  while (allocated.has(port)) {
    port++;
  }
  allocated.add(port);
  counters.set(base, port - base + 1);
  return port;
}

/** Release a port back to the pool */
export function releasePort(port: number): void {
  allocated.delete(port);
}

/** Reset all state (for testing) */
export function resetAllocator(): void {
  allocated.clear();
  counters.clear();
}
