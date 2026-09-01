import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { createAppRouter } from '@core'
import { registeredModules } from './modules'
import '@core/styles/global.css'

const app = createApp(App)
const pinia = createPinia()
const router = createAppRouter(registeredModules)

app.use(pinia)
app.use(router)
app.mount('#app')
