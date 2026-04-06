# BrowserStack Cloud Testing

Spana runs tests against BrowserStack using **Appium cloud mode** -- it connects to BrowserStack's Appium hub as a standard W3C WebDriver client. This is not the BrowserStack Maestro upload API; Spana executes its own TypeScript flows against BrowserStack's remote devices.

## Prerequisites

- A BrowserStack App Automate account
- Your app uploaded to BrowserStack (you handle this step)

## 1. Upload your app

Upload your APK/IPA to BrowserStack. This returns a `bs://` app ID:

```bash
curl -u "USERNAME:ACCESS_KEY" \
  -X POST "https://api-cloud.browserstack.com/app-automate/upload" \
  -F "file=@app.apk"
```

Response:

```json
{ "app_url": "bs://YOUR_APP_ID" }
```

Use `bs://YOUR_APP_ID` in your capabilities.

## 2. Create capabilities

### Android

Save as `caps/browserstack-android.json`:

```json
{
  "platformName": "Android",
  "appium:app": "bs://YOUR_APP_ID",
  "appium:deviceName": "Google Pixel 7",
  "appium:platformVersion": "13.0",
  "bstack:options": {
    "projectName": "My App",
    "buildName": "spana-run-1"
  }
}
```

### iOS

Save as `caps/browserstack-ios.json`:

```json
{
  "platformName": "iOS",
  "appium:app": "bs://YOUR_APP_ID",
  "appium:deviceName": "iPhone 15",
  "appium:platformVersion": "17",
  "bstack:options": {
    "projectName": "My App",
    "buildName": "spana-run-1"
  }
}
```

## 3. Configure Spana

Create or update `spana.config.ts`:

```ts
import { defineConfig } from "spana-test";

export default defineConfig({
  execution: {
    mode: "appium",
    appium: {
      serverUrl: process.env.BROWSERSTACK_URL,
      capabilitiesFile: "./caps/browserstack-android.json",
      reportToProvider: true,
    },
  },
  apps: {
    android: { packageName: "com.example.myapp" },
  },
});
```

Set the hub URL as an environment variable:

```bash
export BROWSERSTACK_URL="https://USERNAME:ACCESS_KEY@hub-cloud.browserstack.com/wd/hub"
```

## 4. Run tests

```bash
# Using config
spana test --platform android

# Using CLI flags (no config needed)
spana test \
  --driver appium \
  --appium-url $BROWSERSTACK_URL \
  --caps ./caps/browserstack-android.json \
  --platform android
```

To skip reporting results back to BrowserStack:

```bash
spana test --platform android --no-provider-reporting
```

## BrowserStack Local

When testing against a local dev server (e.g., `localhost:3000`), you must run BrowserStack Local yourself before starting tests:

```bash
BrowserStackLocal --key ACCESS_KEY
```

Then add to your capabilities:

```json
{
  "bstack:options": {
    "local": true
  }
}
```

This is your responsibility -- Spana does not manage the BrowserStack Local tunnel.

## Device selection

Browse available devices at [BrowserStack App Automate](https://www.browserstack.com/list-of-browsers-and-platforms/app_automate). Use the device name and platform version in your capabilities file.
