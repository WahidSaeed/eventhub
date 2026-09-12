<script setup>
import RunningOrderRow from './RunningOrderRow.vue';
import { dayHeading, listingCount } from '../utils/format';

defineProps({
  date: { type: [String, Date], required: true },
  events: { type: Array, required: true },
  startIndex: { type: Number, default: 1 }
});
</script>

<template>
  <section class="mt-10">
    <h2 class="day-header">
      <span>{{ dayHeading(date) }}</span>
      <span class="day-count">{{ listingCount(events.length) }}</span>
    </h2>

    <RunningOrderRow
      v-for="(event, i) in events"
      :key="event._id"
      :event="event"
      :index="startIndex + i"
    />
  </section>
</template>
