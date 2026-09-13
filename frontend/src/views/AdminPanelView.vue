<script setup>
import { ref, onMounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
import Cover from '../components/Cover.vue';
import Icon from '../components/Icon.vue';
import { useEventsStore } from '../store/events';
import api from '../services/api';
import { CATEGORIES, categoryMeta, coverGradient } from '../utils/categories';
import { shortDate, inputDate, priceLabel } from '../utils/format';

const store = useEventsStore();

const PAGE_SIZE = 10;

const events = ref([]);
const pagination = ref(null);
const page = ref(1);
const paging = ref(false);
const entriesEl = ref(null);
const formEl = ref(null);
const reports = ref(null);
const loading = ref(true);
const error = ref('');
const message = ref('');

const blank = () => ({
  _id: null, title: '', description: '', category: 'music', date: '',
  startTime: '', endTime: '', venueName: '', address: '', capacity: 0, price: 0, note: ''
});
const form = ref(blank());
const saving = ref(false);
const editing = computed(() => !!form.value._id);

// past=true so the editor sees the whole archive, newest first, a page at a time.
async function loadEvents() {
  const res = await api.get(`/events?past=true&order=desc&limit=${PAGE_SIZE}&page=${page.value}`);
  events.value = res.events;
  pagination.value = res.pagination;
  // The server clamps an out-of-range page, e.g. after deleting the last entry
  // on the final page, so follow it.
  page.value = res.pagination.page;
}

async function load() {
  error.value = '';
  try {
    const [, reportsRes] = await Promise.all([loadEvents(), api.get('/admin/reports')]);
    reports.value = reportsRes;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

// Changing page keeps the current rows on screen until the next set arrives,
// so the list does not collapse to a loading line and jump the page.
async function goTo(target) {
  if (paging.value) return;
  paging.value = true;
  error.value = '';
  const previous = page.value;
  page.value = target;
  try {
    await loadEvents();
    entriesEl.value?.scrollIntoView({ block: 'start' });
  } catch (err) {
    page.value = previous;
    error.value = err.message;
  } finally {
    paging.value = false;
  }
}

const rangeLabel = computed(() => {
  const p = pagination.value;
  if (!p || !p.total) return '';
  const first = (p.page - 1) * p.limit + 1;
  const last = Math.min(p.page * p.limit, p.total);
  return `${first}–${last} of ${p.total}`;
});

const stats = computed(() => {
  const r = reports.value;
  if (!r) return [];
  return [
    { label: 'Events', value: r.totalEvents, icon: 'calendar' },
    { label: 'Registered people', value: r.totalUsers, icon: 'users' },
    { label: 'Confirmed places', value: r.rsvpsByStatus.confirmed || 0, icon: 'ticket' }
  ];
});

const categoryMax = computed(() =>
  Math.max(1, ...(reports.value?.eventsByCategory || []).map((row) => row.count))
);

function scrollToForm() {
  formEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function edit(event) {
  form.value = {
    _id: event._id,
    title: event.title,
    description: event.description || '',
    category: event.category,
    date: inputDate(event.date),
    startTime: event.startTime || '',
    endTime: event.endTime || '',
    venueName: event.venueName || '',
    address: event.address || '',
    capacity: event.capacity || 0,
    price: event.price || 0,
    note: event.note || ''
  };
  scrollToForm();
}

function resetForm() {
  form.value = blank();
  message.value = '';
  error.value = '';
}

function startNew() {
  resetForm();
  scrollToForm();
}

async function save() {
  saving.value = true;
  error.value = '';
  message.value = '';
  try {
    const { _id, ...payload } = form.value;
    payload.capacity = Number(payload.capacity) || 0;
    payload.price = Number(payload.price) || 0;

    if (_id) {
      await store.update(_id, payload);
      message.value = 'Event updated.';
    } else {
      await store.create(payload);
      message.value = 'Event created.';
    }
    form.value = blank();
    await load();
  } catch (err) {
    error.value = err.details ? err.details.map((d) => d.message).join('. ') : err.message;
  } finally {
    saving.value = false;
  }
}

async function remove(event) {
  if (!confirm(`Delete "${event.title}" and all its RSVPs?`)) return;
  try {
    await store.remove(event._id);
    if (form.value._id === event._id) form.value = blank();
    message.value = 'Event deleted.';
    await load();
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(load);
</script>

<template>
  <div class="page page-wide">
    <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">Editor</h1>
        <p class="mt-1 text-ink-2">Publish events, keep them up to date and see how they are doing.</p>
      </div>
      <button type="button" class="btn" @click="startNew"><Icon name="plus" class="h-4 w-4" />New event</button>
    </header>

    <p v-if="message" class="notice mb-4">{{ message }}</p>
    <p v-if="error" class="notice notice-error mb-4">{{ error }}</p>

    <div v-if="reports" class="mb-8 grid gap-3 sm:grid-cols-3">
      <div v-for="stat in stats" :key="stat.label" class="card flex items-center gap-3 p-4">
        <span class="icon-tile"><Icon :name="stat.icon" class="h-5 w-5" /></span>
        <div>
          <p class="text-2xl font-semibold leading-none tabular-nums">{{ stat.value }}</p>
          <p class="mt-1 text-sm text-ink-2">{{ stat.label }}</p>
        </div>
      </div>
    </div>

    <section ref="formEl" class="card mb-10 scroll-mt-20 overflow-hidden">
      <div class="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 class="font-semibold">{{ editing ? 'Edit event' : 'Create event' }}</h2>
        <button v-if="editing" type="button" class="btn btn-ghost btn-sm" @click="resetForm">Cancel edit</button>
      </div>

      <form class="grid gap-6 p-5 md:grid-cols-[180px_minmax(0,1fr)]" @submit.prevent="save">
        <div class="max-w-[180px]">
          <Cover
            :category="form.category"
            :seed="form._id || ''"
            size="lg"
            class="aspect-square w-full rounded-xl"
          />
          <p class="hint">Cover art follows the category.</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label for="t" class="label">Event name</label>
            <input id="t" v-model="form.title" class="input font-medium" type="text" required minlength="3" placeholder="Autumn Jazz Night" />
          </div>

          <div class="sm:col-span-2">
            <label for="d" class="label">Description</label>
            <textarea id="d" v-model="form.description" class="input" rows="3" placeholder="What should people know before they come?"></textarea>
          </div>

          <div>
            <label for="c" class="label">Category</label>
            <select id="c" v-model="form.category" class="input">
              <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
          </div>

          <div>
            <label for="dt" class="label">Date</label>
            <input id="dt" v-model="form.date" class="input" type="date" required />
          </div>

          <div>
            <label for="st" class="label">Start time</label>
            <input id="st" v-model="form.startTime" class="input" type="time" />
          </div>

          <div>
            <label for="et" class="label">End time</label>
            <input id="et" v-model="form.endTime" class="input" type="time" />
          </div>

          <div>
            <label for="v" class="label">Venue name</label>
            <input id="v" v-model="form.venueName" class="input" type="text" placeholder="The Blue Room" />
          </div>

          <div>
            <label for="a" class="label">Address</label>
            <input id="a" v-model="form.address" class="input" type="text" placeholder="Street, city" />
            <p class="hint">Placed on the map when saved.</p>
          </div>

          <div>
            <label for="cap" class="label">Capacity</label>
            <input id="cap" v-model="form.capacity" class="input" type="number" min="0" />
            <p class="hint">Zero means no limit.</p>
          </div>

          <div>
            <label for="price" class="label">Price (€)</label>
            <input id="price" v-model="form.price" class="input" type="number" min="0" step="0.01" />
            <p class="hint">Zero shows as Free.</p>
          </div>

          <div class="sm:col-span-2">
            <label for="note" class="label">Highlight badge</label>
            <input id="note" v-model="form.note" class="input" type="text" maxlength="40" placeholder="Doors 19:30" />
            <p class="hint">Optional, up to 40 characters. Shown as a badge on the event.</p>
          </div>

          <div class="flex flex-wrap gap-2 pt-1 sm:col-span-2">
            <button class="btn btn-lg" type="submit" :disabled="saving">
              {{ saving ? 'Saving…' : editing ? 'Save changes' : 'Create event' }}
            </button>
            <button v-if="editing" class="btn btn-secondary btn-lg" type="button" @click="resetForm">Cancel</button>
          </div>
        </div>
      </form>
    </section>

    <section class="mb-10">
      <div ref="entriesEl" class="mb-3 flex scroll-mt-20 items-baseline justify-between">
        <h2 class="text-lg font-semibold">All events</h2>
        <span v-if="pagination && pagination.total" class="text-sm text-ink-2">
          {{ pagination.total }} {{ pagination.total === 1 ? 'event' : 'events' }}
        </span>
      </div>

      <div class="card divide-y divide-line overflow-hidden">
        <p v-if="loading" class="p-5 text-sm text-ink-2">Loading…</p>
        <p v-else-if="!events.length" class="p-5 text-sm text-ink-2">No events yet. Create the first one above.</p>

        <div v-for="event in events" :key="event._id" class="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02]">
          <Cover :category="event.category" :seed="event._id" size="sm" class="h-11 w-11 shrink-0 rounded-md" />

          <div class="min-w-0 flex-1">
            <RouterLink :to="`/events/${event._id}`" class="block truncate font-medium hover:underline">{{ event.title }}</RouterLink>
            <p class="truncate text-sm text-ink-2">
              {{ shortDate(event.date) }}<template v-if="event.startTime">, {{ event.startTime }}</template><template v-if="event.venueName">, {{ event.venueName }}</template>
            </p>
          </div>

          <div class="hidden text-right sm:block">
            <p class="text-sm font-medium tabular-nums">
              {{ event.confirmedCount || 0 }}<span class="text-ink-3"> / {{ event.capacity || '∞' }}</span>
            </p>
            <p class="text-[13px] text-ink-2">{{ priceLabel(event) }}</p>
          </div>

          <div class="flex shrink-0 gap-0.5">
            <button type="button" class="btn btn-ghost btn-icon" :aria-label="`Edit ${event.title}`" @click="edit(event)">
              <Icon name="pencil" class="h-4 w-4" />
            </button>
            <button type="button" class="btn btn-ghost btn-icon hover:text-[#e5376b]" :aria-label="`Delete ${event.title}`" @click="remove(event)">
              <Icon name="trash" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <nav v-if="pagination && pagination.pages > 1" class="mt-3 flex items-center justify-between gap-3" aria-label="Event pages">
        <button type="button" class="btn btn-secondary btn-sm" :disabled="paging || pagination.page === 1" @click="goTo(pagination.page - 1)">
          <Icon name="arrow-left" class="h-3.5 w-3.5" />Previous
        </button>
        <span class="text-sm tabular-nums text-ink-2">{{ rangeLabel }}</span>
        <button type="button" class="btn btn-secondary btn-sm" :disabled="paging || pagination.page === pagination.pages" @click="goTo(pagination.page + 1)">
          Next<Icon name="arrow-right" class="h-3.5 w-3.5" />
        </button>
      </nav>
    </section>

    <section v-if="reports" class="grid gap-3 md:grid-cols-2">
      <div class="card p-5">
        <h2 class="font-semibold">Events by category</h2>
        <p v-if="!reports.eventsByCategory.length" class="mt-3 text-sm text-ink-2">No events yet.</p>
        <ul class="mt-4 space-y-3">
          <li v-for="row in reports.eventsByCategory" :key="row.category">
            <div class="mb-1.5 flex items-center justify-between text-sm">
              <span class="flex items-center gap-1.5 font-medium">
                <Icon :name="categoryMeta(row.category).icon" class="h-4 w-4 text-ink-2" />{{ categoryMeta(row.category).label }}
              </span>
              <span class="tabular-nums text-ink-2">{{ row.count }}</span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div
                class="h-full rounded-full"
                :style="{ width: `${(row.count / categoryMax) * 100}%`, background: coverGradient(row.category) }"
              ></div>
            </div>
          </li>
        </ul>
      </div>

      <div class="card p-5">
        <h2 class="font-semibold">Best attended</h2>
        <p v-if="!reports.topEvents.length" class="mt-3 text-sm text-ink-2">No confirmed places yet.</p>
        <ol class="mt-4 space-y-3">
          <li v-for="(row, i) in reports.topEvents" :key="row._id" class="flex items-center gap-3">
            <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/5 text-[13px] font-semibold text-ink-2">{{ i + 1 }}</span>
            <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ row.title }}</span>
            <span class="badge badge-green">{{ row.guests }} {{ row.guests === 1 ? 'guest' : 'guests' }}</span>
          </li>
        </ol>
      </div>
    </section>
  </div>
</template>
