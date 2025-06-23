<template>
  <div class="min-h-screen bg-gray-100">
    <nav class="bg-blue-600 p-4 text-white">
      <h1 class="text-2xl">WaGate</h1>
    </nav>
    <div class="container mx-auto p-4">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { RouterView } from 'vue-router'
</script>