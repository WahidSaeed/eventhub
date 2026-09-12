<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { startTimeLabel, priceLabel, placesLabel } from '../utils/format';

const props = defineProps({
  event: { type: Object, required: true },
  index: { type: Number, default: null }
});

// The tag carries the editor's note, as in the mockup. With no note, the only
// state worth calling out unprompted is an event that has filled up.
const tag = computed(() => {
  const e = props.event;
  if (e.note) return e.note;
  if (e.capacity && (e.confirmedCount || 0) >= e.capacity) return 'Waitlist only';
  return '';
});
</script>

<template>
  <article class="row">
    <div v-if="index !== null" class="row-num">{{ index }}</div>

    <div class="col-main">
      <div class="event-name">
        <RouterLink :to="`/events/${event._id}`">{{ event.title }}</RouterLink>
      </div>
      <div class="venue">
        <template v-if="event.venueName">at {{ event.venueName }}</template>
        <template v-else>Venue to be announced</template>
      </div>
    </div>

    <div class="leader" aria-hidden="true"></div>

    <div class="col-end">
      <span class="time">{{ startTimeLabel(event) }}</span>
      <span class="price">{{ priceLabel(event) }}</span>
      <div v-if="tag" class="tag">{{ tag }}</div>
    </div>
  </article>
</template>
