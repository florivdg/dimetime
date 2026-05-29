import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

const ImportSourceEditDialog = (await import('./ImportSourceEditDialog.vue'))
  .default

describe('ImportSourceEditDialog.vue', () => {
  it('mounts in create mode (no source)', () => {
    const wrapper = mount(ImportSourceEditDialog, {
      props: { open: true, source: null, importTypes: [] },
    })
    expect(wrapper.html()).toBeTruthy()
  })

  it('mounts in edit mode with a source', () => {
    const wrapper = mount(ImportSourceEditDialog, {
      props: {
        open: true,
        importTypes: [],
        source: {
          id: 'src-1',
          name: 'ING Main',
          preset: 'ing_csv_v1',
          sourceKind: 'bank_account',
          bankName: null,
          accountLabel: null,
          accountIdentifier: null,
          defaultPlanAssignment: 'auto_month',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    })
    expect(wrapper.html()).toBeTruthy()
  })
})
