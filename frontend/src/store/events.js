import { defineStore } from 'pinia';
import api from '../services/api';
import { groupByDay, todayKey } from '../utils/format';

// Search runs as the visitor types, so a slow earlier response must not
// overwrite a newer one.
let latestRequest = 0;

export const useEventsStore = defineStore('events', {
  state: () => ({
    events: [],
    loading: true,
    error: '',
    when: 'upcoming',
    filters: { category: '', date: '', search: '' }
  }),

  getters: {
    byDay: (s) => groupByDay(s.events)
  },

  actions: {
    async fetch() {
      const id = ++latestRequest;
      this.loading = true;
      this.error = '';
      try {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(this.filters)) {
          if (v) params.set(k, v);
        }
        if (this.when === 'past') {
          params.set('past', 'true');
          params.set('order', 'desc');
        }
        const qs = params.toString();
        const { events } = await api.get(`/events${qs ? `?${qs}` : ''}`);
        if (id !== latestRequest) return;

        const today = todayKey();
        this.events = this.when === 'past'
          ? events.filter((e) => new Date(e.date).toISOString().slice(0, 10) < today)
          : events;
      } catch (err) {
        if (id !== latestRequest) return;
        this.error = err.message;
        this.events = [];
      } finally {
        if (id === latestRequest) this.loading = false;
      }
    },

    setFilter(key, value) {
      this.filters[key] = value;
      return this.fetch();
    },

    setWhen(when) {
      this.when = when;
      return this.fetch();
    },

    clearFilters() {
      this.filters = { category: '', date: '', search: '' };
      return this.fetch();
    },

    create: (payload) => api.post('/events', payload),
    update: (id, payload) => api.put(`/events/${id}`, payload),
    remove: (id) => api.del(`/events/${id}`)
  }
});
