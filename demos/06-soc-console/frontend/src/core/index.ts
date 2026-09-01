export { default as AppShell } from './components/AppShell.vue'
export { createAppRouter } from './router/createAppRouter'

export { apiService, isAbortError } from './services/apiService'
export { default as ApiService } from './services/apiService'

export { useToastStore } from './stores/toast'
export { useHeaderStore } from './stores/header'
export { useThemeStore } from './stores/theme'
export { useLayoutStore } from './stores/layout'

export { useToast } from './composables/useToast'
export { useHeader } from './composables/useHeader'

export { default as Form } from './components/multipurpose/Form.vue'
export { default as ModalForm } from './components/multipurpose/ModalForm.vue'
export { default as ListData } from './components/multipurpose/ListData.vue'
export { default as MultiPurposePopover } from './components/multipurpose/MultiPurposePopover.vue'
export { default as FieldRenderer } from './components/multipurpose/FieldRenderer.vue'
export { default as CustomSelect } from './components/multipurpose/CustomSelect.vue'
export { default as ConfirmationModal } from './components/multipurpose/ConfirmationModal.vue'

export type {
  ModuleConfig,
  ModuleRoute,
  MenuItem,
  MenuSection,
  AppRole,
  Field,
  FieldConfig,
  PopoverOption,
  PopoverSection,
  HeaderConfig,
} from './types/modules'
