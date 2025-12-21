/** We need to import defineConfig because we're not using vite. */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
     environment: 'jsdom',
     setupFiles: './test/vitest.setup.js'
  },
})