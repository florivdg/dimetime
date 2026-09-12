import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { InstallmentPlanWithStats } from '@/lib/installments'
import InstallmentFormDialog from './InstallmentFormDialog.vue'
import { setDialogOpen } from '../../../test/dialog-helpers'

const installment: InstallmentPlanWithStats = {
  id: 'ip-1',
  name: 'Waschmaschine',
  note: 'Lieferung',
  amount: 5012,
  finalAmount: 1025,
  totalInstallments: 12,
  prepaidInstallments: 2,
  startMonth: '2026-03',
  dayOfMonth: 15,
  categoryId: null,
  userId: 'user-1',
  completedAt: null,
  createdAt: new Date('2026-03-01T12:00:00Z'),
  updatedAt: new Date('2026-03-01T12:00:00Z'),
  categoryName: null,
  categoryColor: null,
  paidCount: 2,
  openLinkedCount: 0,
  remainingCount: 10,
  remainingSum: 46133,
  projectedEndMonth: '2027-02',
}

describe('InstallmentFormDialog', () => {
  it('validates cross-field constraints before sending a request', async () => {
    const wrapper = mount(InstallmentFormDialog, {
      props: { open: false, installment: null, categories: [] },
    })
    await setDialogOpen(wrapper, true)
    await wrapper.get('#installment-name').setValue('Laptop')
    await wrapper.get('input[type="number"]').setValue('50')
    await wrapper.get('#installment-total').setValue('2')
    await wrapper.get('#installment-prepaid').setValue('3')
    expect(wrapper.text()).toContain(
      'Bereits gezahlte Raten dürfen die Gesamtanzahl nicht überschreiten',
    )
    expect(
      wrapper.get('button[type="submit"]').attributes('disabled'),
    ).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(fetch).not.toHaveBeenCalled()
    expect(wrapper.emitted('error')).toEqual([
      ['Bereits gezahlte Raten dürfen die Gesamtanzahl nicht überschreiten'],
    ])
  })

  it('submits cents and explicit optional values when creating an installment', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(Response.json({}))
    const wrapper = mount(InstallmentFormDialog, {
      props: { open: false, installment: null, categories: [] },
    })
    await setDialogOpen(wrapper, true)
    await wrapper.get('#installment-name').setValue('  Laptop  ')
    await wrapper.get('input[type="number"]').setValue('50.12')
    await wrapper.get('#installment-final-amount').setValue('10.25')
    await wrapper.get('#installment-start-month').setValue('2026-03')
    await wrapper.get('#installment-day').setValue('15')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/installments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Laptop',
        note: null,
        amount: 5012,
        finalAmount: 1025,
        totalInstallments: 12,
        prepaidInstallments: 0,
        startMonth: '2026-03',
        dayOfMonth: 15,
        categoryId: null,
      }),
    })
    expect(wrapper.emitted('saved')).toEqual([['Laptop', true]])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('loads existing cent amounts as euros and clears optional numbers to null on update', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(Response.json({}))
    const wrapper = mount(InstallmentFormDialog, {
      props: { open: false, installment, categories: [] },
    })
    await setDialogOpen(wrapper, true)
    expect(
      wrapper.get<HTMLInputElement>('input[type="number"]').element.value,
    ).toBe('50.12')
    expect(
      wrapper.get<HTMLInputElement>('#installment-final-amount').element.value,
    ).toBe('10.25')
    await wrapper.get('#installment-final-amount').setValue('')
    await wrapper.get('#installment-day').setValue('')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/installments/ip-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Waschmaschine',
        note: 'Lieferung',
        amount: 5012,
        finalAmount: null,
        totalInstallments: 12,
        prepaidInstallments: 2,
        startMonth: '2026-03',
        dayOfMonth: null,
        categoryId: null,
      }),
    })
    expect(wrapper.emitted('saved')).toEqual([['Waschmaschine', false]])
  })

  it('retains the form after an API error and resets old edits when reopened in create mode', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        { error: 'Ratenzahlung wurde bereits abgelöst' },
        { status: 409 },
      ),
    )
    const wrapper = mount(InstallmentFormDialog, {
      props: { open: false, installment, categories: [] },
    })
    await setDialogOpen(wrapper, true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('error')).toEqual([
      ['Ratenzahlung wurde bereits abgelöst'],
    ])
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(
      wrapper.get<HTMLInputElement>('#installment-name').element.value,
    ).toBe('Waschmaschine')
    await setDialogOpen(wrapper, false)
    await wrapper.setProps({ installment: null })
    await setDialogOpen(wrapper, true)
    expect(
      wrapper.get<HTMLInputElement>('#installment-name').element.value,
    ).toBe('')
    expect(
      wrapper.get<HTMLInputElement>('#installment-final-amount').element.value,
    ).toBe('')
    expect(
      wrapper.get<HTMLInputElement>('#installment-prepaid').element.value,
    ).toBe('0')
  })
})
