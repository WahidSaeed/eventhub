<script setup>
import { ref, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../store/auth';
import Icon from './Icon.vue';
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

const firstName = computed(() => (auth.user?.name || '').split(' ')[0]);

const spotsLeft = computed(() => {
  const e = props.event;
  return e.capacity ? Math.max(0, e.capacity - (e.confirmedCount || 0)) : null;
});
const willWaitlist = computed(() => spotsLeft.value !== null && Number(guests.value) > spotsLeft.value);

function step(delta) {
  guests.value = Math.min(20, Math.max(1, Number(guests.value) + delta));
}

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
  <div class="card overflow-hidden">
    <div class="border-b border-line bg-black/[0.02] px-4 py-2.5 text-sm font-medium text-ink-2">Registration</div>

    <div class="p-4">
      <template v-if="!auth.isAuthenticated">
        <p>Welcome! To join the event, please sign in or create an account.</p>
        <RouterLink
          :to="{ name: 'login', query: { redirect: `/events/${event._id}` } }"
          class="btn btn-lg btn-block mt-4"
        >
          Sign in to register
        </RouterLink>
        <p class="mt-3 text-center text-sm text-ink-2">
          New here?
          <RouterLink
            :to="{ name: 'signup', query: { redirect: `/events/${event._id}` } }"
            class="font-medium text-ink hover:underline"
          >
            Create an account
          </RouterLink>
        </p>
      </template>

      <div v-else-if="existing" :class="{ 'pop-in': justConfirmed }">
        <div class="flex items-start gap-3">
          <span
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full"
            :class="existing.status === 'confirmed' ? 'bg-[rgba(11,155,100,0.1)] text-[#0b9b64]' : 'bg-[rgba(236,151,6,0.12)] text-[#c27803]'"
          >
            <Icon :name="existing.status === 'confirmed' ? 'check' : 'clock'" class="h-5 w-5" :stroke-width="2.25" />
          </span>
          <div>
            <h3 class="text-lg font-semibold leading-tight">
              {{ existing.status === 'confirmed' ? "You're in" : "You're on the waitlist" }}
            </h3>
            <p class="mt-0.5 text-sm text-ink-2">
              <template v-if="existing.status === 'confirmed'">
                Your place is confirmed for {{ existing.guestsCount }}
                {{ existing.guestsCount === 1 ? 'guest' : 'guests' }}. A confirmation is on its way to your inbox.
              </template>
              <template v-else>
                We are holding a spot in line for {{ existing.guestsCount }}
                {{ existing.guestsCount === 1 ? 'guest' : 'guests' }} and will let you know if a place opens up.
              </template>
            </p>
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-block mt-4" :disabled="busy" @click="cancel">
          {{ busy ? 'Cancelling…' : 'Cancel registration' }}
        </button>
      </div>

      <form v-else @submit.prevent="submit">
        <p>Welcome, {{ firstName }}! To join the event, please register below.</p>

        <div class="mt-4 flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
          <div>
            <p class="text-sm font-medium">Guests</p>
            <p class="text-[13px] text-ink-2">Including you</p>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="btn btn-secondary btn-icon" :disabled="guests <= 1" aria-label="Fewer guests" @click="step(-1)">
              <Icon name="minus" class="h-4 w-4" />
            </button>
            <input
              v-model.number="guests"
              class="no-spin w-10 bg-transparent text-center font-semibold tabular-nums outline-none"
              type="number"
              min="1"
              max="20"
              aria-label="Guests"
            />
            <button type="button" class="btn btn-secondary btn-icon" :disabled="guests >= 20" aria-label="More guests" @click="step(1)">
              <Icon name="plus" class="h-4 w-4" />
            </button>
          </div>
        </div>

        <p v-if="willWaitlist" class="mt-3 flex items-center gap-2 text-sm text-[#c27803]">
          <Icon name="clock" class="h-4 w-4 shrink-0" />
          Not enough places left, so you will join the waitlist.
        </p>

        <button class="btn btn-lg btn-block mt-4" type="submit" :disabled="busy">
          {{ busy ? 'Registering…' : willWaitlist ? 'Join waitlist' : 'Register' }}
        </button>
      </form>

      <p v-if="error" class="notice notice-error mt-3">{{ error }}</p>
    </div>
  </div>
</template>
