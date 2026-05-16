import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () =>
      ref({
        data: {
          user: {
            name: 'Test User',
            email: 'test@example.com',
            image: null,
          },
        },
      }),
  },
}))

vi.mock('@/components/NavMain.vue', () => ({
  default: {
    name: 'NavMain',
    props: ['items'],
    template:
      '<div class="nav-main">{{ items.map(i => i.title + (i.isActive ? "*" : "")).join("|") }}</div>',
  },
}))

vi.mock('@/components/NavSecondary.vue', () => ({
  default: {
    name: 'NavSecondary',
    props: ['items'],
    template: '<div class="nav-secondary"></div>',
  },
}))

vi.mock('@/components/NavUser.vue', () => ({
  default: {
    name: 'NavUser',
    props: ['user'],
    template: '<div class="nav-user">{{ user.name }}|{{ user.email }}</div>',
  },
}))

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: { template: '<aside><slot /></aside>' },
  SidebarContent: { template: '<div><slot /></div>' },
  SidebarFooter: { template: '<div><slot /></div>' },
  SidebarHeader: { template: '<header><slot /></header>' },
  SidebarMenu: { template: '<div><slot /></div>' },
  SidebarMenuButton: { template: '<button><slot /></button>' },
  SidebarMenuItem: { template: '<div><slot /></div>' },
}))

const AppSidebar = (await import('./AppSidebar.vue')).default

describe('AppSidebar.vue', () => {
  it('marks Dashboard active on /', () => {
    const wrapper = mount(AppSidebar, { props: { currentPath: '/' } })
    expect(wrapper.find('.nav-main').text()).toContain('Dashboard*')
  })

  it('does not mark Dashboard active on /plans', () => {
    const wrapper = mount(AppSidebar, { props: { currentPath: '/plans' } })
    const text = wrapper.find('.nav-main').text()
    expect(text).toContain('Pläne*')
    expect(text).not.toContain('Dashboard*')
  })

  it('marks Pläne active also for /transactions', () => {
    const wrapper = mount(AppSidebar, {
      props: { currentPath: '/transactions' },
    })
    expect(wrapper.find('.nav-main').text()).toContain('Pläne*')
  })

  it('marks Kontoauszüge active for /import-sources', () => {
    const wrapper = mount(AppSidebar, {
      props: { currentPath: '/import-sources' },
    })
    expect(wrapper.find('.nav-main').text()).toContain('Kontoauszüge*')
  })

  it('renders user info from session', () => {
    const wrapper = mount(AppSidebar, { props: { currentPath: '/' } })
    expect(wrapper.find('.nav-user').text()).toContain('Test User')
    expect(wrapper.find('.nav-user').text()).toContain('test@example.com')
  })
})
