<script setup>
import { RouterLink } from 'vue-router';
import Icon from '../components/Icon.vue';
</script>

<template>
  <div class="page page-narrow pt-16 text-center sm:pt-24">
    <span class="icon-tile mx-auto"><Icon name="compass" class="h-5 w-5" /></span>
    <h1 class="mt-5 text-2xl font-semibold tracking-tight">Page not found</h1>
    <p class="mt-1 text-ink-2">That page does not exist or has moved.</p>
    <RouterLink to="/" class="btn mt-6">Back to events</RouterLink>
  </div>
</template>
