import {
  Activity,
  FlaskConical,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Settings,
  Shield,
} from 'lucide-vue-next'
import type { ModuleConfig } from '@core'

export const socModule: ModuleConfig = {
  id: 'soc',
  label: 'SOC',
  icon: Shield,
  defaultPath: '/overview',
  category: 'Demo',
  items: [
    { label: 'Overview', path: '/overview', icon: LayoutDashboard },
    { label: 'Ataques', path: '/ataques', icon: FlaskConical },
    { label: 'Live', path: '/live', icon: Radio },
    { label: 'Experimentos', path: '/experimentos', icon: FlaskConical },
    { label: 'SOC chat', path: '/chat', icon: MessageSquare },
    { label: 'Reportes', path: '/reportes', icon: Activity },
    { label: 'Labs', path: '/labs', icon: Shield },
    { label: 'Evaluaciones', path: '/evaluaciones', icon: Activity },
    { label: 'Settings', path: '/settings', icon: Settings },
  ],
  routes: [
    { path: '/overview', component: () => import('./pages/OverviewPage.vue'), headerConfig: { title: 'Overview' } },
    { path: '/ataques', component: () => import('./pages/AttacksPage.vue'), headerConfig: { title: 'Ataques simulados' } },
    { path: '/live', component: () => import('./pages/LivePage.vue'), headerConfig: { title: 'Live' } },
    { path: '/experimentos', component: () => import('./pages/ExperimentsPage.vue'), headerConfig: { title: 'Laboratorio de agentes' } },
    { path: '/chat', component: () => import('./pages/ChatPage.vue'), headerConfig: { title: 'SOC chat' } },
    { path: '/reportes', component: () => import('./pages/ReportsPage.vue'), headerConfig: { title: 'Reportes' } },
    { path: '/labs', component: () => import('./pages/LabsPage.vue'), headerConfig: { title: 'Labs 00–05' } },
    { path: '/evaluaciones', component: () => import('./pages/EvaluationsPage.vue'), headerConfig: { title: 'Banco de evaluaciones' } },
    { path: '/settings', component: () => import('./pages/SettingsPage.vue'), headerConfig: { title: 'Settings' } },
  ],
}
