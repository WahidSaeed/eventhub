<script setup>
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '../store/auth';

const auth = useAuthStore();
const router = useRouter();

const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
  busy.value = true;
  error.value = '';
  try {
    await auth.signup(name.value, email.value, password.value);
    router.push({ name: 'home' });
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="max-w-sm">
    <h1 class="day-header mb-6">Register</h1>

    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label for="name" class="field-label">Name</label>
        <input id="name" v-model="name" class="field" type="text" autocomplete="name" required />
      </div>
      <div>
        <label for="email" class="field-label">Email</label>
        <input id="email" v-model="email" class="field" type="email" autocomplete="email" required />
      </div>
      <div>
        <label for="password" class="field-label">Password</label>
        <input id="password" v-model="password" class="field" type="password" autocomplete="new-password" minlength="8" required />
        <p class="event-meta mt-1 text-sm">At least 8 characters.</p>
      </div>

      <p v-if="error" class="notice notice-error">{{ error }}</p>

      <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Creating account' : 'Create account' }}</button>
    </form>

    <p class="event-meta mt-6">
      Already registered? <RouterLink to="/login">Sign in</RouterLink>.
    </p>
  </div>
</template>
