<script setup>
import { computed } from 'vue';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import { useAuthStore } from '../store/auth';
import { useEventsStore } from '../store/events';
import { listingCount } from '../utils/format';
import { EDITION } from '../config/edition';

const auth = useAuthStore();
const events = useEventsStore();
const router = useRouter();
const route = useRoute();

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'music', label: 'Music' },
  { value: 'food', label: 'Food & drink' },
  { value: 'conference', label: 'Conference' },
  { value: 'community', label: 'Community' },
  { value: 'film', label: 'Film' },
  { value: 'talk', label: 'Talk' }
];

const onListing = computed(() => route.name === 'home');

const weekOf = computed(() => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
});

function pickCategory(value) {
  // Filtering belongs to the listing, so send the visitor there first.
  if (!onListing.value) router.push({ name: 'home' });
  events.setFilter('category', value);
}

function pickDate(e) {
  if (!onListing.value) router.push({ name: 'home' });
  events.setFilter('date', e.target.value);
}

function runSearch(e) {
  if (!onListing.value) router.push({ name: 'home' });
  events.setFilter('search', e.target.value.trim());
}

async function signOut() {
  await auth.logout();
  router.push({ name: 'home' });
}
</script>

<template>
  <header>
    <div class="shell">
      <div class="masthead">
        <RouterLink to="/" class="masthead-title">
          <span class="masthead-mark" aria-hidden="true">✳</span>
          <span>The Running Order</span>
        </RouterLink>

        <div>
          <div class="masthead-account">
            <RouterLink v-if="auth.isAuthenticated" to="/dashboard">Your places</RouterLink>
            <RouterLink v-if="auth.isAdmin" to="/admin">Editor</RouterLink>
            <template v-if="auth.isAuthenticated">
              <button type="button" @click="signOut">Sign out</button>
            </template>
            <template v-else>
              <RouterLink to="/login">Sign in</RouterLink>
              <RouterLink to="/signup">Register</RouterLink>
            </template>
          </div>

          <p class="masthead-meta">
            {{ EDITION.city }} edition<br />
            <b>Week of {{ weekOf }}</b>
            <!-- The count reflects the loaded listing, so only show it there. -->
            <template v-if="onListing"><br />{{ listingCount(events.events.length) }}</template>
          </p>
        </div>
      </div>

      <div class="subbar flex flex-wrap items-center justify-between gap-x-6">
        <nav class="flex flex-wrap items-center gap-x-6">
          <button
            v-for="c in CATEGORIES"
            :key="c.value"
            type="button"
            class="subbar-link"
            :class="{ 'is-active': onListing && events.filters.category === c.value }"
            @click="pickCategory(c.value)"
          >
            {{ c.label }}
          </button>
        </nav>

        <div class="flex items-center gap-4">
          <input
            class="find find-date"
            type="date"
            :value="events.filters.date"
            aria-label="Filter by date"
            @change="pickDate"
          />
          <input
            class="find"
            type="search"
            :value="events.filters.search"
            placeholder="find an event, venue, or city"
            aria-label="Find an event, venue, or city"
            @change="runSearch"
          />
        </div>
      </div>

    </div>
  </header>
</template>
