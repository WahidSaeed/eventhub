import { defineStore } from 'pinia';
import api from '../services/api';

export const useEventsStore = defineStore('events', {
  state: () => ({
    events: [],
    loading: false,
    error: '',
    filters: { category: '', date: '', search: '' }
  }),

  getters: {
    // Groups the (already date-sorted) list into consecutive day blocks so the
    // listing can render one header per day.
    byDay: (s) => {
      const groups = [];
      for (const event of s.events) {
        const key = new Date(event.date).toISOString().slice(0, 10);
        const last = groups[groups.length - 1];
        if (last && last.key === key) last.events.push(event);
        else groups.push({ key, date: event.date, events: [event] });
      }
      return groups;
    }
  },

  actions: {
    async fetch() {
      this.loading = true;
      this.error = '';
      try {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(this.filters)) {
          if (v) params.set(k, v);
        }
        const qs = params.toString();
        const { events } = await api.get(`/events${qs ? `?${qs}` : ''}`);
        this.events = events;
      } catch (err) {
        this.error = err.message;
        this.events = [];
      } finally {
        this.loading = false;
      }
    },

    setFilter(key, value) {
      this.filters[key] = value;
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
