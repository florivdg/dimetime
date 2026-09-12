import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CategoryCreateDialog from './CategoryCreateDialog.vue'
import CategoryManager from './CategoryManager.vue'
import CategoryTable from './CategoryTable.vue'

vi.mock('@/composables/useUrlState', async () => {
  const { reactive } = await import('vue')
  return { useUrlState: () => ({ state: reactive({ search: '' }) }) }
})

const category = {
  id: 'cat-1',
  name: 'Miete',
  slug: 'miete',
  color: '#6366f1',
  createdAt: new Date('2026-03-01T12:00:00Z'),
  updatedAt: new Date('2026-03-01T12:00:00Z'),
}

describe('category creation', () => {
  it('rejects blank names, generates the slug and submits trimmed values', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(Response.json({}))
    const wrapper = mount(CategoryCreateDialog, { props: { open: true } })
    await wrapper.get('#new-name').setValue('   ')
    await wrapper.get('form').trigger('submit')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(
      wrapper.get('button[type="submit"]').attributes('disabled'),
    ).toBeDefined()

    await wrapper.get('#new-name').setValue('  Büro & Freizeit  ')
    await wrapper.get('#new-name').trigger('blur')
    expect(wrapper.get<HTMLInputElement>('#new-slug').element.value).toBe(
      'buro-freizeit',
    )
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Büro & Freizeit',
        slug: 'buro-freizeit',
        color: '#6366f1',
      }),
    })
    expect(wrapper.emitted('created')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.get<HTMLInputElement>('#new-name').element.value).toBe('')
  })

  it('preserves a custom slug and form values when the API rejects creation', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ error: 'Slug bereits vergeben' }, { status: 409 }),
    )
    const wrapper = mount(CategoryCreateDialog, { props: { open: true } })
    await wrapper.get('#new-slug').setValue('custom')
    await wrapper.get('#new-name').setValue('Miete')
    await wrapper.get('#new-name').trigger('blur')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('#new-slug').element.value).toBe(
      'custom',
    )
    expect(wrapper.get<HTMLInputElement>('#new-name').element.value).toBe(
      'Miete',
    )
    expect(wrapper.emitted('error')).toEqual([['Slug bereits vergeben']])
    expect(wrapper.emitted('created')).toBeUndefined()
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })
})

describe('category management', () => {
  it('filters names and slugs without changing the source list, and Escape clears search', async () => {
    const categories = [
      category,
      { ...category, id: 'cat-2', name: 'Lebensmittel', slug: 'food' },
    ]
    const wrapper = mount(CategoryManager, {
      props: { initialCategories: categories },
    })
    await wrapper.get('input[name="query"]').setValue('FOOD')
    expect(
      wrapper.getComponent({ name: 'CategoryTable' }).props('categories'),
    ).toEqual([categories[1]])
    await wrapper.get('input[name="query"]').trigger('keyup.escape')
    expect(
      wrapper.getComponent({ name: 'CategoryTable' }).props('categories'),
    ).toEqual(categories)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('seeds an empty collection, reloads it and removes the seed action', async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(Response.json({ count: 1 }))
      .mockResolvedValueOnce(Response.json({ categories: [category] }))
    const wrapper = mount(CategoryManager, { props: { initialCategories: [] } })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Standardkategorien')!
      .trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/categories/seed', {
      method: 'POST',
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/categories')
    expect(
      wrapper.getComponent({ name: 'CategoryTable' }).props('categories'),
    ).toEqual([
      {
        ...category,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      },
    ])
    expect(
      wrapper
        .findAll('button')
        .some((button) => button.text() === 'Standardkategorien'),
    ).toBe(false)
  })

  it('surfaces child errors and refreshes after successful mutations', async () => {
    const wrapper = mount(CategoryManager, {
      props: { initialCategories: [category] },
    })
    wrapper
      .getComponent({ name: 'CategoryTable' })
      .vm.$emit('error', 'Kategorie wird verwendet')
    await flushPromises()
    expect(wrapper.text()).toContain('Kategorie wird verwendet')
    vi.mocked(fetch).mockResolvedValue(Response.json({ categories: [] }))
    wrapper.getComponent({ name: 'CategoryTable' }).vm.$emit('deleted')
    await flushPromises()
    expect(
      wrapper.getComponent({ name: 'CategoryTable' }).props('categories'),
    ).toEqual([])
    expect(wrapper.text()).not.toContain('Kategorie wird verwendet')
  })
})

describe('category table', () => {
  const props = { categories: [category], isLoading: false, searchQuery: '' }

  it('saves edited values and exits editing only after success', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(Response.json({}))
    const wrapper = mount(CategoryTable, { props })
    await wrapper.get('button[title="Bearbeiten"]').trigger('click')
    const fields = wrapper.findAll('input[type="text"]')
    await fields[0]!.setValue('  Wohnen  ')
    await fields[1]!.setValue('  wohnen  ')
    await wrapper.get('button[title="Speichern"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/categories/cat-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Wohnen',
        slug: 'wohnen',
        color: '#6366f1',
      }),
    })
    expect(wrapper.emitted('updated')).toHaveLength(1)
    expect(wrapper.find('button[title="Speichern"]').exists()).toBe(false)
  })

  it('keeps edits available after a failed save and allows cancellation without another request', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ error: 'Name fehlt' }, { status: 400 }),
    )
    const wrapper = mount(CategoryTable, { props })
    await wrapper.get('button[title="Bearbeiten"]').trigger('click')
    await wrapper.get('button[title="Speichern"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('error')).toEqual([['Name fehlt']])
    expect(wrapper.emitted('updated')).toBeUndefined()
    await wrapper.get('button[title="Abbrechen"]').trigger('click')
    expect(wrapper.find('button[title="Speichern"]').exists()).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('distinguishes an empty collection from an empty search', async () => {
    const wrapper = mount(CategoryTable, {
      props: { ...props, categories: [] },
    })
    expect(wrapper.text()).toContain(
      'Sie haben noch keine Kategorien erstellt.',
    )
    await wrapper.setProps({ searchQuery: 'Kredit' })
    expect(wrapper.text()).toContain('Keine Kategorien gefunden für "Kredit".')
    expect(wrapper.text()).not.toContain(
      'Sie haben noch keine Kategorien erstellt.',
    )
  })
})
