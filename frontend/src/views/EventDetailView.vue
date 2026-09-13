<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import Cover from '../components/Cover.vue';
import EventMap from '../components/EventMap.vue';
import Icon from '../components/Icon.vue';
import RsvpForm from '../components/RsvpForm.vue';
import api from '../services/api';
import { SITE } from '../config/site';
import { categoryMeta } from '../utils/categories';
import { dateParts, timeRange, placesLabel, priceLabel, initials } from '../utils/format';

const route = useRoute();
const event = ref(null);
const loading = ref(true);
const error = ref('');

async function load() {
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

const parts = computed(() => (event.value ? dateParts(event.value.date) : null));
const meta = computed(() => categoryMeta(event.value?.category));
const host = computed(() => event.value?.createdBy?.name || `${SITE.name} editors`);
const going = computed(() => event.value?.confirmedCount || 0);
const mapsUrl = computed(() =>
  event.value?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.value.address)}`
    : ''
);

onMounted(load);
</script>

<template>
  <div class="page page-wide">
    <div v-if="loading" class="grid animate-pulse gap-8 md:grid-cols-[320px_minmax(0,1fr)] md:gap-x-12">
      <div class="aspect-square rounded-xl bg-black/5"></div>
      <div class="space-y-4 pt-8">
        <div class="h-10 w-3/4 rounded-lg bg-black/[0.07]"></div>
        <div class="h-4 w-1/2 rounded bg-black/5"></div>
        <div class="h-4 w-1/3 rounded bg-black/5"></div>
        <div class="mt-8 h-40 rounded-xl bg-black/5"></div>
      </div>
    </div>

    <div v-else-if="error" class="card px-6 py-14 text-center">
      <span class="icon-tile mx-auto"><Icon name="calendar" class="h-5 w-5" /></span>
      <h1 class="mt-4 text-lg font-semibold">This event could not be loaded</h1>
      <p class="mt-1 text-ink-2">{{ error }}</p>
      <RouterLink to="/" class="btn btn-secondary mt-5">Back to events</RouterLink>
    </div>

    <article
      v-else-if="event"
      class="grid gap-8 md:grid-cols-[320px_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:items-start md:gap-x-12"
    >
      <div class="md:col-start-1 md:row-start-1">
        <Cover
          :category="event.category"
          :seed="event._id"
          size="lg"
          class="aspect-square w-full rounded-xl shadow-[0_16px_48px_rgba(19,21,23,0.14)]"
        />
      </div>

      <div class="min-w-0 md:col-start-2 md:row-span-2 md:row-start-1">
        <RouterLink to="/" class="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
          <Icon name="arrow-left" class="h-4 w-4" />All events
        </RouterLink>

        <div class="mt-4 flex flex-wrap gap-1.5">
          <span class="badge"><Icon :name="meta.icon" class="h-3.5 w-3.5" />{{ meta.label }}</span>
          <span class="badge">{{ priceLabel(event) }}</span>
          <span v-if="event.note" class="badge badge-rose">{{ event.note }}</span>
        </div>

        <h1 class="mt-3 text-[30px] font-bold leading-[1.1] tracking-tight sm:text-[40px]">{{ event.title }}</h1>

        <div class="mt-6 space-y-4">
          <div class="flex items-center gap-3">
            <div class="date-tile">
              <div class="date-tile-month">{{ parts.month }}</div>
              <div class="date-tile-day">{{ parts.day }}</div>
            </div>
            <div class="min-w-0">
              <p class="font-semibold">{{ parts.long }}</p>
              <p class="text-sm text-ink-2">{{ timeRange(event.startTime, event.endTime) || 'Time to be announced' }}</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span class="icon-tile"><Icon name="pin" class="h-5 w-5" /></span>
            <div class="min-w-0">
              <p class="truncate font-semibold">{{ event.venueName || 'Venue to be announced' }}</p>
              <p v-if="event.address" class="truncate text-sm text-ink-2">{{ event.address }}</p>
            </div>
          </div>
        </div>

        <RsvpForm class="mt-8" :event="event" :existing="event.myRsvp" @changed="onRsvpChanged" />

        <section v-if="event.description" class="mt-10">
          <h2 class="section-title">About event</h2>
          <p class="whitespace-pre-line leading-relaxed">{{ event.description }}</p>
        </section>

        <section class="mt-10">
          <h2 class="section-title">Location</h2>
          <p class="font-medium">{{ event.venueName || 'Venue to be announced' }}</p>
          <p v-if="event.address" class="text-sm text-ink-2">{{ event.address }}</p>
          <a
            v-if="mapsUrl"
            :href="mapsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mb-3 mt-1 inline-flex items-center gap-1 text-sm font-medium text-ink hover:underline"
          >
            Open in Google Maps<Icon name="external" class="h-3.5 w-3.5" />
          </a>
          <EventMap
            class="mt-3"
            :lat="event.location && event.location.lat"
            :lng="event.location && event.location.lng"
            :label="event.venueName"
          />
        </section>
      </div>

      <aside class="space-y-8 md:col-start-1 md:row-start-2">
        <section>
          <h2 class="section-title">Hosted by</h2>
          <div class="flex items-center gap-2.5">
            <span class="avatar h-7 w-7 text-[11px]">{{ initials(host) }}</span>
            <span class="font-medium">{{ host }}</span>
          </div>
        </section>

        <section>
          <h2 class="section-title">{{ going ? `${going} going` : 'Attendance' }}</h2>
          <div v-if="going" class="mb-2 flex" aria-hidden="true">
            <span
              v-for="n in Math.min(going, 6)"
              :key="n"
              class="avatar -ml-1.5 h-7 w-7 ring-2 ring-canvas first:ml-0"
              :style="{ filter: `hue-rotate(${n * 40}deg)` }"
            ></span>
          </div>
          <p class="text-sm text-ink-2">
            {{ going ? placesLabel(event) : 'Be the first to register.' }}
          </p>
        </section>
      </aside>
    </article>
  </div>
</template>
