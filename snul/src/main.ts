import './assets/main.css'
// Motion layer loads after main.css so it can layer on top of the base
// stylesheets without any token or palette file being modified.
import './assets/motion.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initI18n } from './i18n'
import { applyRoleTheme } from './utils/role'
import { applyAuthGatedTheme } from './application/theme.service'
import { vReveal } from './motion/reveal'

import AppImage from './components/ui/AppImage.vue'

initI18n()
applyRoleTheme()
applyAuthGatedTheme()

const app = createApp(App)
app.component('AppImage', AppImage)
app.directive('reveal', vReveal)
app.use(router)
app.mount('#app')
