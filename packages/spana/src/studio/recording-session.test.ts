import { describe, it, expect, beforeEach } from "bun:test";
import { RecordingSessionStore, type RecordedAction } from "./recording-session.js";

function makeStore(): RecordingSessionStore {
  return new RecordingSessionStore();
}

describe("RecordingSessionStore", () => {
  let store: RecordingSessionStore;

  beforeEach(() => {
    store = makeStore();
  });

  describe("start", () => {
    it("creates a new session with recording status", () => {
      const session = store.start("android");
      expect(session.platform).toBe("android");
      expect(session.status).toBe("recording");
      expect(session.actions).toEqual([]);
      expect(typeof session.id).toBe("string");
      expect(session.id.length).toBeGreaterThan(0);
    });

    it("assigns unique IDs to each session", () => {
      const a = store.start("android");
      const b = store.start("ios");
      expect(a.id).not.toBe(b.id);
    });

    it("supports ios and web platforms", () => {
      expect(store.start("ios").platform).toBe("ios");
      expect(store.start("web").platform).toBe("web");
    });
  });

  describe("get", () => {
    it("returns the session by ID", () => {
      const session = store.start("android");
      const found = store.get(session.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(session.id);
    });

    it("returns undefined for unknown ID", () => {
      expect(store.get("nonexistent")).toBeUndefined();
    });
  });

  describe("stop", () => {
    it("sets status to stopped", () => {
      const session = store.start("android");
      store.stop(session.id);
      const updated = store.get(session.id);
      expect(updated!.status).toBe("stopped");
    });

    it("returns undefined for unknown session", () => {
      expect(store.stop("nonexistent")).toBeUndefined();
    });

    it("returns the updated session", () => {
      const session = store.start("android");
      const result = store.stop(session.id);
      expect(result).toBeDefined();
      expect(result!.status).toBe("stopped");
    });
  });

  describe("addAction", () => {
    it("adds a tap action to the session", () => {
      const session = store.start("android");
      const action = store.addAction(session.id, {
        type: "tap",
        selector: { testID: "submit-button" },
        selectorAlternatives: [],
        params: {},
        timestamp: Date.now(),
      });

      expect(action).toBeDefined();
      expect(action!.type).toBe("tap");
      expect(action!.id).toBeDefined();

      const updated = store.get(session.id)!;
      expect(updated.actions).toHaveLength(1);
      expect(updated.actions[0]!.id).toBe(action!.id);
    });

    it("adds multiple actions in order", () => {
      const session = store.start("android");
      store.addAction(session.id, {
        type: "tap",
        selector: "button1",
        selectorAlternatives: [],
        params: {},
        timestamp: 1000,
      });
      store.addAction(session.id, {
        type: "inputText",
        selector: "input1",
        selectorAlternatives: [],
        params: { text: "hello" },
        timestamp: 2000,
      });

      const updated = store.get(session.id)!;
      expect(updated.actions).toHaveLength(2);
      expect(updated.actions[0]!.type).toBe("tap");
      expect(updated.actions[1]!.type).toBe("inputText");
    });

    it("supports all action types", () => {
      const session = store.start("ios");
      const types: RecordedAction["type"][] = [
        "tap",
        "doubleTap",
        "longPress",
        "inputText",
        "scroll",
        "swipe",
        "pressKey",
        "back",
        "expect.toBeVisible",
        "expect.toHaveText",
      ];
      for (const type of types) {
        store.addAction(session.id, {
          type,
          selectorAlternatives: [],
          params: {},
          timestamp: Date.now(),
        });
      }
      expect(store.get(session.id)!.actions).toHaveLength(types.length);
    });

    it("assigns unique IDs to each action", () => {
      const session = store.start("android");
      store.addAction(session.id, {
        type: "tap",
        selectorAlternatives: [],
        params: {},
        timestamp: 1,
      });
      store.addAction(session.id, {
        type: "back",
        selectorAlternatives: [],
        params: {},
        timestamp: 2,
      });
      const actions = store.get(session.id)!.actions;
      expect(actions[0]!.id).not.toBe(actions[1]!.id);
    });

    it("returns undefined for unknown session", () => {
      const result = store.addAction("nonexistent", {
        type: "tap",
        selectorAlternatives: [],
        params: {},
        timestamp: 1,
      });
      expect(result).toBeUndefined();
    });

    it("stores optional screenshotPath", () => {
      const session = store.start("ios");
      const action = store.addAction(session.id, {
        type: "tap",
        selectorAlternatives: [],
        params: {},
        timestamp: 1,
        screenshotPath: "/tmp/screenshot.png",
      });
      expect(action!.screenshotPath).toBe("/tmp/screenshot.png");
    });
  });

  describe("deleteAction", () => {
    it("removes an action by ID", () => {
      const session = store.start("android");
      const action = store.addAction(session.id, {
        type: "tap",
        selectorAlternatives: [],
        params: {},
        timestamp: 1,
      })!;
      store.addAction(session.id, {
        type: "back",
        selectorAlternatives: [],
        params: {},
        timestamp: 2,
      });

      store.deleteAction(session.id, action.id);

      const updated = store.get(session.id)!;
      expect(updated.actions).toHaveLength(1);
      expect(updated.actions[0]!.type).toBe("back");
    });

    it("returns undefined for unknown session", () => {
      expect(store.deleteAction("nonexistent", "action-id")).toBeUndefined();
    });

    it("returns the updated session after deletion", () => {
      const session = store.start("android");
      const action = store.addAction(session.id, {
        type: "tap",
        selectorAlternatives: [],
        params: {},
        timestamp: 1,
      })!;
      const result = store.deleteAction(session.id, action.id);
      expect(result).toBeDefined();
      expect(result!.actions).toHaveLength(0);
    });

    it("is a no-op if action ID does not exist", () => {
      const session = store.start("android");
      store.addAction(session.id, {
        type: "tap",
        selectorAlternatives: [],
        params: {},
        timestamp: 1,
      });
      store.deleteAction(session.id, "unknown-action-id");
      expect(store.get(session.id)!.actions).toHaveLength(1);
    });
  });

  describe("reorderActions", () => {
    it("reorders actions by providing a new ordered list of IDs", () => {
      const session = store.start("android");
      const a1 = store.addAction(session.id, {
        type: "tap",
        selectorAlternatives: [],
        params: {},
        timestamp: 1,
      })!;
      const a2 = store.addAction(session.id, {
        type: "back",
        selectorAlternatives: [],
        params: {},
        timestamp: 2,
      })!;
      const a3 = store.addAction(session.id, {
        type: "scroll",
        selectorAlternatives: [],
        params: {},
        timestamp: 3,
      })!;

      const result = store.reorderActions(session.id, [a3.id, a1.id, a2.id]);

      expect(result).toBeDefined();
      expect(result!.actions[0]!.id).toBe(a3.id);
      expect(result!.actions[1]!.id).toBe(a1.id);
      expect(result!.actions[2]!.id).toBe(a2.id);
    });

    it("returns undefined for unknown session", () => {
      expect(store.reorderActions("nonexistent", [])).toBeUndefined();
    });

    it("preserves action data after reorder", () => {
      const session = store.start("ios");
      const a1 = store.addAction(session.id, {
        type: "inputText",
        selector: "field",
        selectorAlternatives: [],
        params: { text: "hi" },
        timestamp: 1,
      })!;
      const a2 = store.addAction(session.id, {
        type: "tap",
        selectorAlternatives: [],
        params: {},
        timestamp: 2,
      })!;

      const result = store.reorderActions(session.id, [a2.id, a1.id])!;
      expect(result.actions[1]!.params).toEqual({ text: "hi" });
    });
  });

  describe("updateSelector", () => {
    it("updates the selector of an action", () => {
      const session = store.start("android");
      const action = store.addAction(session.id, {
        type: "tap",
        selector: "old-selector",
        selectorAlternatives: [],
        params: {},
        timestamp: 1,
      })!;

      const result = store.updateSelector(session.id, action.id, { testID: "new-button" });

      expect(result).toBeDefined();
      const updated = store.get(session.id)!.actions.find((a) => a.id === action.id)!;
      expect(updated.selector).toEqual({ testID: "new-button" });
    });

    it("returns undefined for unknown session", () => {
      expect(store.updateSelector("nonexistent", "action-id", "selector")).toBeUndefined();
    });

    it("returns undefined for unknown action", () => {
      const session = store.start("android");
      expect(store.updateSelector(session.id, "nonexistent-action", "selector")).toBeUndefined();
    });

    it("returns the updated session", () => {
      const session = store.start("android");
      const action = store.addAction(session.id, {
        type: "tap",
        selector: "old",
        selectorAlternatives: [],
        params: {},
        timestamp: 1,
      })!;
      const result = store.updateSelector(session.id, action.id, "new-selector");
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Object);
    });
  });

  describe("full recording flow", () => {
    it("records a complete session and stops it", () => {
      const session = store.start("ios");
      expect(session.status).toBe("recording");

      store.addAction(session.id, {
        type: "tap",
        selector: { testID: "login-button" },
        selectorAlternatives: [],
        params: {},
        timestamp: 1000,
      });
      store.addAction(session.id, {
        type: "inputText",
        selector: { testID: "username-field" },
        selectorAlternatives: [{ accessibilityLabel: "Username" }],
        params: { text: "user@example.com" },
        timestamp: 1100,
      });
      store.addAction(session.id, {
        type: "expect.toBeVisible",
        selector: { testID: "home-screen" },
        selectorAlternatives: [],
        params: {},
        timestamp: 1200,
      });

      const stopped = store.stop(session.id)!;
      expect(stopped.status).toBe("stopped");
      expect(stopped.actions).toHaveLength(3);
    });
  });
});
