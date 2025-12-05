<script setup lang="ts">
import type { SidebarProps } from '@/components/ui/sidebar'

import { Home, LifeBuoy, PiggyBank, Settings } from 'lucide-vue-next'
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
  defineProps<SidebarProps & { currentPath?: string }>(),
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

const data = computed(() => ({
  user: {
    name: session.value?.data?.user?.name || '',
    email: session.value?.data?.user?.email || '',
    avatar: session.value?.data?.user?.image || '',
  },
  navMain: [
    {
      title: 'Dashboard',
      url: '/',
      icon: Home,
      isActive:
        isActiveSection('/') &&
        !isActiveSection('/settings') &&
        !isActiveSection('/help'),
    },
    {
      title: 'Einstellungen',
      url: '/settings',
      icon: Settings,
      isActive: isActiveSection('/settings'),
    },
  ],
  navSecondary: [
    {
      title: 'Hilfe',
      url: '/help',
      icon: LifeBuoy,
    },
  ],
}))
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child>
            <a href="/">
              <div
                class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
              >
                <PiggyBank class="size-4" />
              </div>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">DimeTime</span>
                <span class="truncate text-xs">Administration</span>
              </div>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="data.navMain" />
      <NavSecondary :items="data.navSecondary" class="mt-auto" />
    </SidebarContent>
    <SidebarFooter>
      <NavUser :user="data.user" />
    </SidebarFooter>
  </Sidebar>
</template>
