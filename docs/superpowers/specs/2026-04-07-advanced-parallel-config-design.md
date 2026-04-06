# Phase 6.5 — Advanced Parallel Configuration

## Overview

Add explicit control knobs for parallel execution: `--workers <n>` to cap workers per platform, `--devices <id1>,<id2>` for explicit device selection, web multi-context parallelism, and per-platform worker config in `spana.config.ts`.

## Components

### 1. `--workers <n>` flag

Caps the number of concurrent workers per platform. When used with `--parallel`:

- Auto-discovers all devices, but only uses up to N per platform
- Web: creates N browser contexts (enables web parallelism)
- If N > available devices for a mobile platform, uses all available (no error)

Without `--parallel`, `--workers` implies `--parallel`.

### 2. `--devices <id1>,<id2>` flag

Select specific devices instead of auto-discovery. Comma-separated device IDs.

- Implies `--parallel` (using specific devices means you want them all)
- Conflicts with `--device` (singular) — error if both specified
- Infers platforms from device types (no need to also specify `--platform`)
- If a device ID is not found, warn and skip (don't fail the entire run)

### 3. Web multi-context parallelism

When `--workers <n>` is specified (or config sets workers), web platform creates N independent browser contexts:

- Each context is an isolated Playwright browser context (separate cookies, storage, etc.)
- All share a single browser process (efficient)
- Each context becomes a worker for the parallel runner

### 4. Config: `defaults.workers`

```typescript
defaults?: {
  // ... existing fields ...
  /** Max workers per platform. Used with --parallel. */
  workers?: number;
}
```

CLI `--workers` overrides config value. When neither is set, default is unlimited (use all available devices).

## Flag interactions

| Combination                   | Behavior                                    |
| ----------------------------- | ------------------------------------------- |
| `--parallel` alone            | All devices, unlimited workers              |
| `--parallel --workers 2`      | All devices, max 2 per platform             |
| `--workers 3` (no --parallel) | Implies --parallel, max 3 per platform      |
| `--devices emu1,emu2`         | Implies --parallel, uses only those devices |
| `--devices emu1 --workers 1`  | Uses emu1 only (workers caps device list)   |
| `--device X --devices Y,Z`    | Error: conflicting flags                    |
| `--device X --workers 2`      | Error: --device is single-device mode       |

## Testing strategy

- Unit tests: `--workers` caps device list, `--devices` selects specific devices, flag conflicts
- Unit tests: web multi-context creates N browser contexts as workers
- Config validation: `defaults.workers` accepted as positive integer
