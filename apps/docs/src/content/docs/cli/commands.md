---
title: CLI Commands
description: All prov CLI commands and flags.
---

The `prov` binary is the entry point for running tests, listing devices, and introspecting the platform state.

## `prov test`

Run test flows.

```bash
prov test [path] [options]
```

`path` is optional. If omitted, prov discovers all `.ts` files under `flowDir` (default: `./flows`).

### Options

| Flag | Description |
|---|---|
| `--platform <platforms>` | Comma-separated platform targets: `web`, `android`, `ios` |
| `--tag <tag>` | Run only flows with this tag |
| `--grep <pattern>` | Run only flows whose name matches this pattern |
| `--reporter <name>` | Reporter: `console`, `json`, `junit`, `html`, `allure` |
| `--config <path>` | Path to config file (default: `./prov.config.ts`) |

### Examples

```bash
# Run all flows against web (config default)
prov test

# Run a single flow file
prov test flows/login.ts

# Run all smoke-tagged flows on Android and iOS
prov test --tag smoke --platform android,ios

# Filter by name pattern
prov test --grep "log in"

# Emit JSON to stdout for downstream processing
prov test --reporter json

# Use a non-default config
prov test --config ./config/prov.staging.ts
```

## `prov devices`

List connected devices and simulators across all platforms.

```bash
prov devices
```

Output includes device name, platform, OS version, and connection status. Useful for confirming your device targets before running tests.

```bash
prov devices
# android  Pixel 7          API 33   connected
# ios      iPhone 15        17.2     booted (simulator)
```

## `prov version`

Print the installed prov version and exit.

```bash
prov version
# prov 0.1.0
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | All flows passed |
| `1` | One or more flows failed |
| `2` | Configuration or setup error |
