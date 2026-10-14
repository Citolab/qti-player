import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

// The Vitest UI starts on 63315 and moves up a port when an earlier run still holds it; localStorage is
// per origin, so the UI settings below are seeded for each of those ports.
const uiPort = 63315
const uiPorts = Array.from({ length: 10 }, (_, i) => uiPort + i)

// STEP_DELAY=<ms>: pause before every click in the tests, to watch a run step by step
const stepDelay = Number(process.env.STEP_DELAY) || 0

const uiSettings = [
  // start with the details (report) panel collapsed, so the browser gets the full width
  { name: 'vitest-ui_details-panel-visible', value: 'false' },
  // browser / report split; the preview scales to its share even while the report is hidden
  { name: 'vitest-ui_splitpanes-detailSizes', value: '[100,0]' },
]

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    provide: { stepDelay },
    testTimeout: stepDelay ? 30 * 60_000 : 90_000,
    browser: {
      enabled: true,
      testerHtmlPath: './dist/index.html',
      api: { port: uiPort },
      // desktop size instead of the default "large mobile" (414x896)
      viewport: { width: 1280, height: 900 },
      provider: playwright({
        contextOptions: {
          storageState: {
            cookies: [],
            origins: uiPorts.map(port => ({ origin: `http://localhost:${port}`, localStorage: uiSettings })),
          },
        },
      }),
      instances: [{ browser: 'chromium' }],
    },
  },
})
