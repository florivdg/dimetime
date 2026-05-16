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
    include: ['**/*.spec.ts'],
    exclude: ['**/*.test.ts', 'node_modules/**', 'dist/**', '.astro/**'],
    setupFiles: ['./test/vue-setup.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/__fixtures__/**',
        'src/components/ui/**',
        'src/lib/bank-import/types.ts',
        'src/db/schema/**',
        'src/db/database.ts',
        'src/components/plans/index.ts',
        'src/.env.d.ts',
      ],
      reporter: ['text', 'json-summary', 'html'],
    },
  },
})
