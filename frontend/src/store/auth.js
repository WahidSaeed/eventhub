import { defineStore } from 'pinia';
import api from '../services/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    ready: false
  }),

  getters: {
    isAuthenticated: (s) => !!s.user,
    isAdmin: (s) => !!s.user && s.user.role === 'admin'
  },

  actions: {
    // Called once before the first navigation so route guards know who the
    // visitor is without every guard hitting the network.
    async init() {
      if (this.ready) return;
      try {
        const { user } = await api.get('/auth/me');
        this.user = user;
      } catch (err) {
        this.user = null;
      } finally {
        this.ready = true;
      }
    },

    async login(email, password) {
      const { user } = await api.post('/auth/login', { email, password });
      this.user = user;
      return user;
    },

    async signup(name, email, password) {
      const { user } = await api.post('/auth/signup', { name, email, password });
      this.user = user;
      return user;
    },

    async logout() {
      try {
        await api.post('/auth/logout');
      } finally {
        this.user = null;
      }
    },

    async updateProfile(payload) {
      const { user } = await api.put('/users/me', payload);
      this.user = user;
      return user;
    }
  }
});
