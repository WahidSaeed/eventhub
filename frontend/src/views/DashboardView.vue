<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../store/auth';
import DayGroup from '../components/DayGroup.vue';
import EventCard from '../components/EventCard.vue';
import Icon from '../components/Icon.vue';
import api from '../services/api';
import { groupByDay } from '../utils/format';

const auth = useAuthStore();
const upcoming = ref([]);
const past = ref([]);
const loading = ref(true);
const error = ref('');
const tab = ref('upcoming');

const profile = ref({ name: '', email: '', password: '' });
const profileMessage = ref('');
const profileError = ref('');
const savingProfile = ref(false);

const firstName = computed(() => (auth.user?.name || '').split(' ')[0]);
const groups = computed(() =>
  groupByDay(tab.value === 'upcoming' ? upcoming.value : past.value, (rsvp) => rsvp.event.date)
);

async function load() {
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
  if (!confirm(`Cancel your registration for ${rsvp.event.title}?`)) return;
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
  <div class="page">
    <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">Your events</h1>
        <p class="mt-1 text-ink-2">Everything you have registered for, {{ firstName }}.</p>
      </div>

      <div class="tabs" role="tablist" aria-label="Event timing">
        <button
          type="button"
          role="tab"
          class="tab"
          :class="{ 'is-active': tab === 'upcoming' }"
          :aria-selected="tab === 'upcoming'"
          @click="tab = 'upcoming'"
        >
          Upcoming<span v-if="upcoming.length" class="ml-1.5 text-ink-3">{{ upcoming.length }}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="tab"
          :class="{ 'is-active': tab === 'past' }"
          :aria-selected="tab === 'past'"
          @click="tab = 'past'"
        >
          Past
        </button>
      </div>
    </header>

    <p v-if="error" class="notice notice-error mb-6">{{ error }}</p>

    <div v-if="loading" class="space-y-3" aria-busy="true">
      <div v-for="n in 2" :key="n" class="card h-[130px] animate-pulse bg-white/60"></div>
    </div>

    <div v-else-if="!groups.length" class="card px-6 py-14 text-center">
      <span class="icon-tile mx-auto"><Icon name="ticket" class="h-5 w-5" /></span>
      <h2 class="mt-4 text-lg font-semibold">{{ tab === 'upcoming' ? 'No upcoming events' : 'No past events' }}</h2>
      <p class="mt-1 text-ink-2">
        {{ tab === 'upcoming' ? 'Events you register for will show up here.' : 'Events you attended will show up here.' }}
      </p>
      <RouterLink v-if="tab === 'upcoming'" to="/" class="btn mt-5">Discover events</RouterLink>
    </div>

    <template v-else>
      <DayGroup v-for="group in groups" :key="group.key" :date="group.date">
        <EventCard
          v-for="rsvp in group.items"
          :key="rsvp._id"
          :event="rsvp.event"
          :status="rsvp.status"
          :guests="rsvp.guestsCount"
        >
          <template v-if="tab === 'upcoming'" #actions>
            <button type="button" class="btn btn-ghost btn-sm -ml-2.5" @click="cancelRsvp(rsvp)">
              <Icon name="x" class="h-3.5 w-3.5" />Cancel registration
            </button>
          </template>
        </EventCard>
      </DayGroup>
    </template>

    <section class="mt-12">
      <h2 class="text-lg font-semibold">Account</h2>
      <p class="mb-4 text-sm text-ink-2">Update your name, email or password.</p>

      <form class="card grid gap-4 p-5 sm:grid-cols-2" @submit.prevent="saveProfile">
        <div>
          <label for="pname" class="label">Name</label>
          <input id="pname" v-model="profile.name" class="input" type="text" autocomplete="name" />
        </div>
        <div>
          <label for="pemail" class="label">Email</label>
          <input id="pemail" v-model="profile.email" class="input" type="email" autocomplete="email" />
        </div>
        <div class="sm:col-span-2">
          <label for="ppass" class="label">New password</label>
          <input
            id="ppass"
            v-model="profile.password"
            class="input"
            type="password"
            minlength="8"
            autocomplete="new-password"
            placeholder="Leave blank to keep your current password"
          />
        </div>

        <p v-if="profileMessage" class="notice sm:col-span-2">{{ profileMessage }}</p>
        <p v-if="profileError" class="notice notice-error sm:col-span-2">{{ profileError }}</p>

        <div class="sm:col-span-2">
          <button class="btn" type="submit" :disabled="savingProfile">
            {{ savingProfile ? 'Saving…' : 'Save changes' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
