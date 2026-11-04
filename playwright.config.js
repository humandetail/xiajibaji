import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    actionTimeout: 5000,
    baseURL: "http://127.0.0.1:4175",
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Shanghai",
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ||
        (process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : undefined),
    },
  },
  webServer: {
    command: "python3 -m http.server 4175 --bind 127.0.0.1",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
  },
});
