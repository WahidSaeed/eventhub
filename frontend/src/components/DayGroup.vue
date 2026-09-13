<script setup>
import { computed } from 'vue';
import { dateParts, dayLabel } from '../utils/format';

const props = defineProps({
  date: { type: [String, Date], required: true }
});

const parts = computed(() => dateParts(props.date));
const label = computed(() => dayLabel(props.date));
</script>

<template>
  <section class="tl-group">
    <h2 class="tl-date">
      <span class="text-[15px] font-semibold">{{ parts.month }} {{ parts.day }}</span>
      <span class="text-[15px] font-normal text-ink-3">{{ label }}</span>
    </h2>
    <div class="tl-items space-y-3">
      <slot />
    </div>
  </section>
</template>
