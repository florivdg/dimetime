// @ts-check
import { defineConfig } from 'astro/config'

import node from '@astrojs/node'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'
import ui from '@nuxt/ui/vite'

// https://astro.build/config
export default defineConfig({
  adapter: node({
    mode: 'standalone',
  }),

  integrations: [
    vue({
      appEntrypoint: '/src/vue/_app',
    }),
  ],

  vite: {
    plugins: [tailwindcss(), ui()],
  },
})
