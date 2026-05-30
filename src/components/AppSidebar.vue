<script setup lang="ts">
import type { SidebarProps } from '@/components/ui/sidebar'

import {
  BookTemplate,
  CalendarDays,
  Home,
  Landmark,
  LifeBuoy,
  PiggyBank,
  Settings,
  Tags,
} from 'lucide-vue-next'
import { computed } from 'vue'

import { authClient } from '@/lib/auth-client'
import NavMain from '@/components/NavMain.vue'
import NavSecondary from '@/components/NavSecondary.vue'
import NavUser from '@/components/NavUser.vue'

const session = authClient.useSession()
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const props = withDefaults(
  defineProps<
    SidebarProps & {
      currentPath?: string
      planItems?: { title: string; url: string }[]
    }
  >(),
  {
    variant: 'inset',
    currentPath: '',
  },
)

const path = computed(
  () =>
    props.currentPath ||
    (typeof window !== 'undefined' ? window.location.pathname : ''),
)

function isActiveSection(url: string): boolean {
  const current = path.value
  if (url === '/') {
    return current === '/'
  }
  return current.startsWith(url)
}

const DASHBOARD_OTHER_SECTIONS = [
  '/settings',
  '/help',
  '/categories',
  '/plans',
  '/transactions',
  '/bank-transactions',
  '/presets',
] as const

function isDashboardActive(): boolean {
  if (!isActiveSection('/')) return false
  return DASHBOARD_OTHER_SECTIONS.every((url) => !isActiveSection(url))
}

const userInfo = computed(() => {
  const user = session.value?.data?.user
  return {
    name: user?.name || '',
    email: user?.email || '',
    avatar: user?.image || '',
  }
})

const navMain = computed(() => [
  {
    title: 'Dashboard',
    url: '/',
    icon: Home,
    isActive: isDashboardActive(),
  },
  {
    title: 'Pläne',
    url: '/plans',
    icon: CalendarDays,
    isActive: isActiveSection('/plans') || isActiveSection('/transactions'),
    defaultOpen: true,
    items: [
      { title: 'Alle Transaktionen', url: '/transactions' },
      ...(props.planItems ?? []),
    ],
  },
  {
    title: 'Kontoauszüge',
    url: '/bank-transactions',
    icon: Landmark,
    isActive:
      isActiveSection('/bank-transactions') ||
      isActiveSection('/import-sources'),
    items: [{ title: 'Import-Quellen', url: '/import-sources' }],
  },
  {
    title: 'Kategorien',
    url: '/categories',
    icon: Tags,
    isActive: isActiveSection('/categories'),
  },
  {
    title: 'Vorlagen',
    url: '/presets',
    icon: BookTemplate,
    isActive: isActiveSection('/presets'),
  },
  {
    title: 'Einstellungen',
    url: '/settings',
    icon: Settings,
    isActive: isActiveSection('/settings'),
  },
])

const navSecondary = [
  {
    title: 'Hilfe',
    url: '/help',
    icon: LifeBuoy,
  },
]
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child>
            <a href="/">
              <div
                class="text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg bg-lime-500"
              >
                <PiggyBank class="size-4" />
              </div>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="font-medium">DimeTime</span>
                <span class="truncate text-xs font-extralight"
                  >Finanzplanung</span
                >
              </div>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="navMain" />
      <NavSecondary :items="navSecondary" class="mt-auto" />
    </SidebarContent>
    <SidebarFooter>
      <NavUser :user="userInfo" />
    </SidebarFooter>
  </Sidebar>
</template>
