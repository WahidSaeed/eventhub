<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '../store/auth';
import Icon from './Icon.vue';
import { SITE } from '../config/site';
import { initials } from '../utils/format';

const auth = useAuthStore();
const router = useRouter();

const now = ref(new Date());
const scrolled = ref(false);
const menuOpen = ref(false);
let clockTimer = null;

const clock = computed(() =>
  now.value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
);

function onScroll() {
  scrolled.value = window.scrollY > 4;
}

function onKey(e) {
  if (e.key === 'Escape') menuOpen.value = false;
}

async function signOut() {
  menuOpen.value = false;
  await auth.logout();
  router.push({ name: 'home' });
}

onMounted(() => {
  clockTimer = setInterval(() => (now.value = new Date()), 30000);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('keydown', onKey);
  onScroll();
});

onBeforeUnmount(() => {
  clearInterval(clockTimer);
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('keydown', onKey);
});
</script>

<template>
  <header class="nav" :class="{ 'is-scrolled': scrolled }">
    <div class="mx-auto flex h-14 max-w-[1080px] items-center gap-1 px-4 sm:px-6">
      <RouterLink to="/" class="mr-2 flex items-center gap-2 font-semibold tracking-tight" :aria-label="SITE.name">
        <span class="avatar h-7 w-7 rounded-lg">
          <Icon name="sparkles" class="h-4 w-4" :stroke-width="2" />
        </span>
        <span class="hidden sm:inline">{{ SITE.name }}</span>
      </RouterLink>

      <nav class="flex items-center">
        <RouterLink to="/" class="nav-link">
          <Icon name="compass" class="h-4 w-4" /><span class="hidden sm:inline">Discover</span>
        </RouterLink>
        <RouterLink v-if="auth.isAuthenticated" to="/dashboard" class="nav-link">
          <Icon name="ticket" class="h-4 w-4" /><span class="hidden sm:inline">Your events</span>
        </RouterLink>
        <RouterLink v-if="auth.isAdmin" to="/admin" class="nav-link">
          <Icon name="chart" class="h-4 w-4" /><span class="hidden sm:inline">Editor</span>
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-2">
        <span class="mr-1 hidden text-[13px] tabular-nums text-ink-3 md:inline">{{ clock }}</span>

        <RouterLink v-if="!auth.isAuthenticated" to="/login" class="btn btn-secondary btn-sm">Sign in</RouterLink>

        <template v-else>
          <RouterLink v-if="auth.isAdmin" to="/admin" class="btn btn-sm hidden sm:inline-flex">
            <Icon name="plus" class="h-4 w-4" />Create event
          </RouterLink>

          <div class="relative">
            <button
              type="button"
              class="avatar h-8 w-8 text-[12px]"
              aria-haspopup="menu"
              :aria-expanded="menuOpen"
              :aria-label="`Account menu for ${auth.user.name}`"
              @click="menuOpen = !menuOpen"
            >
              {{ initials(auth.user.name) }}
            </button>

            <div v-if="menuOpen" class="fixed inset-0 z-40" @click="menuOpen = false"></div>

            <div
              v-if="menuOpen"
              class="card absolute right-0 top-10 z-50 w-60 p-1.5 shadow-[0_12px_40px_rgba(19,21,23,0.12)]"
              role="menu"
            >
              <div class="px-2.5 py-2">
                <p class="truncate text-sm font-semibold">{{ auth.user.name }}</p>
                <p class="truncate text-[13px] text-ink-2">{{ auth.user.email }}</p>
              </div>
              <div class="my-1 border-t border-line"></div>
              <RouterLink to="/dashboard" class="menu-item" role="menuitem" @click="menuOpen = false">
                <Icon name="ticket" class="h-4 w-4 text-ink-2" />Your events
              </RouterLink>
              <RouterLink v-if="auth.isAdmin" to="/admin" class="menu-item" role="menuitem" @click="menuOpen = false">
                <Icon name="chart" class="h-4 w-4 text-ink-2" />Editor
              </RouterLink>
              <button type="button" class="menu-item w-full" role="menuitem" @click="signOut">
                <Icon name="logout" class="h-4 w-4 text-ink-2" />Sign out
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </header>
</template>
