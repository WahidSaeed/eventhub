<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../store/auth';
import api from '../services/api';
import { dayHeading, timeRange } from '../utils/format';

const auth = useAuthStore();
const upcoming = ref([]);
const past = ref([]);
const loading = ref(true);
const error = ref('');

const profile = ref({ name: '', email: '', password: '' });
const profileMessage = ref('');
const profileError = ref('');
const savingProfile = ref(false);

async function load() {
  loading.value = true;
  try {
    const data = await api.get('/users/me/dashboard');
    upcoming.value = data.upcoming;
    past.value = data.past;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function cancelRsvp(rsvp) {
  if (!confirm(`Cancel your place at ${rsvp.event.title}?`)) return;
  try {
    await api.del(`/rsvps/${rsvp._id}`);
    await load();
  } catch (err) {
    error.value = err.message;
  }
}

async function saveProfile() {
  savingProfile.value = true;
  profileMessage.value = '';
  profileError.value = '';
  try {
    const payload = { name: profile.value.name, email: profile.value.email };
    if (profile.value.password) payload.password = profile.value.password;
    await auth.updateProfile(payload);
    profile.value.password = '';
    profileMessage.value = 'Your details were saved.';
  } catch (err) {
    profileError.value = err.message;
  } finally {
    savingProfile.value = false;
  }
}

onMounted(() => {
  profile.value.name = auth.user.name;
  profile.value.email = auth.user.email;
  load();
});
</script>

<template>
  <div class="mt-10">
    <h1 class="day-header mb-6">Your places</h1>

    <p v-if="loading" class="event-meta">Loading</p>
    <p v-else-if="error" class="notice notice-error mb-6">{{ error }}</p>

    <template v-if="!loading">
      <section class="mb-10">
        <h2 class="field-label mb-2">Coming up</h2>

        <p v-if="!upcoming.length" class="event-meta">
          Nothing booked yet. <RouterLink to="/">Browse the programme</RouterLink>.
        </p>

        <article v-for="rsvp in upcoming" :key="rsvp._id" class="row">
          <div class="col-main">
            <RouterLink :to="`/events/${rsvp.event._id}`" class="event-name block hover:underline">
              {{ rsvp.event.title }}
            </RouterLink>
            <p class="event-meta">
              {{ dayHeading(rsvp.event.date) }}<span v-if="timeRange(rsvp.event.startTime, rsvp.event.endTime)">, {{ timeRange(rsvp.event.startTime, rsvp.event.endTime) }}</span>
            </p>
          </div>

          <span class="leader" aria-hidden="true"></span>

          <div class="col-end">
            <div :class="rsvp.status === 'waitlisted' ? 'tag' : ''">{{ rsvp.status }}</div>
            <div>{{ rsvp.guestsCount }} {{ rsvp.guestsCount === 1 ? 'guest' : 'guests' }}</div>
            <button type="button" class="underline text-ink-soft" @click="cancelRsvp(rsvp)">Cancel</button>
          </div>
        </article>
      </section>

      <section class="mb-10">
        <h2 class="field-label mb-2">Already happened</h2>

        <p v-if="!past.length" class="event-meta">No past events yet.</p>

        <article v-for="rsvp in past" :key="rsvp._id" class="row">
          <div class="col-main">
            <RouterLink :to="`/events/${rsvp.event._id}`" class="event-name block hover:underline">
              {{ rsvp.event.title }}
            </RouterLink>
            <p class="event-meta">{{ dayHeading(rsvp.event.date) }}</p>
          </div>
          <span class="leader" aria-hidden="true"></span>
          <div class="col-end">{{ rsvp.status }}</div>
        </article>
      </section>
    </template>

    <section class="max-w-sm">
      <h2 class="day-header mb-4">Your details</h2>

      <form class="space-y-4" @submit.prevent="saveProfile">
        <div>
          <label for="pname" class="field-label">Name</label>
          <input id="pname" v-model="profile.name" class="field" type="text" />
        </div>
        <div>
          <label for="pemail" class="field-label">Email</label>
          <input id="pemail" v-model="profile.email" class="field" type="email" />
        </div>
        <div>
          <label for="ppass" class="field-label">New password</label>
          <input id="ppass" v-model="profile.password" class="field" type="password" minlength="8" placeholder="Leave blank to keep current" />
        </div>

        <p v-if="profileMessage" class="notice">{{ profileMessage }}</p>
        <p v-if="profileError" class="notice notice-error">{{ profileError }}</p>

        <button class="btn" type="submit" :disabled="savingProfile">
          {{ savingProfile ? 'Saving' : 'Save details' }}
        </button>
      </form>
    </section>
  </div>
</template>
