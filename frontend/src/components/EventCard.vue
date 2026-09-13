<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import Cover from './Cover.vue';
import Icon from './Icon.vue';
import { priceLabel, timeRange } from '../utils/format';

const props = defineProps({
  event: { type: Object, required: true },
  // Set on the dashboard, where the card describes the visitor's own RSVP.
  status: { type: String, default: '' },
  guests: { type: Number, default: 0 }
});

const spotsLeft = computed(() => {
  const e = props.event;
  return e.capacity ? Math.max(0, e.capacity - (e.confirmedCount || 0)) : null;
});
</script>

<template>
  <article class="card card-hover relative flex gap-4 p-3.5 sm:p-4">
    <div class="min-w-0 flex-1">
      <p class="text-sm text-ink-2">
        {{ timeRange(event.startTime, event.endTime) || 'Time to be announced' }}
      </p>

      <h3 class="mt-0.5 line-clamp-2 text-[17px] font-semibold leading-snug sm:text-lg">
        <RouterLink :to="`/events/${event._id}`" class="stretched focus:outline-none">{{ event.title }}</RouterLink>
      </h3>

      <p class="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm text-ink-2">
        <Icon name="pin" class="h-4 w-4 shrink-0 text-ink-3" />
        <span class="truncate">{{ event.venueName || 'Venue to be announced' }}</span>
      </p>

      <div class="mt-3 flex flex-wrap items-center gap-1.5">
        <span v-if="status === 'confirmed'" class="badge badge-green">
          <Icon name="check" class="h-3.5 w-3.5" :stroke-width="2.5" />Going
        </span>
        <span v-else-if="status === 'waitlisted'" class="badge badge-amber">Waitlist</span>
        <span v-else-if="status === 'cancelled'" class="badge">Cancelled</span>

        <span class="badge">{{ priceLabel(event) }}</span>

        <template v-if="!status">
          <span v-if="spotsLeft === 0" class="badge badge-amber">Waitlist only</span>
          <span v-else-if="spotsLeft !== null && spotsLeft <= 10" class="badge badge-rose">
            {{ spotsLeft }} {{ spotsLeft === 1 ? 'spot' : 'spots' }} left
          </span>
        </template>

        <span v-if="event.note" class="badge badge-rose">{{ event.note }}</span>
        <span v-if="status && guests" class="badge">{{ guests }} {{ guests === 1 ? 'guest' : 'guests' }}</span>
      </div>

      <div v-if="$slots.actions" class="relative z-10 mt-2">
        <slot name="actions" />
      </div>
    </div>

    <Cover
      :category="event.category"
      :seed="event._id"
      class="h-[92px] w-[92px] shrink-0 rounded-lg sm:h-[112px] sm:w-[112px]"
    />
  </article>
</template>
