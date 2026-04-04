import { Effect } from "effect";
import type { RawDriverService } from "../drivers/raw-driver.js";
import type { Platform } from "../schemas/selector.js";
import type { Element } from "../schemas/element.js";
import type { Selector } from "../schemas/selector.js";
import { makePlaywrightDriver } from "../drivers/playwright.js";
import { createUiAutomator2Driver } from "../drivers/uiautomator2/driver.js";
import { createWDADriver } from "../drivers/wda/driver.js";
import { parseWebHierarchy } from "../drivers/playwright-parser.js";
import { parseAndroidHierarchy } from "../drivers/uiautomator2/pagesource.js";
import { parseIOSHierarchy } from "../drivers/wda/pagesource.js";
import { flattenElements, findElement, centerOf } from "../smart/element-matcher.js";
import { setupUiAutomator2 } from "../drivers/uiautomator2/installer.js";
import { setupWDA } from "../drivers/wda/installer.js";
import { firstAndroidDevice } from "../device/android.js";
import { firstIOSSimulator, bootSimulator } from "../device/ios.js";

export interface ConnectOptions {
  platform: Platform;
  device?: string; // device ID override
  baseUrl?: string; // for web
  packageName?: string; // for android
  bundleId?: string; // for ios
  headless?: boolean; // for web (default true)
}

export interface SuggestedSelector {
  suggestedSelector: Selector;
  elementType?: string;
  text?: string;
  accessibilityLabel?: string;
  bounds: { x: number; y: number; width: number; height: number };
  id?: string;
}

export class Session {
  private driver: RawDriverService;
  readonly platform: Platform;
  private parse: (raw: string) => Element;

  constructor(driver: RawDriverService, platform: Platform, parse: (raw: string) => Element) {
    this.driver = driver;
    this.platform = platform;
    this.parse = parse;
  }

  /** Get the full element hierarchy */
  async hierarchy(): Promise<Element> {
    const raw = await Effect.runPromise(this.driver.dumpHierarchy());
    return this.parse(raw);
  }

  /** Get all actionable elements with suggested selectors */
  async selectors(): Promise<SuggestedSelector[]> {
    const root = await this.hierarchy();
    const all = flattenElements(root);

    return all
      .filter((el) => el.visible !== false && (el.id || el.text || el.accessibilityLabel))
      .map((el) => {
        // Pick best selector: prefer testID > accessibilityLabel > text
        let suggestedSelector: Selector;
        if (el.id) {
          suggestedSelector = { testID: el.id };
        } else if (el.accessibilityLabel) {
          suggestedSelector = { accessibilityLabel: el.accessibilityLabel };
        } else if (el.text) {
          suggestedSelector = { text: el.text };
        } else {
          suggestedSelector = el.text ?? "";
        }

        return {
          suggestedSelector,
          elementType: el.elementType,
          text: el.text,
          accessibilityLabel: el.accessibilityLabel,
          bounds: el.bounds,
          id: el.id,
        };
      });
  }

  /** Tap an element by selector */
  async tap(selector: Selector): Promise<void> {
    const root = await this.hierarchy();
    const el = findElement(root, selector);
    if (!el) throw new Error(`Element not found: ${JSON.stringify(selector)}`);
    const { x, y } = centerOf(el);
    await Effect.runPromise(this.driver.tapAtCoordinate(x, y));
  }

  /** Input text */
  async inputText(text: string): Promise<void> {
    await Effect.runPromise(this.driver.inputText(text));
  }

  /** Take screenshot */
  async screenshot(): Promise<Uint8Array> {
    return Effect.runPromise(this.driver.takeScreenshot());
  }

  /** Disconnect and cleanup */
  async disconnect(): Promise<void> {
    try {
      await Effect.runPromise(this.driver.killApp(""));
    } catch {
      // ignore
    }
  }
}

/** Connect to a device and create a persistent session */
export async function connect(opts: ConnectOptions): Promise<Session> {
  if (opts.platform === "web") {
    const baseUrl = opts.baseUrl ?? "http://localhost:3000";
    const driver = await Effect.runPromise(
      makePlaywrightDriver({ headless: opts.headless ?? true, baseUrl }),
    );
    // Navigate to the app so hierarchy/selectors have content
    await Effect.runPromise(driver.launchApp(baseUrl));
    return new Session(driver, "web", parseWebHierarchy);
  }

  if (opts.platform === "android") {
    const device = firstAndroidDevice();
    if (!device) throw new Error("No Android device connected");
    const hostPort = 8200 + Math.floor(Math.random() * 100);
    const conn = await setupUiAutomator2(device.serial, hostPort);
    const driver = await Effect.runPromise(
      createUiAutomator2Driver(conn.host, conn.port, opts.packageName ?? ""),
    );
    return new Session(driver, "android", parseAndroidHierarchy);
  }

  if (opts.platform === "ios") {
    const sim = firstIOSSimulator();
    if (!sim) throw new Error("No iOS simulator available");
    if (sim.state !== "Booted") bootSimulator(sim.udid);
    const wdaPort = 8100 + Math.floor(Math.random() * 100);
    const conn = await setupWDA(sim.udid, wdaPort);
    const driver = await Effect.runPromise(
      createWDADriver(conn.host, conn.port, opts.bundleId ?? ""),
    );
    return new Session(driver, "ios", parseIOSHierarchy);
  }

  throw new Error(`Unsupported platform: ${opts.platform}`);
}
