import { nextTick, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'

export function useEditInputRefs() {
  const editInputRefs = ref<
    Record<string, HTMLInputElement | ComponentPublicInstance | null>
  >({})

  function setEditInputRef(
    id: string,
    el: HTMLInputElement | ComponentPublicInstance | null,
  ) {
    if (el === null) {
      delete editInputRefs.value[id]
      return
    }
    editInputRefs.value[id] = el
  }

  function focusEditInput(id: string) {
    const refValue = editInputRefs.value[id]
    const inputEl =
      refValue instanceof HTMLInputElement
        ? refValue
        : (refValue as ComponentPublicInstance | undefined)?.$el
    if (inputEl instanceof HTMLInputElement) {
      inputEl.focus()
      inputEl.select?.()
    }
  }

  async function focusEditInputAsync(id: string) {
    await nextTick()
    focusEditInput(id)
  }

  return {
    editInputRefs,
    setEditInputRef,
    focusEditInput,
    focusEditInputAsync,
  }
}
