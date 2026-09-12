<script setup>
import { onMounted, computed } from 'vue';
import { storeToRefs } from 'pinia';
import DayGroup from '../components/DayGroup.vue';
import { useEventsStore } from '../store/events';

const store = useEventsStore();
const { loading, error, byDay, filters } = storeToRefs(store);

// Running index so numbering continues across day boundaries rather than
// restarting at each header.
const groupsWithOffsets = computed(() => {
  let n = 1;
  return byDay.value.map((group) => {
    const startIndex = n;
    n += group.events.length;
    return { ...group, startIndex };
  });
});

const hasFilters = computed(() => !!(filters.value.category || filters.value.date || filters.value.search));

onMounted(() => store.fetch());
</script>

<template>
  <div>
    <p v-if="loading" class="venue mt-10">Loading the programme</p>
    <p v-else-if="error" class="notice notice-error mt-10">{{ error }}</p>

    <template v-else>
      <p v-if="!groupsWithOffsets.length" class="venue mt-10">
        Nothing is scheduled under these filters.
        <button v-if="hasFilters" type="button" class="underline text-teal" @click="store.clearFilters()">
          Show everything
        </button>
      </p>

      <DayGroup
        v-for="group in groupsWithOffsets"
        :key="group.key"
        :date="group.date"
        :events="group.events"
        :start-index="group.startIndex"
      />

      <p v-if="hasFilters && groupsWithOffsets.length" class="venue mt-6">
        <button type="button" class="underline text-teal" @click="store.clearFilters()">
          Clear filters
        </button>
      </p>
    </template>
  </div>
</template>
