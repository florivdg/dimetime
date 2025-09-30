import type { App } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ui from '@nuxt/ui/vue-plugin'

export default (app: App) => {
  const router = createRouter({
    routes: [],
    history: createWebHistory(),
  })

  app.use(router)
  app.use(ui)
}
