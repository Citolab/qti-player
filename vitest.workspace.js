import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    browser: {
      enabled: true,
      testerHtmlPath: './dist/index.html',
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
