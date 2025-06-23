<template>
  <div class="min-h-screen bg-gray-100">
    <nav class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <div class="flex-shrink-0 flex items-center">
              <router-link to="/" class="text-xl font-bold text-gray-800">
                WaGate
              </router-link>
            </div>
            <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
              <router-link
                v-if="authStore.token"
                to="/"
                class="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:border-indigo-500"
                active-class="border-indigo-500 text-gray-900"
              >
                Dashboard
              </router-link>
              <router-link
                v-if="authStore.token"
                to="/templates"
                class="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:border-indigo-500"
                active-class="border-indigo-500 text-gray-900"
              >
                Templates
              </router-link>
              <router-link
                v-if="authStore.token"
                to="/messages"
                class="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:border-indigo-500"
                active-class="border-indigo-500 text-gray-900"
              >
                Messages
              </router-link>
              <router-link
                v-if="authStore.token"
                to="/auto-replies"
                class="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:border-indigo-500"
                active-class="border-indigo-500 text-gray-900"
              >
                Auto-Replies
              </router-link>
            </div>
          </div>
          <div v-if="authStore.token" class="flex items-center">
            <Button variant="ghost" @click="authStore.logout">Logout</Button>
          </div>
        </div>
      </div>
    </nav>
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'

const authStore = useAuthStore();
</script>