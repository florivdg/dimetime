import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

/**
 * Run a composable inside a throwaway component so it has an active Vue setup
 * context, and return whatever it produced.
 */
export function withComposable<T>(setup: () => T): T {
  let captured: T | undefined
  const Comp = defineComponent({
    setup() {
      captured = setup()
      return () => h('div')
    },
  })
  mount(Comp)
  return captured as T
}

/** Build a JSON `Response` for stubbing `fetch` in composable tests. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
