import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import Templates from '../views/Templates.vue'
import Messages from '../views/Messages.vue'
import AutoReplies from '../views/AutoReplies.vue'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
  },
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/templates',
    name: 'Templates',
    component: Templates,
    meta: { requiresAuth: true },
  },
  {
    path: '/messages',
    name: 'Messages',
    component: Messages,
    meta: { requiresAuth: true },
  },
  {
    path: '/auto-replies',
    name: 'AutoReplies',
    component: AutoReplies,
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.token) {
    next({ name: 'Login' })
  } else {
    next()
  }
})

export default router