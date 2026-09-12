<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import EventMap from '../components/EventMap.vue';
import RsvpForm from '../components/RsvpForm.vue';
import api from '../services/api';
import { dayHeading, timeRange, placesLabel, priceLabel } from '../utils/format';

const route = useRoute();
const event = ref(null);
const loading = ref(true);
const error = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.get(`/events/${route.params.id}`);
    event.value = data.event;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

// Reload after an RSVP change so the remaining-places count stays truthful.
function onRsvpChanged() {
  load();
}

onMounted(load);
</script>

<template>
  <div>
    <p v-if="loading" class="event-meta">Loading</p>
    <p v-else-if="error" class="notice notice-error">{{ error }}</p>

    <article v-else-if="event">
      <p class="vol-marker mb-2">
        <RouterLink to="/">Programme</RouterLink>
      </p>

      <h1 class="text-3xl font-medium mb-1">{{ event.title }}</h1>
      <p class="event-meta mb-6">
        {{ dayHeading(event.date) }}<span v-if="timeRange(event.startTime, event.endTime)">, {{ timeRange(event.startTime, event.endTime) }}</span>
      </p>

      <div class="grid gap-8 md:grid-cols-[1fr_18rem] md:items-start">
        <div>
          <p v-if="event.description" class="mb-6 whitespace-pre-line">{{ event.description }}</p>

          <RsvpForm :event="event" :existing="event.myRsvp" @changed="onRsvpChanged" />
        </div>

        <aside class="space-y-5">
          <div class="rule-top pt-4">
            <h2 class="field-label">Venue</h2>
            <p>{{ event.venueName || 'To be announced' }}</p>
            <p class="event-meta">{{ event.address }}</p>
          </div>

          <div class="rule-top pt-4">
            <h2 class="field-label">Price</h2>
            <p class="event-meta">{{ priceLabel(event) }}</p>
          </div>

          <div class="rule-top pt-4">
            <h2 class="field-label">Places</h2>
            <p class="event-meta">{{ placesLabel(event) }}</p>
          </div>

          <div class="rule-top pt-4">
            <h2 class="field-label">Category</h2>
            <p class="tag">{{ event.category }}</p>
          </div>

          <EventMap
            :lat="event.location && event.location.lat"
            :lng="event.location && event.location.lng"
            :label="event.venueName"
          />
        </aside>
      </div>
    </article>
  </div>
</template>
