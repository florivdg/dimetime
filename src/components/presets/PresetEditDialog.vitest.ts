import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

const PresetEditDialog = (await import('./PresetEditDialog.vue')).default

const samplePreset = {
  id: 'p-1',
  name: 'Rent',
  note: null,
  type: 'expense' as const,
  amount: 100000,
  recurrence: 'monatlich' as const,
  startMonth: '2026-01',
  endDate: null,
  categoryId: null,
  dayOfMonth: null,
  isBudget: false,
  userId: 'u-1',
  lastUsedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  categoryName: null,
  categoryColor: null,
}

describe('PresetEditDialog.vue', () => {
  it('mounts with a preset', () => {
    const wrapper = mount(PresetEditDialog, {
      props: { open: true, preset: samplePreset, categories: [] },
    })
    expect(wrapper.html()).toBeTruthy()
  })

  it('mounts without preset (null)', () => {
    const wrapper = mount(PresetEditDialog, {
      props: { open: false, preset: null, categories: [] },
    })
    expect(wrapper.html()).toBeTruthy()
  })
})
