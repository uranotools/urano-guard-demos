import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import type { ModuleConfig } from '../types/modules'
import { useHeaderStore } from '../stores/header'

export function createAppRouter(modules: ModuleConfig[]) {
  const routes: RouteRecordRaw[] = [
    { path: '/', redirect: '/overview' },
  ]

  for (const mod of modules) {
    for (const r of mod.routes) {
      routes.push({
        path: r.path,
        component: r.component,
        meta: {
          headerConfig: r.headerConfig,
          moduleId: mod.id,
        },
      })
    }
  }

  routes.push({ path: '/:pathMatch(.*)*', redirect: '/' })

  const router = createRouter({
    history: createWebHistory(),
    routes,
  })

  router.afterEach((to) => {
    const header = useHeaderStore()
    header.apply(to.meta.headerConfig as { title: string } | undefined)
  })

  return router
}
