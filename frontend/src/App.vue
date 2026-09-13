<script setup>
import { RouterView } from 'vue-router';
import NavBar from './components/NavBar.vue';
import { SITE } from './config/site';
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <NavBar />

    <main class="flex-1">
      <RouterView />
    </main>

    <footer class="border-t border-line">
      <div class="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-2 px-4 py-6 text-[13px] text-ink-3 sm:px-6">
        <span>{{ SITE.name }}, {{ SITE.city }}</span>
        <span>Discover events and reserve your place.</span>
      </div>
    </footer>
  </div>
</template>
