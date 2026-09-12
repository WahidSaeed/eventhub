<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../store/auth';
import api from '../services/api';

const props = defineProps({
  event: { type: Object, required: true },
  existing: { type: Object, default: null }
});
const emit = defineEmits(['changed']);

const auth = useAuthStore();
const guests = ref(1);
const busy = ref(false);
const error = ref('');
const justConfirmed = ref(false);

async function submit() {
  busy.value = true;
  error.value = '';
  try {
    const { rsvp } = await api.post(`/events/${props.event._id}/rsvp`, { guestsCount: Number(guests.value) });
    justConfirmed.value = true;
    emit('changed', rsvp);
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}

async function cancel() {
  busy.value = true;
  error.value = '';
  try {
    await api.del(`/rsvps/${props.existing._id}`);
    justConfirmed.value = false;
    emit('changed', null);
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="rule-top pt-5">
    <h2 class="day-header mb-4">Attendance</h2>

    <p v-if="!auth.isAuthenticated" class="event-meta">
      <RouterLink :to="{ name: 'login', query: { redirect: `/events/${event._id}` } }">Sign in</RouterLink>
      to reserve a place.
    </p>

    <div v-else-if="existing" :class="justConfirmed ? 'confirm-in' : ''">
      <p class="notice mb-4">
        <template v-if="existing.status === 'confirmed'">
          Your place is confirmed for {{ existing.guestsCount }}
          {{ existing.guestsCount === 1 ? 'guest' : 'guests' }}.
        </template>
        <template v-else>
          You are on the waitlist for {{ existing.guestsCount }}
          {{ existing.guestsCount === 1 ? 'guest' : 'guests' }}. We will contact you if a place opens up.
        </template>
      </p>
      <button type="button" class="btn btn-quiet" :disabled="busy" @click="cancel">
        {{ busy ? 'Cancelling' : 'Cancel my place' }}
      </button>
    </div>

    <form v-else class="flex flex-wrap items-end gap-4" @submit.prevent="submit">
      <div>
        <label for="guests" class="field-label">Guests</label>
        <input id="guests" v-model="guests" class="field w-24" type="number" min="1" max="20" />
      </div>
      <button class="btn btn-teal" type="submit" :disabled="busy">
        {{ busy ? 'Reserving' : 'Reserve a place' }}
      </button>
    </form>

    <p v-if="error" class="notice notice-error mt-4">{{ error }}</p>
  </div>
</template>
