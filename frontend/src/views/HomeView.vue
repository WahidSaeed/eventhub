<script setup>
import { onMounted, onBeforeUnmount, computed } from 'vue';
import { storeToRefs } from 'pinia';
import DayGroup from '../components/DayGroup.vue';
import EventCard from '../components/EventCard.vue';
import Icon from '../components/Icon.vue';
import { useEventsStore } from '../store/events';
import { CATEGORIES } from '../utils/categories';
import { SITE } from '../config/site';

const store = useEventsStore();
const { loading, error, byDay, filters, when, events } = storeToRefs(store);

const hasFilters = computed(() => !!(filters.value.category || filters.value.date || filters.value.search));

let searchTimer = null;
function onSearch(e) {
  const value = e.target.value.trim();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => store.setFilter('search', value), 250);
}

onMounted(() => store.fetch());
onBeforeUnmount(() => clearTimeout(searchTimer));
</script>

<template>
  <div class="page">
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">Events</h1>
        <p class="mt-1 text-ink-2">What's on in {{ SITE.city }}, picked by our editors.</p>
      </div>

      <div class="tabs" role="tablist" aria-label="Event timing">
        <button
          type="button"
          role="tab"
          class="tab"
          :class="{ 'is-active': when === 'upcoming' }"
          :aria-selected="when === 'upcoming'"
          @click="store.setWhen('upcoming')"
        >
          Upcoming
        </button>
        <button
          type="button"
          role="tab"
          class="tab"
          :class="{ 'is-active': when === 'past' }"
          :aria-selected="when === 'past'"
          @click="store.setWhen('past')"
        >
          Past
        </button>
      </div>
    </header>

    <div class="mb-3 flex flex-col gap-2 sm:flex-row">
      <label class="relative flex-1">
        <span class="sr-only">Search events</span>
        <Icon name="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <input
          class="input pl-9"
          type="search"
          placeholder="Search events, venues or cities"
          :value="filters.search"
          @input="onSearch"
        />
      </label>
      <label class="sm:w-44">
        <span class="sr-only">Filter by date</span>
        <input
          class="input"
          type="date"
          :value="filters.date"
          @change="store.setFilter('date', $event.target.value)"
        />
      </label>
    </div>

    <div class="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      <button
        type="button"
        class="chip"
        :class="{ 'is-active': !filters.category }"
        @click="store.setFilter('category', '')"
      >
        All
      </button>
      <button
        v-for="c in CATEGORIES"
        :key="c.value"
        type="button"
        class="chip"
        :class="{ 'is-active': filters.category === c.value }"
        @click="store.setFilter('category', c.value)"
      >
        <Icon :name="c.icon" class="h-4 w-4" />{{ c.label }}
      </button>
    </div>

    <div v-if="loading && !events.length" class="space-y-3" aria-busy="true">
      <div v-for="n in 3" :key="n" class="card flex animate-pulse gap-4 p-4">
        <div class="flex-1 space-y-3 py-1">
          <div class="h-3 w-24 rounded bg-black/5"></div>
          <div class="h-4 w-2/3 rounded bg-black/[0.07]"></div>
          <div class="h-3 w-40 rounded bg-black/5"></div>
        </div>
        <div class="h-[92px] w-[92px] rounded-lg bg-black/5 sm:h-[112px] sm:w-[112px]"></div>
      </div>
    </div>

    <p v-else-if="error" class="notice notice-error">{{ error }}</p>

    <div v-else-if="!byDay.length" class="card px-6 py-14 text-center">
      <span class="icon-tile mx-auto"><Icon name="calendar" class="h-5 w-5" /></span>
      <h2 class="mt-4 text-lg font-semibold">
        {{ hasFilters ? 'No events match' : when === 'past' ? 'No past events' : 'Nothing scheduled yet' }}
      </h2>
      <p class="mt-1 text-ink-2">
        {{ hasFilters ? 'Try another category, date or search.' : 'New events appear here as soon as they are published.' }}
      </p>
      <button v-if="hasFilters" type="button" class="btn btn-secondary mt-5" @click="store.clearFilters()">
        Clear filters
      </button>
    </div>

    <div v-else class="transition-opacity" :class="{ 'opacity-60': loading }">
      <DayGroup v-for="group in byDay" :key="group.key" :date="group.date">
        <EventCard v-for="event in group.items" :key="event._id" :event="event" />
      </DayGroup>
    </div>
  </div>
</template>
