import type { VueWrapper } from '@vue/test-utils'

/** Astro's SFC types omit defineModel props; Vue's runtime still accepts them. */
export async function setDialogOpen(wrapper: VueWrapper, open: boolean) {
  await wrapper.setProps({ open })
}
