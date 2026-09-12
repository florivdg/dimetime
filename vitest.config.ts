import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['**/*.vitest.ts'],
    exclude: [
      '**/*.test.ts',
      '**/*.spec.ts',
      'node_modules/**',
      'dist/**',
      '.astro/**',
    ],
    setupFiles: ['./test/vue-setup.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      // Bun owns server modules and the two pure composables below. Including
      // them here reported them as uncovered and tried to transform middleware.
      include: ['src/components/**/*.vue', 'src/composables/**/*.ts'],
      exclude: [
        'src/**/*.vitest.ts',
        'src/**/*.test.ts',
        'src/**/__fixtures__/**',
        'src/components/ui/**',
        'src/composables/useSortIcon.ts',
        'src/composables/useDeleteTransactionDialog.ts',
      ],
      reportsDirectory: 'coverage/vue',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
    },
  },
})
