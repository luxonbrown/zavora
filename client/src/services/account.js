/**
 * Account settings service. Mock mode persists preferences to localStorage so
 * the settings page is developable without a server; real mode persists
 * everything to MySQL via /api/account/*.
 */
import api from './api.js';
import { USE_MOCK } from './env.js';
import { readStore, writeStore } from '../utils/storage.js';

const PREFS_KEY = 'account_prefs';

const DEFAULT_PREFS = {
  orderUpdates: true,
  backInStock: true,
  weeklyDrop: false,
  offers: false,
};

export const accountService = {
  async getPreferences() {
    if (USE_MOCK) return { preferences: { ...DEFAULT_PREFS, ...(readStore(PREFS_KEY, {}) ?? {}) } };
    const { data } = await api.get('/account/preferences');
    return data;
  },

  async savePreferences(preferences) {
    if (USE_MOCK) {
      writeStore(PREFS_KEY, preferences);
      return { ok: true, preferences };
    }
    const { data } = await api.put('/account/preferences', preferences);
    return data;
  },

  async updateProfile(payload) {
    if (USE_MOCK) return { ok: true };
    const { data } = await api.put('/account/profile', payload);
    return data;
  },

  async changePassword({ currentPassword, newPassword }) {
    if (USE_MOCK) return { ok: true };
    const { data } = await api.post('/account/password', { currentPassword, newPassword });
    return data;
  },

  async deleteAccount() {
    if (USE_MOCK) return { ok: true };
    const { data } = await api.post('/account/delete');
    return data;
  },
};

export default accountService;
