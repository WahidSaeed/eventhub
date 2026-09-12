<script setup>
import { ref, onMounted, computed } from 'vue';
import { useEventsStore } from '../store/events';
import api from '../services/api';
import { shortDate, inputDate, timeRange, priceLabel } from '../utils/format';

const store = useEventsStore();
const categories = ['music', 'food', 'conference', 'community', 'film', 'talk', 'other'];

const events = ref([]);
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

async function load() {
  loading.value = true;
  error.value = '';
  try {
    // past=true so the editor sees the full archive, not just what is upcoming.
    const [eventsRes, reportsRes] = await Promise.all([
      api.get('/events?past=true'),
      api.get('/admin/reports')
    ]);
    events.value = eventsRes.events;
    reports.value = reportsRes;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
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
  window.scrollTo({ top: 0 });
}

function resetForm() {
  form.value = blank();
  message.value = '';
  error.value = '';
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
  <div>
    <h1 class="day-header mb-6">Editor</h1>

    <p v-if="message" class="notice mb-5">{{ message }}</p>
    <p v-if="error" class="notice notice-error mb-5">{{ error }}</p>

    <section class="mb-12">
      <h2 class="field-label mb-3">{{ editing ? 'Edit entry' : 'Add an entry' }}</h2>

      <form class="grid gap-4 sm:grid-cols-2 max-w-3xl" @submit.prevent="save">
        <div class="sm:col-span-2">
          <label for="t" class="field-label">Title</label>
          <input id="t" v-model="form.title" class="field" type="text" required minlength="3" />
        </div>

        <div class="sm:col-span-2">
          <label for="d" class="field-label">Description</label>
          <textarea id="d" v-model="form.description" class="field" rows="3"></textarea>
        </div>

        <div>
          <label for="c" class="field-label">Category</label>
          <select id="c" v-model="form.category" class="field">
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div>
          <label for="dt" class="field-label">Date</label>
          <input id="dt" v-model="form.date" class="field" type="date" required />
        </div>

        <div>
          <label for="st" class="field-label">Start time</label>
          <input id="st" v-model="form.startTime" class="field" type="time" />
        </div>

        <div>
          <label for="et" class="field-label">End time</label>
          <input id="et" v-model="form.endTime" class="field" type="time" />
        </div>

        <div>
          <label for="v" class="field-label">Venue name</label>
          <input id="v" v-model="form.venueName" class="field" type="text" />
        </div>

        <div>
          <label for="cap" class="field-label">Capacity</label>
          <input id="cap" v-model="form.capacity" class="field" type="number" min="0" />
          <p class="venue mt-1">Zero means no limit.</p>
        </div>

        <div>
          <label for="note" class="field-label">Listing note</label>
          <input id="note" v-model="form.note" class="field" type="text" maxlength="40" />
          <p class="venue mt-1">Optional teal tag on the listing, 40 characters.</p>
        </div>

        <div>
          <label for="price" class="field-label">Price</label>
          <input id="price" v-model="form.price" class="field" type="number" min="0" step="0.01" />
          <p class="venue mt-1">Zero shows as Free.</p>
        </div>

        <div class="sm:col-span-2">
          <label for="a" class="field-label">Address</label>
          <input id="a" v-model="form.address" class="field" type="text" />
          <p class="venue mt-1">Geocoded to map coordinates when saved.</p>
        </div>

        <div class="sm:col-span-2 flex flex-wrap gap-3">
          <button class="btn" type="submit" :disabled="saving">
            {{ saving ? 'Saving' : editing ? 'Save changes' : 'Add entry' }}
          </button>
          <button v-if="editing" class="btn btn-quiet" type="button" @click="resetForm">Cancel edit</button>
        </div>
      </form>
    </section>

    <section class="mb-12">
      <h2 class="field-label mb-3">All entries</h2>

      <p v-if="loading" class="venue">Loading</p>
      <p v-else-if="!events.length" class="venue">No events yet.</p>

      <article v-for="event in events" :key="event._id" class="row">
        <div class="col-main">
          <span class="event-name block">{{ event.title }}</span>
          <p class="venue">
            {{ shortDate(event.date) }}<span v-if="timeRange(event.startTime, event.endTime)">, {{ timeRange(event.startTime, event.endTime) }}</span>
            <span v-if="event.venueName">, {{ event.venueName }}</span>
          </p>
        </div>

        <span class="leader" aria-hidden="true"></span>

        <div class="col-end">
          <div>{{ priceLabel(event) }}, {{ event.confirmedCount }} / {{ event.capacity || 'no limit' }}</div>
          <div class="flex gap-3 justify-end">
            <button type="button" class="underline text-teal" @click="edit(event)">Edit</button>
            <button type="button" class="underline text-ink-soft" @click="remove(event)">Delete</button>
          </div>
        </div>
      </article>
    </section>

    <section v-if="reports">
      <h2 class="field-label mb-3">Reports</h2>

      <div class="grid gap-6 sm:grid-cols-3 mb-8">
        <div class="rule-top pt-3">
          <p class="text-3xl font-medium">{{ reports.totalEvents }}</p>
          <p class="venue">Events</p>
        </div>
        <div class="rule-top pt-3">
          <p class="text-3xl font-medium">{{ reports.totalUsers }}</p>
          <p class="venue">Registered people</p>
        </div>
        <div class="rule-top pt-3">
          <p class="text-3xl font-medium">{{ reports.rsvpsByStatus.confirmed || 0 }}</p>
          <p class="venue">Confirmed places</p>
        </div>
      </div>

      <div class="grid gap-8 sm:grid-cols-2">
        <div>
          <h3 class="field-label mb-2">By category</h3>
          <div v-for="row in reports.eventsByCategory" :key="row.category" class="row">
            <span class="col-main tag">{{ row.category }}</span>
            <span class="leader" aria-hidden="true"></span>
            <span class="col-end">{{ row.count }}</span>
          </div>
        </div>

        <div>
          <h3 class="field-label mb-2">Best attended</h3>
          <p v-if="!reports.topEvents.length" class="venue">No confirmed places yet.</p>
          <div v-for="row in reports.topEvents" :key="row._id" class="row">
            <span class="col-main">{{ row.title }}</span>
            <span class="leader" aria-hidden="true"></span>
            <span class="col-end">{{ row.guests }} guests</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
