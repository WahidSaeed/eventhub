<script setup>
import { ref } from 'vue';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import { useAuthStore } from '../store/auth';
import Icon from '../components/Icon.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

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
    router.push(route.query.redirect || { name: 'home' });
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page page-narrow sm:pt-20">
    <div class="card p-6 shadow-[0_8px_40px_rgba(19,21,23,0.06)] sm:p-8">
      <span class="avatar h-12 w-12"><Icon name="sparkles" class="h-6 w-6" :stroke-width="2" /></span>
      <h1 class="mt-5 text-2xl font-semibold tracking-tight">Create your account</h1>
      <p class="mt-1 text-ink-2">One account to register for every event.</p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div>
          <label for="name" class="label">Name</label>
          <input id="name" v-model="name" class="input" type="text" autocomplete="name" required />
        </div>
        <div>
          <label for="email" class="label">Email</label>
          <input id="email" v-model="email" class="input" type="email" autocomplete="email" placeholder="you@example.com" required />
        </div>
        <div>
          <label for="password" class="label">Password</label>
          <input id="password" v-model="password" class="input" type="password" autocomplete="new-password" minlength="8" required />
          <p class="hint">At least 8 characters.</p>
        </div>

        <p v-if="error" class="notice notice-error">{{ error }}</p>

        <button class="btn btn-lg btn-block" type="submit" :disabled="busy">{{ busy ? 'Creating account…' : 'Create account' }}</button>
      </form>
    </div>

    <p class="mt-5 text-center text-sm text-ink-2">
      Already registered?
      <RouterLink :to="{ name: 'login', query: route.query }" class="font-medium text-ink hover:underline">Sign in</RouterLink>
    </p>
  </div>
</template>
