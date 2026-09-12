<script setup>
import { ref } from 'vue';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import { useAuthStore } from '../store/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
  busy.value = true;
  error.value = '';
  try {
    await auth.login(email.value, password.value);
    router.push(route.query.redirect || { name: 'home' });
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="max-w-sm">
    <h1 class="day-header mb-6">Sign in</h1>

    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label for="email" class="field-label">Email</label>
        <input id="email" v-model="email" class="field" type="email" autocomplete="email" required />
      </div>
      <div>
        <label for="password" class="field-label">Password</label>
        <input id="password" v-model="password" class="field" type="password" autocomplete="current-password" required />
      </div>

      <p v-if="error" class="notice notice-error">{{ error }}</p>

      <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Signing in' : 'Sign in' }}</button>
    </form>

    <p class="event-meta mt-6">
      No account yet? <RouterLink to="/signup">Register</RouterLink>.
    </p>
  </div>
</template>
