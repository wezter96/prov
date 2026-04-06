# Sauce Labs Cloud Testing

Spana runs tests against Sauce Labs using **Appium cloud mode** -- it connects to Sauce Labs' Appium hub as a standard W3C WebDriver client. Spana executes its own TypeScript flows against Sauce Labs' remote devices.

## Prerequisites

- A Sauce Labs account with Real Devices or Virtual Devices access
- Your app uploaded to Sauce Labs (you handle this step)

## 1. Upload your app

Upload your APK/IPA to Sauce Labs app storage:

```bash
curl -u "USERNAME:ACCESS_KEY" \
  -X POST "https://api.us-west-1.saucelabs.com/v1/storage/upload" \
  -F "payload=@app.apk" \
  -F "name=app.apk"
```

Note the returned `id` for use in capabilities.

## 2. Create capabilities

### Android

Save as `caps/saucelabs-android.json`:

```json
{
  "platformName": "Android",
  "appium:app": "storage:YOUR_APP_ID",
  "appium:deviceName": "Google Pixel 7",
  "appium:platformVersion": "13.0",
  "sauce:options": {
    "name": "spana-run-1",
    "build": "my-app-build-1"
  }
}
```

### iOS

Save as `caps/saucelabs-ios.json`:

```json
{
  "platformName": "iOS",
  "appium:app": "storage:YOUR_APP_ID",
  "appium:deviceName": "iPhone 15",
  "appium:platformVersion": "17",
  "sauce:options": {
    "name": "spana-run-1",
    "build": "my-app-build-1"
  }
}
```

## 3. Configure Spana

```ts
import { defineConfig } from "spana-test";

export default defineConfig({
  execution: {
    mode: "appium",
    appium: {
      serverUrl: process.env.SAUCE_URL,
      capabilitiesFile: "./caps/saucelabs-android.json",
      reportToProvider: true,
    },
  },
  apps: {
    android: { packageName: "com.example.myapp" },
  },
});
```

Set the hub URL:

```bash
# US West data center
export SAUCE_URL="https://USERNAME:ACCESS_KEY@ondemand.us-west-1.saucelabs.com/wd/hub"

# EU data center
export SAUCE_URL="https://USERNAME:ACCESS_KEY@ondemand.eu-central-1.saucelabs.com/wd/hub"
```

## 4. Run tests

```bash
# Using config
spana test --platform android

# Using CLI flags
spana test \
  --driver appium \
  --appium-url $SAUCE_URL \
  --caps ./caps/saucelabs-android.json \
  --platform android

# Inline capabilities (no file needed)
spana test \
  --driver appium \
  --appium-url $SAUCE_URL \
  --caps-json '{"platformName":"Android","appium:app":"storage:YOUR_APP_ID","appium:deviceName":"Google Pixel 7","appium:platformVersion":"13.0"}' \
  --platform android
```

To skip reporting results back to Sauce Labs:

```bash
spana test --platform android --no-provider-reporting
```

## Sauce Connect

When testing against a local dev server, you must run Sauce Connect yourself:

```bash
sc -u USERNAME -k ACCESS_KEY --tunnel-name my-tunnel
```

Then add to your capabilities:

```json
{
  "sauce:options": {
    "tunnelName": "my-tunnel"
  }
}
```

This is your responsibility -- Spana does not manage the Sauce Connect tunnel.
