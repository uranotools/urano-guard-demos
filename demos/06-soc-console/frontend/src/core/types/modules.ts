import type { Component } from 'vue'

export type AppRole = string

export interface MenuItem {
  label: string
  path: string
  icon: Component
  roles?: AppRole[]
  adminOnly?: boolean
}

export interface MenuSection {
  title: string
  items: MenuItem[]
  collapsible?: boolean
  defaultOpen?: boolean
}

export interface HeaderConfig {
  title: string
}

export interface ModuleRoute {
  path: string
  component: () => Promise<Component | { default: Component }>
  headerConfig?: HeaderConfig
  isPublic?: boolean
  adminOnly?: boolean
  roles?: AppRole[]
}

export interface ModuleConfig {
  id: string
  label: string
  icon: Component
  defaultPath: string
  category?: string
  items: Array<MenuItem | MenuSection>
  routes: ModuleRoute[]
}

export interface Field {
  name: string
  title: string
  type: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'customselect' | 'hidden'
  required?: boolean
  gridClassName?: string
  options?: Array<{ label: string; value: string | number }>
  select2?: {
    route: string
    endpoint?: string
    labelField: string
    valueField: string
  }
}

export interface FieldConfig {
  type: Field['type']
  label: string
  required?: boolean
  options?: Field['options']
  select2?: Field['select2']
}

export interface PopoverOption {
  id: string | number
  text: string
  variant?: 'danger' | 'default'
  icon?: Component
}

export interface PopoverSection {
  title: string
  options: PopoverOption[]
}
