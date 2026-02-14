// @ts-check
import { defineConfig, fontProviders } from 'astro/config'

import vue from '@astrojs/vue'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'

// https://astro.build/config
export default defineConfig({
  integrations: [vue()],

  adapter: node({
    mode: 'standalone',
  }),

  output: 'server',

  security: {
    allowedDomains: [
      { hostname: 'dimetime.flori.cloud' },
      { hostname: 'dimetime.local' },
    ],
  },

  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ['dimetime.local'],
    },
  },

  experimental: {
    fonts: [
      {
        provider: fontProviders.google(),
        name: 'Inter',
        cssVariable: '--font-inter',
        weights: [400, 500, 600, 700],
        styles: ['normal'],
      },
    ],
  },
})
