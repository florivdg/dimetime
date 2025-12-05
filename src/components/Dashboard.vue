<script setup lang="ts">
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import AppSidebar from '@/components/AppSidebar.vue'

defineProps<{
  currentPath: string
  breadcrumbs?: {
    label: string
    href?: string
  }[]
}>()
</script>

<template>
  <SidebarProvider>
    <AppSidebar :current-path="currentPath" />
    <SidebarInset>
      <header
        class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
      >
        <div class="flex items-center gap-2 px-4">
          <SidebarTrigger class="-ml-1" />
          <Separator
            orientation="vertical"
            class="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem class="hidden md:block">
                <BreadcrumbLink href="/"> Home </BreadcrumbLink>
              </BreadcrumbItem>
              <template v-if="breadcrumbs?.length">
                <template v-for="(crumb, index) in breadcrumbs" :key="index">
                  <BreadcrumbSeparator class="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbLink v-if="crumb.href" :href="crumb.href">
                      {{ crumb.label }}
                    </BreadcrumbLink>
                    <BreadcrumbPage v-else>{{ crumb.label }}</BreadcrumbPage>
                  </BreadcrumbItem>
                </template>
              </template>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
        <slot />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
