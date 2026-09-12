<script setup>
import { RouterView } from 'vue-router';
import NavBar from './components/NavBar.vue';
import { EDITION } from './config/edition';
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <NavBar />

    <main class="shell flex-1">
      <div class="vol-marker"><b>{{ EDITION.volume }}</b> Printed weekly in {{ EDITION.city }}</div>
      <RouterView />
    </main>

    <div class="shell">
      <footer class="foot">
        <span>The Running Order is a listings platform, not a ticketing monopoly.</span>
        <span>Sign in to save your RSVPs</span>
      </footer>
    </div>
  </div>
</template>
