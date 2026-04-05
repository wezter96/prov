---
title: Introduction
description: What prov is, why it exists, and its core principles.
---

prov is a TypeScript-native end-to-end testing framework for React Native and web applications. It lets you write a single test file that runs against a browser, an Android device or emulator, and an iOS simulator or device — without modifying the app under test.

## Why prov

Existing E2E tools fall into two camps:

- **YAML-based runners** (Maestro, Detox scripts) — readable but limited. No real TypeScript, no imports, no abstractions.
- **Platform-native tools** (Espresso, XCUITest) — powerful but siloed. You write Android tests in Kotlin and iOS tests in Swift.

prov occupies the gap: full TypeScript with real imports, types, and async/await, running across all three platforms from one file.

It replaces Maestro's JVM/YAML stack with a pure-TypeScript engine. No companion JVM process. No YAML parsing. No patching the app binary.

## Key principles

**Pure TypeScript.** Tests are `.ts` files. You get autocomplete, type errors, imports, and the full JS ecosystem. The test runner is Bun.

**No app modification.** prov never requires adding a test server, special build flag, or SDK to your app. Interaction happens through the platform's accessibility layer (UiAutomator2, WebDriverAgent, Playwright CDP).

**Agent-first.** The CLI exposes `hierarchy`, `selectors`, and `validate` commands designed for AI agent workflows. `--reporter json` produces structured output suitable for piping to an agent.

**Thin drivers.** Raw platform drivers are HTTP clients with no logic. All selector matching, auto-wait, and retry runs in the TypeScript smart layer on the host machine.

## Platform support

| Platform | Driver | Notes |
|---|---|---|
| Web / RN Web | Playwright (CDP) | No companion binary — Playwright is a dev dependency |
| Android | UiAutomator2 HTTP client | Bundled APK server (~2–3 MB), ADB-forwarded |
| iOS Simulator | WebDriverAgent HTTP client | Bundled unsigned XCTest bundle (~5 MB) |
| iOS Device | WebDriverAgent HTTP client | Re-signed with user certificate via `codesign`; requires `iproxy` |

## Monorepo structure

The `prov` package (`packages/prov`) is the core library and CLI. Source is organized into:

- `src/api/` — `flow()`, `app`, `expect` — the public test-writing API
- `src/core/` — engine, orchestrator, parallel runner
- `src/smart/` — coordinator, auto-wait, element-matcher (all TypeScript, no native code)
- `src/drivers/` — thin HTTP clients for each platform
- `src/agent/` — `session.ts` backing `prov hierarchy` and `prov selectors`
- `src/cli/` — CLI entry point
- `src/schemas/` — shared types: `Element`, `Selector`, `Platform`, `ProvConfig`
