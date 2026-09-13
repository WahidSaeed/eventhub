<script setup>
import { RouterLink } from 'vue-router';
</script>

<template>
  <div class="mt-10">
    <h1 class="day-header mb-4">Page not found</h1>
    <p class="event-meta">
      That page is not part of this programme.
      <RouterLink to="/">Return to the listing</RouterLink>.
    </p>
  </div>
</template>
