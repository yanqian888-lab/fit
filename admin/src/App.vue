<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()

onMounted(() => {
  if (auth.isLogin) {
    auth.fetchProfile().catch(() => {})
  }
})
</script>
