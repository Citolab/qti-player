import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // If you want to keep running your existing tests in Node.js, uncomment the next line.
  // 'vite.config.js',
  {
    extends: 'vite.config.js',
    test: {
      include: ['tests/**/*.test.js'],

      browser: {
        testerHtmlPath: './dist/index.html',
        enabled: true,
        provider: 'playwright',
        // https://vitest.dev/guide/browser/playwright
        instances: [
          { browser: 'chromium' },
        ],
      },
    },
  },
])
