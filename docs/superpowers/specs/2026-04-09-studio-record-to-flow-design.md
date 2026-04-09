# Studio Record-to-Flow Authoring — Design Spec

> Capture live interactions in Studio and generate starter `.flow.ts` files.

## 1. Overview

A new "Recorder" page in Studio that lets users capture device interactions and generate `.flow.ts` files through a hybrid approach: inspector-driven recording as the primary mode, with optional watch mode for detecting external device interactions.

The recorder produces a step timeline with editable selectors and a live code preview. On save, the generated flow is validated and ready to run.

## 2. Recording Model

### Hybrid Capture

**Inspector-driven (primary):** User clicks elements on the Studio screenshot overlay, picks an action (tap, long press, input text, etc.), and the action executes on the device. Each action is logged to the recording session with the element's suggested selector.

**Watch mode (optional toggle):** Polls the device hierarchy every 1–2 seconds. When a significant change is detected (new screen, modal appeared, large element-count shift), Studio pauses and prompts: "Something changed — what did you just do?" with quick-pick options (tapped, typed, scrolled, swiped, other). The user's answer becomes a timeline step with a manually-described action.

### Selector Strategy

Auto-pick using a fixed priority: `testID > accessibilityLabel > text`. The chosen selector is shown inline on each timeline step. Users can click it to swap to any alternative from the selector suggestion list. This keeps recording fast while allowing correction without interrupting flow.

### Session State

Each recording session is an in-memory object:

```typescript
interface RecordingSession {
  id: string;
  platform: Platform;
  deviceId?: string;
  status: "recording" | "stopped";
  actions: RecordedAction[];
  startedAt: number;
}

interface RecordedAction {
  id: string;
  type:
    | "tap"
    | "doubleTap"
    | "longPress"
    | "inputText"
    | "scroll"
    | "swipe"
    | "pressKey"
    | "back"
    | "expect.toBeVisible"
    | "expect.toHaveText";
  selector?: Selector;
  selectorAlternatives?: Selector[];
  params?: Record<string, unknown>; // text, direction, duration, etc.
  timestamp: number;
  screenshotPath?: string;
}
```

Sessions are stored in a `Map<string, RecordingSession>` on the Studio server. No persistence — sessions live for the lifetime of the server process.

## 3. Architecture

### New Files

| File                                               | Purpose                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `packages/spana/src/studio/routers/recording.ts`   | RPC router: start, stop, addAction, deleteAction, reorderActions, save, validate |
| `packages/spana/src/core/flow-generator.ts`        | Transform `RecordedAction[]` into `.flow.ts` source code                         |
| `apps/studio/src/pages/recorder.tsx`               | Recorder page: inspector + timeline + code preview                               |
| `apps/studio/src/components/action-timeline.tsx`   | Ordered step list with drag-reorder, delete, selector swap                       |
| `apps/studio/src/components/code-preview.tsx`      | Syntax-highlighted live flow code (read-only)                                    |
| `apps/studio/src/components/action-picker.tsx`     | Action type selector shown after element click                                   |
| `apps/studio/src/components/watch-mode-prompt.tsx` | "What did you just do?" dialog for watch mode                                    |

### Modified Files

| File                                  | Change                         |
| ------------------------------------- | ------------------------------ |
| `apps/studio/src/main.tsx`            | Add Recorder tab to navigation |
| `packages/spana/src/studio/server.ts` | Register `recordingRouter`     |

### RPC Endpoints

```
recording.start({ platform, deviceId? })        → { sessionId }
recording.stop({ sessionId })                    → void
recording.addAction({ sessionId, action })       → { actionId }
recording.deleteAction({ sessionId, actionId })  → void
recording.reorderActions({ sessionId, actionIds })→ void
recording.updateSelector({ sessionId, actionId, selector }) → void
recording.getSession({ sessionId })              → RecordingSession
recording.generateCode({ sessionId, flowName })  → { code: string }
recording.save({ sessionId, flowName, flowDir? })→ { filePath, validationResult }
```

### Data Flow

```
User clicks element on screenshot
  → inspector.selectors() returns alternatives
  → action-picker shows action choices
  → user picks "tap"
  → inspector session executes tap on device
  → recording.addAction() logs step with best selector + alternatives
  → action-timeline re-renders with new step
  → flow-generator produces updated code string
  → code-preview re-renders
```

## 4. Flow Code Generator

### Strategy

Template-based string interpolation. No AST library needed — generated flows follow a single predictable structure.

### Output Format

```typescript
import { flow } from "spana-test";

export default flow("Login flow", async ({ app, expect }) => {
  await app.tap({ testID: "email-input" });
  await app.inputText("user@example.com");
  await app.tap({ testID: "password-input" });
  await app.inputText("s3cret");
  await app.tap({ testID: "login-button" });
  await expect({ testID: "dashboard-title" }).toBeVisible();
});
```

### Generation Rules

1. Each `RecordedAction` maps to one `app.*()` or `expect.*()` call.
2. Consecutive `inputText` actions targeting the same element merge into a single call.
3. Selectors emit as object literals: `{ testID: "x" }`, `{ text: "Submit" }`, or `{ accessibilityLabel: "Close" }`.
4. `expect` actions emit as `await expect(selector).toBeVisible()` or `.toHaveText(expected)`.
5. Actions without a selector (e.g., `back`, `scroll("down")`) emit as direct calls.
6. Indentation: 2 spaces, consistent with project style.

### What the Generator Does NOT Do

- No platform-conditional branches (`if (platform === "ios")`) — recorded flow is single-platform.
- No timing/delay insertion — spana's auto-wait handles this.
- No external formatter dependency — output is pre-formatted.

## 5. Recorder UI

### Layout

Three-panel layout:

```
┌─────────────────────────────────────────────────┐
│  [Inspector]  [Runner]  [Recorder]              │
├──────────────────────┬──────────────────────────┤
│                      │  Action Timeline         │
│  Device Screenshot   │  ┌──────────────────┐    │
│  (click to select    │  │ 1. tap "Login"   │    │
│   elements)          │  │ 2. input "user@" │    │
│                      │  │ 3. tap "Submit"  │    │
│                      │  └──────────────────┘    │
│                      │                          │
│                      │  ▼ Code Preview          │
│                      │  ┌──────────────────┐    │
│                      │  │ export default   │    │
│                      │  │   flow(...)      │    │
│                      │  └──────────────────┘    │
├──────────────────────┴──────────────────────────┤
│ [● Recording]  [Watch Mode ○]    [Stop & Save]  │
└─────────────────────────────────────────────────┘
```

### Controls

- **Start Recording** — select platform/device, begin session
- **Watch Mode toggle** — enable/disable hierarchy polling
- **Stop & Save** — end session, prompt for flow name, save to flows directory, run `spana validate`
- **Run Flow** — after save, option to execute the flow immediately via the test runner

### Timeline Interactions

- **Drag to reorder** steps
- **Click delete icon** to remove a step
- **Click selector chip** to swap from alternatives dropdown
- **Click step** to see its screenshot (if captured)

## 6. Save & Validate

On "Stop & Save":

1. User enters a flow name (e.g., "Login flow").
2. `flow-generator` produces the `.flow.ts` source.
3. File is written to the project's flow directory (default: `flows/`).
4. `spana validate` runs on the file.
5. Studio shows the result:
   - Green checkmark + file path on success
   - Error details + suggestions on failure
6. "Run Flow" button appears to execute the generated flow end-to-end.

## 7. Scope Boundaries

### In Scope

- Recorder page with inspector-driven recording
- Watch mode with hierarchy polling and user prompts
- Action timeline with reorder/delete/selector-swap
- Live code preview
- Flow code generator (template-based)
- Save to flows directory with validation
- Single-platform, single-device recording

### Out of Scope (Future)

- Touch passthrough / device mirroring
- AI-assisted flow generation or step suggestions
- Multi-device simultaneous recording
- Gherkin/BDD output format
- Recording persistence across server restarts
- Cross-platform flow generation from single recording
